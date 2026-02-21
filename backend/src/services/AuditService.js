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
   * @param {{ userId?: string, adminId?: string, showId?: string, bookingId?: string, seatId?: string, seatIds?: string[] }} ids
   * @returns {Promise<{ user?: any, admin?: any, show?: any, booking?: any, seat?: any, seats?: any[] }>}
   */
  async fetchDenormalizedData(ids) {
    const denormalized = {};
    
    try {
      if (ids.userId && this.userRepository) {
        const user = await this.userRepository.findById(ids.userId);
        if (user) {
          denormalized.user = {
            name: user.name,
            email: user.email,
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
            name: admin.name,
            email: admin.email,
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
            status: show.status,
            totalSeats: show.totalSeats,
            event: show.event ? {
              name: show.event.name,
              venue: show.event.venue ? {
                name: show.event.venue.name,
                totalSeatCount: show.event.venue.totalSeatCount,
              } : null,
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
            status: booking.status,
          };
        }
      }
    } catch (error) {
      console.error('Failed to fetch booking data for audit log:', error);
    }

    try {
      const seatIdsToFetch = [];
      if (ids.seatIds && Array.isArray(ids.seatIds) && ids.seatIds.length > 0) {
        seatIdsToFetch.push(...ids.seatIds);
      } else if (ids.seatId) {
        seatIdsToFetch.push(ids.seatId);
      }

      if (seatIdsToFetch.length > 0 && this.seatRepository) {
        const seatDetails = await Promise.all(
          seatIdsToFetch.map(async (seatId) => {
            try {
              const seat = await this.seatRepository.findById(seatId);
              if (seat) {
                return {
                  seatNumber: seat.seatNumber,
                  status: seat.status,
                };
              }
              return null;
            } catch (err) {
              console.error(`Failed to fetch seat ${seatId}:`, err);
              return null;
            }
          })
        );

        const validSeats = seatDetails.filter(s => s !== null);
        if (validSeats.length === 1) {
          denormalized.seat = validSeats[0];
        } else if (validSeats.length > 1) {
          denormalized.seats = validSeats;
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
      
      const seatIds = data.metadata?.seatIds && Array.isArray(data.metadata.seatIds) 
        ? data.metadata.seatIds 
        : (data.seatId ? [data.seatId] : []);

      const denormalized = await this.fetchDenormalizedData({
        userId: data.userId,
        adminId: data.adminId,
        showId: data.showId,
        bookingId: data.bookingId,
        seatId: data.seatId,
        seatIds: (data.bookingId && !data.metadata?.seatIds) ? undefined : (seatIds.length > 0 ? seatIds : undefined),
      });

      // Extract eventId from show if showId is provided and eventId is not already set
      let eventId = data.eventId;
      if (!eventId && data.showId && this.showRepository) {
        try {
          const show = await this.showRepository.findById(data.showId);
          if (show) {
            eventId = show.eventId;
          }
        } catch (error) {
          console.error('Failed to fetch eventId from show for audit log:', error);
        }
      }

      const enhancedMetadata = {
        ...(data.metadata || {}),
        denormalized,
      };

      const logData = {
        ...data,
        eventId: eventId || data.eventId || null,
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

