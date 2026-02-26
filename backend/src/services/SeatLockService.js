import { redis } from '../config/redis.js';

const LOCK_DURATION_SECONDS = 5 * 60;
const LOCK_KEY_PREFIX = 'seat_lock:';
const SEAT_INDEX_PREFIX = 'seat_index:';  // seat_index:seatId -> Set of lock keys
const BOOKING_INDEX_PREFIX = 'booking_index:';  // booking_index:bookingId -> Set of lock keys
const USER_BOOKING_INDEX_PREFIX = 'user_booking_index:';  // user_booking_index:userId:bookingId -> Set of seat IDs

export class SeatLockService {
  // Optimized: O(1) seat lock check using Sets
  // ARGV[1] = userId
  // ARGV[2] = bookingId
  // ARGV[3] = ttlSeconds
  // ARGV[4] = LOCK_KEY_PREFIX
  // ARGV[5] = SEAT_INDEX_PREFIX
  // ARGV[6] = BOOKING_INDEX_PREFIX
  // ARGV[7] = USER_BOOKING_INDEX_PREFIX
  // ARGV[8+] = seatIds
  static LOCK_SEATS_SCRIPT = `
    local locked_count = 0
    local lock_keys = {}
    local seat_ids = {}
    local user_id = ARGV[1]
    local booking_id = ARGV[2]
    local ttl = tonumber(ARGV[3])
    local prefix = ARGV[4]
    local seat_index_prefix = ARGV[5]
    local booking_index_prefix = ARGV[6]
    local user_booking_index_prefix = ARGV[7]
    
    -- Build lock keys and seat IDs
    for i = 8, #ARGV do
      local seat_id = ARGV[i]
      local lock_key = prefix .. user_id .. ':' .. booking_id .. ':' .. seat_id
      table.insert(lock_keys, lock_key)
      table.insert(seat_ids, seat_id)
    end
    
    -- First pass: Check if any seat is already locked (O(1) per seat using Sets)
    for i = 1, #seat_ids do
      local seat_id = seat_ids[i]
      local seat_index_key = seat_index_prefix .. seat_id
      local existing_locks = redis.call('SCARD', seat_index_key)
      if existing_locks > 0 then
        -- At least one seat is locked, abort
        return 0
      end
    end
    
    -- Second pass: Lock all seats atomically and maintain indexes
    local lock_value = 'locked'
    local booking_index_key = booking_index_prefix .. booking_id
    local user_booking_index_key = user_booking_index_prefix .. user_id .. ':' .. booking_id
    
    for i = 1, #lock_keys do
      local lock_key = lock_keys[i]
      local seat_id = seat_ids[i]
      local seat_index_key = seat_index_prefix .. seat_id
      
      -- Set the lock key with TTL
      redis.call('SET', lock_key, lock_value, 'EX', ttl)
      
      -- Add to seat index (Set of lock keys for this seat)
      redis.call('SADD', seat_index_key, lock_key)
      redis.call('EXPIRE', seat_index_key, ttl)
      
      -- Add to booking index (Set of lock keys for this booking)
      redis.call('SADD', booking_index_key, lock_key)
      redis.call('EXPIRE', booking_index_key, ttl)
      
      -- Add to user+booking index (Set of seat IDs for this user+booking)
      redis.call('SADD', user_booking_index_key, seat_id)
      redis.call('EXPIRE', user_booking_index_key, ttl)
      
      locked_count = locked_count + 1
    end
    
    return locked_count
  `;

  // Optimized: O(1) unlock using booking index Set
  // ARGV[1] = bookingId
  // ARGV[2] = LOCK_KEY_PREFIX
  // ARGV[3] = SEAT_INDEX_PREFIX
  // ARGV[4] = BOOKING_INDEX_PREFIX
  // ARGV[5] = USER_BOOKING_INDEX_PREFIX
  static UNLOCK_BY_BOOKING_SCRIPT = `
    local booking_id = ARGV[1]
    local prefix = ARGV[2]
    local seat_index_prefix = ARGV[3]
    local booking_index_prefix = ARGV[4]
    local user_booking_index_prefix = ARGV[5]
    
    local booking_index_key = booking_index_prefix .. booking_id
    local lock_keys = redis.call('SMEMBERS', booking_index_key)
    local unlocked_count = 0
    
    if #lock_keys == 0 then
      return 0
    end
    
    -- Extract user_id from first lock key (format: seat_lock:userId:bookingId:seatId)
    local first_key = lock_keys[1]
    local parts = {}
    for part in string.gmatch(first_key, '[^:]+') do
      table.insert(parts, part)
    end
    local user_id = parts[2]  -- seat_lock:userId:bookingId:seatId
    
    -- Delete all lock keys and clean up indexes
    for i = 1, #lock_keys do
      local lock_key = lock_keys[i]
      
      -- Extract seat_id from lock key
      local key_parts = {}
      for part in string.gmatch(lock_key, '[^:]+') do
        table.insert(key_parts, part)
      end
      local seat_id = key_parts[4]
      
      -- Delete the lock key
      local deleted = redis.call('DEL', lock_key)
      if deleted == 1 then
        unlocked_count = unlocked_count + 1
      end
      
      -- Remove seat index
      local seat_index_key = seat_index_prefix .. seat_id
      redis.call('DEL', seat_index_key)
    end
    
    -- Clean up booking index
    redis.call('DEL', booking_index_key)
    
    -- Clean up user+booking index
    local user_booking_index_key = user_booking_index_prefix .. user_id .. ':' .. booking_id
    redis.call('DEL', user_booking_index_key)
    
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
          0,
          userId,
          bookingId,
          ttlSeconds.toString(),
          LOCK_KEY_PREFIX,
          SEAT_INDEX_PREFIX,
          BOOKING_INDEX_PREFIX,
          USER_BOOKING_INDEX_PREFIX,
          ...seatIds
        ));
      } else {
        result = /** @type {number} */ (await redis.eval(
          SeatLockService.LOCK_SEATS_SCRIPT,
          0,
          userId,
          bookingId,
          ttlSeconds.toString(),
          LOCK_KEY_PREFIX,
          SEAT_INDEX_PREFIX,
          BOOKING_INDEX_PREFIX,
          USER_BOOKING_INDEX_PREFIX,
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
          0,
          bookingId,
          LOCK_KEY_PREFIX,
          SEAT_INDEX_PREFIX,
          BOOKING_INDEX_PREFIX,
          USER_BOOKING_INDEX_PREFIX
        ));
      } else {
        result = /** @type {number} */ (await redis.eval(
          SeatLockService.UNLOCK_BY_BOOKING_SCRIPT,
          0,
          bookingId,
          LOCK_KEY_PREFIX,
          SEAT_INDEX_PREFIX,
          BOOKING_INDEX_PREFIX,
          USER_BOOKING_INDEX_PREFIX
        ));
      }

      return result;
    } catch (error) {
      console.error('Redis unlock by booking error:', error);
      return 0;
    }
  }

  /**
   * Optimized: O(1) check using user+booking index Set
   * @param {string} userId
   * @param {string} bookingId
   * @returns {Promise<boolean>}
   */
  async hasLocksForBooking(userId, bookingId) {
    if (!userId || !bookingId) {
      return false;
    }

    const indexKey = `${USER_BOOKING_INDEX_PREFIX}${userId}:${bookingId}`;

    try {
      const count = await redis.scard(indexKey);
      return count > 0;
    } catch (error) {
      console.error('Redis check locks for booking error:', error);
      return false;
    }
  }
}