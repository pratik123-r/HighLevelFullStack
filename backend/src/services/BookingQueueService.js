import { redis } from '../config/redis.js';

const QUEUE_KEY_PREFIX = 'booking_queue:';

/** Batch size: only users with rank 1–1000 (0-based rank < 1000) are allowed to book. */
const BATCH_SIZE = 1000;

/**
 * BookMyShow-style booking queue using Redis sorted set.
 * Score = timestamp (join time); lower score = earlier position.
 * Only users in the top BATCH_SIZE (by rank) are allowed to lock seats.
 */
export class BookingQueueService {
  /**
   * Join the queue for a show. Idempotent: re-joining updates score to current time (re-queue at end).
   * @param {string} showId
   * @param {string} userId
   * @returns {Promise<{ position: number, inBatch: boolean, totalInQueue: number }>}
   */
  async joinQueue(showId, userId) {
    if (!showId || !userId) {
      throw new Error('showId and userId are required');
    }
    const key = QUEUE_KEY_PREFIX + showId;
    const score = Date.now();
    await redis.zadd(key, score, userId);
    const rank = await redis.zrank(key, userId);
    const totalInQueue = await redis.zcard(key);
    const position = rank === null ? totalInQueue : rank + 1;
    const inBatch = rank !== null && rank < BATCH_SIZE;
    return { position, inBatch, totalInQueue };
  }

  /**
   * Get current queue position for a user. Does not add to queue.
   * @param {string} showId
   * @param {string} userId
   * @returns {Promise<{ position: number, inBatch: boolean, totalInQueue: number } | null>}
   */
  async getPosition(showId, userId) {
    if (!showId || !userId) {
      return null;
    }
    const key = QUEUE_KEY_PREFIX + showId;
    const rank = await redis.zrank(key, userId);
    const totalInQueue = await redis.zcard(key);
    if (rank === null) {
      return { position: 0, inBatch: false, totalInQueue };
    }
    const totalInQueue = await redis.zcard(key);
    const position = rank + 1;
    const inBatch = rank < BATCH_SIZE;
    return { position, inBatch, totalInQueue };
  }

  /**
   * Remove user from the queue (e.g. after successful lock, confirm, or cancel).
   * @param {string} showId
   * @param {string} userId
   * @returns {Promise<number>} 1 if removed, 0 if not in set
   */
  async leaveQueue(showId, userId) {
    if (!showId || !userId) {
      return 0;
    }
    const key = QUEUE_KEY_PREFIX + showId;
    return redis.zrem(key, userId);
  }

  /**
   * Check if user is allowed to book (in top BATCH_SIZE) without modifying queue.
   * @param {string} showId
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async isInBatch(showId, userId) {
    const info = await this.getPosition(showId, userId);
    return info !== null && info.inBatch;
  }

  /** Batch size (number of users allowed to book at a time). */
  getBatchSize() {
    return BATCH_SIZE;
  }

  static get BATCH_SIZE() {
    return BATCH_SIZE;
  }
}
