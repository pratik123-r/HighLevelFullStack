import { redis } from '../config/redis.js';

const LOCK_DURATION_SECONDS = 5 * 60;
const LOCK_KEY_PREFIX = 'seat_lock:';

export class SeatLockService {
  static LOCK_SEATS_SCRIPT = `
    local locked_count = 0
    local lock_keys = {}
    local user_id = ARGV[1]
    local booking_id = ARGV[2]
    local ttl = tonumber(ARGV[3])
    local seat_ids = {}
    local prefix = 'seat_lock:'
    
    -- Build lock keys in format seat_lock:userId:bookingId:seatId
    -- ARGV[1] = userId, ARGV[2] = bookingId, ARGV[3] = ttlSeconds, ARGV[4+] = seatIds
    for i = 4, #ARGV do
      local seat_id = ARGV[i]
      local lock_key = prefix .. user_id .. ':' .. booking_id .. ':' .. seat_id
      table.insert(lock_keys, lock_key)
      table.insert(seat_ids, seat_id)
    end
    
    -- First pass: Check if all seats are available
    for i = 1, #lock_keys do
      local lock_key = lock_keys[i]
      local existing_lock = redis.call('GET', lock_key)
      if existing_lock then
        -- At least one seat is locked, abort
        return 0
      end
    end
    
    -- Second pass: Lock all seats atomically
    local lock_value = 'locked'  -- Store simple value
    
    for i = 1, #lock_keys do
      redis.call('SET', lock_keys[i], lock_value, 'EX', ttl)
      locked_count = locked_count + 1
    end
    
    return locked_count
  `;

  static UNLOCK_BY_BOOKING_SCRIPT = `
    local booking_id = ARGV[1]
    local pattern = 'seat_lock:*:' .. booking_id .. ':*'
    local cursor = '0'
    local unlocked_count = 0
    
    repeat
      local result = redis.call('SCAN', cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = result[1]
      local keys = result[2]
      
      for i = 1, #keys do
        local deleted = redis.call('DEL', keys[i])
        if deleted == 1 then
          unlocked_count = unlocked_count + 1
        end
      end
    until cursor == '0'
    
    return unlocked_count
  `;

  constructor() {
    this.lockSeatsScript = null;
    this.unlockByBookingScript = null;
    this.initializationPromise = null;
  }

  async ensureInitialized() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        this.lockSeatsScript = /** @type {string} */ (await redis.script('LOAD', SeatLockService.LOCK_SEATS_SCRIPT));
        this.unlockByBookingScript = /** @type {string} */ (await redis.script('LOAD', SeatLockService.UNLOCK_BY_BOOKING_SCRIPT));
      } catch (error) {
        console.error('Failed to load Lua scripts:', error);
      }
    })();

    return this.initializationPromise;
  }

  /**
   * @param {string[]} seatIds
   * @param {string} userId
   * @param {string} bookingId
   * @param {number} ttlSeconds
   * @returns {Promise<boolean>}
   */
  async lockSeats(seatIds, userId, bookingId, ttlSeconds = LOCK_DURATION_SECONDS) {
    if (!seatIds || seatIds.length === 0) {
      return false;
    }

    if (!userId || !bookingId) {
      throw new Error('UserId and bookingId are required for seat locking');
    }

    await this.ensureInitialized();

    try {
      let result;
      if (this.lockSeatsScript) {
        result = /** @type {number} */ (await redis.evalsha(
          this.lockSeatsScript,
          0, // No KEYS, all data in ARGV
          userId,
          bookingId,
          ttlSeconds.toString(),
          ...seatIds
        ));
      } else {
        result = /** @type {number} */ (await redis.eval(
          SeatLockService.LOCK_SEATS_SCRIPT,
          0, // No KEYS, all data in ARGV
          userId,
          bookingId,
          ttlSeconds.toString(),
          ...seatIds
        ));
      }

      return result === seatIds.length;
    } catch (error) {
      console.error('Redis seat locking error:', error);
      return false;
    }
  }

  /**
   * @param {string} bookingId
   * @returns {Promise<number>}
   */
  async unlockByBookingId(bookingId) {
    if (!bookingId) {
      return 0;
    }

    await this.ensureInitialized();

    try {
      let result;
      if (this.unlockByBookingScript) {
        result = /** @type {number} */ (await redis.evalsha(
          this.unlockByBookingScript,
          0, // No KEYS, bookingId in ARGV
          bookingId
        ));
      } else {
        result = /** @type {number} */ (await redis.eval(
          SeatLockService.UNLOCK_BY_BOOKING_SCRIPT,
          0, // No KEYS, bookingId in ARGV
          bookingId
        ));
      }

      return result;
    } catch (error) {
      console.error('Redis unlock by booking error:', error);
      return 0;
    }
  }

  /**
   * Check if any locks exist for a given bookingId and userId
   * @param {string} userId
   * @param {string} bookingId
   * @returns {Promise<boolean>}
   */
  async hasLocksForBooking(userId, bookingId) {
    if (!userId || !bookingId) {
      return false;
    }

    const pattern = `${LOCK_KEY_PREFIX}${userId}:${bookingId}:*`;

    try {
      const keys = await redis.keys(pattern);
      return keys.length > 0;
    } catch (error) {
      console.error('Redis check locks for booking error:', error);
      return false;
    }
  }
}

