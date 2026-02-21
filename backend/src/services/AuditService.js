import { OperationType, AuditOutcome, AuditLog } from '../models/AuditLog.js';
import { QueueService } from './QueueService.js';
import crypto from 'crypto';

export class AuditService {
  /**
   * @param {QueueService} queueService
   * @param {import('../repositories/UserRepository.js').UserRepository} [userRepository]
   * @param {import('../repositories/AdminRepository.js').AdminRepository} [adminRepository]
   * @param {import('../repositories/ShowRepository.js').ShowRepository} [showRepository]
   * @param {import('../repositories/BookingRepository.js').BookingRepository} [bookingRepository]
   * @param {import('../repositories/SeatRepository.js').SeatRepository} [seatRepository]
   */
  constructor(queueService, userRepository = null, adminRepository = null, showRepository = null, bookingRepository = null, seatRepository = null) {
    this.queueService = queueService;
    this.userRepository = userRepository;
    this.adminRepository = adminRepository;
    this.showRepository = showRepository;
    this.bookingRepository = bookingRepository;
    this.seatRepository = seatRepository;
  }

  /**
   * @param {{ operationType: string, bookingId?: string, seatId?: string, userId?: string, showId?: string, adminId?: string, outcome: string, timestamp?: Date }} data
   * @returns {string}
   */
  generateIdempotencyKey(data) {
    const keyParts = [
      data.operationType,
      data.bookingId || '',
      data.seatId || '',
      data.userId || '',
      data.showId || '',
      data.adminId || '',
      data.outcome,
      Math.floor((data.timestamp || new Date()).getTime() / 1000),
    ];
    const keyString = keyParts.join('|');
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }

  /**
   * Fetch denormalized data for audit log
   * @param {{ userId?: string, adminId?: string, showId?: string, bookingId?: string, seatId?: string }} ids
   * @returns {Promise<{ user?: any, admin?: any, show?: any, booking?: any, seat?: any }>}
   */
  async fetchDenormalizedData(ids) {
    const denormalized = {};
    
    try {
      if (ids.userId && this.userRepository) {
        const user = await this.userRepository.findById(ids.userId);
        if (user) {
          denormalized.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            createdAt: user.createdAt,
          };
        }
      }
    } catch (error) {
      console.error('Failed to fetch user data for audit log:', error);
    }

    try {
      if (ids.adminId && this.adminRepository) {
        const admin = await this.adminRepository.findById(ids.adminId);
        if (admin) {
          denormalized.admin = {
            id: admin.id,
            name: admin.name,
            email: admin.email,
            createdAt: admin.createdAt,
          };
        }
      }
    } catch (error) {
      console.error('Failed to fetch admin data for audit log:', error);
    }

    try {
      if (ids.showId && this.showRepository) {
        const show = await this.showRepository.findById(ids.showId);
        if (show) {
          denormalized.show = {
            id: show.id,
            eventId: show.eventId,
            status: show.status,
            totalSeats: show.totalSeats,
            createdAt: show.createdAt,
            event: show.event ? {
              id: show.event.id,
              name: show.event.name,
              venueId: show.event.venueId,
              venue: show.event.venue ? {
                id: show.event.venue.id,
                name: show.event.venue.name,
                totalSeatCount: show.event.venue.totalSeatCount,
              } : null,
            } : null,
            createdByAdmin: show.createdByAdmin ? {
              id: show.createdByAdmin.id,
              name: show.createdByAdmin.name,
              email: show.createdByAdmin.email,
            } : null,
          };
        }
      }
    } catch (error) {
      console.error('Failed to fetch show data for audit log:', error);
    }

    try {
      if (ids.bookingId && this.bookingRepository) {
        const booking = await this.bookingRepository.findById(ids.bookingId);
        if (booking) {
          denormalized.booking = {
            id: booking.id,
            userId: booking.userId,
            showId: booking.showId,
            seatId: booking.seatId,
            status: booking.status,
            createdAt: booking.createdAt,
            user: booking.user ? {
              id: booking.user.id,
              name: booking.user.name,
              email: booking.user.email,
            } : null,
            show: booking.show ? {
              id: booking.show.id,
              eventId: booking.show.eventId,
              status: booking.show.status,
            } : null,
          };
        }
      }
    } catch (error) {
      console.error('Failed to fetch booking data for audit log:', error);
    }

    try {
      if (ids.seatId && this.seatRepository) {
        const seat = await this.seatRepository.findById(ids.seatId);
        if (seat) {
          denormalized.seat = {
            id: seat.id,
            showId: seat.showId,
            seatNumber: seat.seatNumber,
            status: seat.status,
            lockedByUserId: seat.lockedByUserId,
            bookingId: seat.bookingId,
            createdAt: seat.createdAt,
            show: seat.show ? {
              id: seat.show.id,
              eventId: seat.show.eventId,
              status: seat.show.status,
            } : null,
          };
        }
      }
    } catch (error) {
      console.error('Failed to fetch seat data for audit log:', error);
    }

    return denormalized;
  }

  /**
   * @param {{ operationType: string, eventId?: string, showId?: string, userId?: string, seatId?: string, bookingId?: string, adminId?: string, outcome: string, reason?: string, metadata?: any }} data
   * @returns {Promise<void>}
   */
  async log(data) {
    try {
      const timestamp = new Date();
      
      // Fetch denormalized data
      const denormalized = await this.fetchDenormalizedData({
        userId: data.userId,
        adminId: data.adminId,
        showId: data.showId,
        bookingId: data.bookingId,
        seatId: data.seatId,
      });

      // Build enhanced metadata with all IDs and denormalized info
      const enhancedMetadata = {
        ...(data.metadata || {}),
        // Include all IDs in metadata
        ids: {
          userId: data.userId || null,
          adminId: data.adminId || null,
          showId: data.showId || null,
          bookingId: data.bookingId || null,
          seatId: data.seatId || null,
          eventId: data.eventId || null,
        },
        // Include denormalized data
        denormalized,
      };

      const logData = {
        ...data,
        metadata: enhancedMetadata,
        timestamp,
      };
      const idempotencyKey = this.generateIdempotencyKey(logData);
      
      await this.queueService.enqueueAuditLog(logData, idempotencyKey);
    } catch (error) {
      console.error('Failed to enqueue audit log:', error);
    }
  }

  /**
   * @param {{ operationType: string, eventId?: string, showId?: string, userId?: string, seatId?: string, bookingId?: string, adminId?: string, reason?: string, metadata?: any }} data
   * @returns {Promise<void>}
   */
  async logSuccess(data) {
    await this.log({ ...data, outcome: AuditOutcome.SUCCESS });
  }

  /**
   * @param {{ operationType: string, eventId?: string, showId?: string, userId?: string, seatId?: string, bookingId?: string, adminId?: string, reason?: string, metadata?: any }} data
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

