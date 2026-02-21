import { OperationType, AuditOutcome, AuditLog } from '../models/AuditLog.js';
import { QueueService } from './QueueService.js';
import crypto from 'crypto';

export class AuditService {
  /**
   * @param {QueueService} queueService
   */
  constructor(queueService) {
    this.queueService = queueService;
  }

  /**
   * @param {{ operationType: string, bookingId?: string, seatId?: string, userId?: string, showId?: string, outcome: string, timestamp?: Date }} data
   * @returns {string}
   */
  generateIdempotencyKey(data) {
    const keyParts = [
      data.operationType,
      data.bookingId || '',
      data.seatId || '',
      data.userId || '',
      data.showId || '',
      data.outcome,
      Math.floor((data.timestamp || new Date()).getTime() / 1000),
    ];
    const keyString = keyParts.join('|');
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }

  /**
   * @param {{ operationType: string, eventId?: string, showId?: string, userId?: string, seatId?: string, bookingId?: string, outcome: string, reason?: string, metadata?: any }} data
   * @returns {Promise<void>}
   */
  async log(data) {
    try {
      const timestamp = new Date();
      const logData = {
        ...data,
        timestamp,
      };
      const idempotencyKey = this.generateIdempotencyKey(logData);
      
      await this.queueService.enqueueAuditLog(logData, idempotencyKey);
    } catch (error) {
      console.error('Failed to enqueue audit log:', error);
    }
  }

  /**
   * @param {{ operationType: string, eventId?: string, showId?: string, userId?: string, seatId?: string, bookingId?: string, reason?: string, metadata?: any }} data
   * @returns {Promise<void>}
   */
  async logSuccess(data) {
    await this.log({ ...data, outcome: AuditOutcome.SUCCESS });
  }

  /**
   * @param {{ operationType: string, eventId?: string, showId?: string, userId?: string, seatId?: string, bookingId?: string, reason?: string, metadata?: any }} data
   * @returns {Promise<void>}
   */
  async logFailure(data) {
    await this.log({ ...data, outcome: AuditOutcome.FAILURE });
  }

  /**
   * @param {{ showId?: string, userId?: string, operationType?: string, outcome?: string, startDate?: Date, endDate?: Date, limit?: number }} filters
   * @returns {Promise<Array<any>>}
   */
  async getLogs(filters) {
    const query = {};

    if (filters.showId) query.showId = filters.showId;
    if (filters.userId) query.userId = filters.userId;
    if (filters.operationType) query.operationType = filters.operationType;
    if (filters.outcome) query.outcome = filters.outcome;
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    return AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(filters.limit || 100)
      .exec();
  }

  /**
   * @param {{ showId?: string, userId?: string, operationType?: string, outcome?: string, startDate?: Date, endDate?: Date }} filters
   * @returns {Promise<number>}
   */
  async getLogsCount(filters) {
    const query = {};

    if (filters.showId) query.showId = filters.showId;
    if (filters.userId) query.userId = filters.userId;
    if (filters.operationType) query.operationType = filters.operationType;
    if (filters.outcome) query.outcome = filters.outcome;
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = filters.startDate;
      if (filters.endDate) query.timestamp.$lte = filters.endDate;
    }

    return AuditLog.countDocuments(query).exec();
  }
}

