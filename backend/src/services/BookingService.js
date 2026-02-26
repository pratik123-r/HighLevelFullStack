import { prisma } from "../config/database.js";
import { SeatStatus, BookingStatus, ShowStatus, Prisma } from "@prisma/client";
import { OperationType } from "../models/AuditLog.js";
import { randomUUID } from "crypto";

const LOCK_DURATION_MS = 1 * 60 * 1000;

export class BookingService {
  /**
   * @param {import('../repositories/BookingRepository.js').BookingRepository} bookingRepository
   * @param {import('../repositories/SeatRepository.js').SeatRepository} seatRepository
   * @param {import('../repositories/ShowRepository.js').ShowRepository} showRepository
   * @param {import('../repositories/UserRepository.js').UserRepository} userRepository
   * @param {import('../services/AuditService.js').AuditService} auditService
   * @param {import('./SeatLockService.js').SeatLockService} seatLockService
   */
  constructor(
    bookingRepository,
    seatRepository,
    showRepository,
    userRepository,
    auditService,
    seatLockService,
  ) {
    this.bookingRepository = bookingRepository;
    this.seatRepository = seatRepository;
    this.showRepository = showRepository;
    this.userRepository = userRepository;
    this.auditService = auditService;
    this.seatLockService = seatLockService;
  }

  /**
   * Lock seat(s) for a user - supports both single and multiple seats
   * Creates PENDING booking entries and locks seats for 5 minutes
   * @param {{ seatIds?: string[], seatId?: string, userId: string }} data
   * @returns {Promise<{ seat: any, booking: any, bookingId: string } | { seats: any[], booking: any, bookingId: string, count: number }>}
   */
  async lockSeats(data) {
    const { seatIds, seatId, userId } = data;
    const MAX_SEATS = 5;

    let seatIdsArray = [];
    if (seatIds && Array.isArray(seatIds)) {
      seatIdsArray = seatIds;
    } else if (seatId) {
      seatIdsArray = [seatId];
    } else {
      throw new Error("Either seatId or seatIds array is required");
    }

    if (seatIdsArray.length === 0) {
      throw new Error("At least one seat ID is required");
    }

    if (seatIdsArray.length > MAX_SEATS) {
      throw new Error(`Cannot lock more than ${MAX_SEATS} seats at once`);
    }

    const uniqueSeatIds = [...new Set(seatIdsArray)];
    if (uniqueSeatIds.length !== seatIdsArray.length) {
      throw new Error("Duplicate seat IDs are not allowed");
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const seats = await this.seatRepository.findByIds(uniqueSeatIds);

    if (seats.length !== uniqueSeatIds.length) {
      throw new Error("One or more seats not found");
    }

    const uniqueShowIds = [...new Set(seats.map((seat) => seat.showId))];
    if (uniqueShowIds.length > 1) {
      throw new Error("All seats must be from the same show");
    }

    const showId = uniqueShowIds[0];
    const firstSeat = seats[0];

    if (firstSeat.show.status !== ShowStatus.AVAILABLE) {
      throw new Error(
        `Show is not available. Current status: ${firstSeat.show.status}`,
      );
    }

    const bookingId = randomUUID();

    const redisLocked = await this.seatLockService.lockSeats(
      uniqueSeatIds,
      userId,
      bookingId,
      LOCK_DURATION_MS / 1000,
    );
    if (!redisLocked) {
      throw new Error(
        "Seats are currently being locked by another request. Please try again.",
      );
    }

    try {
      const results = await prisma.$transaction(async (tx) => {
        const inClause = Prisma.join(
          uniqueSeatIds.map((id) => Prisma.sql`${id}`),
          ", ",
        );
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "Seat" WHERE id IN (${inClause}) FOR UPDATE`,
        );

        const seatsToCheck = /** @type {Array<{id: string}>} */ (
          await tx.$queryRaw`
            SELECT id
            FROM "Seat"
            WHERE id IN (${inClause}) 
              AND (status = ${SeatStatus.BOOKED}::"SeatStatus" 
                OR ("lockedByUserId" IS NOT NULL AND "lockedTill" > NOW()))
          `
        );

        if (seatsToCheck.length > 0) {
          throw new Error("Seats are not available");
        }

        const lockExpiry = new Date(Date.now() + LOCK_DURATION_MS);

        const bookingResult =
          /** @type {Array<{id: string, userId: string, showId: string, status: string, createdAt: Date, updatedAt: Date}>} */ (
            await tx.$queryRaw`
            INSERT INTO "Booking" (id, "userId", "showId", status, "createdAt", "updatedAt")
            VALUES (${bookingId}::uuid, ${userId}::uuid, ${showId}::uuid, ${BookingStatus.PENDING}::"BookingStatus", NOW(), NOW())
            RETURNING id, "userId", "showId", status, "createdAt", "updatedAt"
          `
          );
        const booking = bookingResult[0];

        const lockedSeats =
          /** @type {Array<{id: string, showId: string, seatNumber: number, status: string, lockedByUserId: string | null, lockedTill: Date | null, bookingId: string | null, createdAt: Date}>} */ (
            await tx.$queryRaw`
            UPDATE "Seat"
            SET 
              "lockedByUserId" = ${userId}::uuid,
              "lockedTill" = ${lockExpiry}::timestamp,
              "bookingId" = ${bookingId}::uuid
            WHERE id IN (${inClause})
            RETURNING id, "showId", "seatNumber", status, "lockedByUserId", "lockedTill", "bookingId", "createdAt"
          `
          );

        return { seats: lockedSeats, bookings: [booking] };
      });

      const booking = results.bookings[0];

      await this.auditService.logSuccess({
        operationType: OperationType.LOCK,
        showId,
        userId,
        bookingId: bookingId,
        metadata: { 
          seatIds: uniqueSeatIds,
        },
      });

      return {
        seats: results.seats,
        booking: booking,
        bookingId: bookingId,
        count: results.seats.length,
      };
    } catch (error) {
      await this.seatLockService.unlockByBookingId(bookingId).catch((err) => {
        console.error("Failed to unlock Redis seats:", err);
      });

      await this.auditService.logFailure({
        operationType: OperationType.LOCK,
        showId,
        userId,
        reason: error.message || "Failed to lock seats",
        metadata: { seatIds: uniqueSeatIds },
      });
      throw error;
    }
  }

  /**
   * @param {{ bookingId: string, userId: string }} data
   * @returns {Promise<import('@prisma/client').Booking & { user: any, show: any, seats: any[] }>}
   */
  async confirmBooking(data) {
    const { bookingId, userId } = data;

    const hasLocks = await this.seatLockService.hasLocksForBooking(
      userId,
      bookingId,
    );
    if (!hasLocks) {
      throw new Error(
        "No active locks found for this booking. The lock may have expired.",
      );
    }

    try {
      const confirmedBooking = await prisma.$transaction(async (tx) => {
        const currentBooking =
          /** @type {Array<{id: string, userId: string, showId: string, status: string, createdAt: Date, updatedAt: Date}>} */ (
            await tx.$queryRaw(
              Prisma.sql`SELECT id, "userId", "showId", status, "createdAt", "updatedAt"
            FROM "Booking"
            WHERE id::text = ${bookingId}
            FOR UPDATE`,
            )
          );

        if (!currentBooking || currentBooking.length === 0) {
          throw new Error("Booking not found");
        }

        const booking = currentBooking[0];
        if (booking.userId !== userId) {
          throw new Error("You do not have permission to confirm this booking");
        }
        if (booking.status !== BookingStatus.PENDING) {
          throw new Error(
            `Booking is not pending. Current status: ${booking.status}`,
          );
        }

        const allSeats =
          /** @type {Array<{id: string, showId: string, seatNumber: number, status: string, lockedByUserId: string | null, lockedTill: Date | null, bookingId: string | null, createdAt: Date}>} */ (
            await tx.$queryRaw(
              Prisma.sql`SELECT id, "showId", "seatNumber", status, "lockedByUserId", "lockedTill", "bookingId", "createdAt"
            FROM "Seat"
            WHERE "bookingId"::text = ${bookingId}
              AND "lockedByUserId"::text = ${userId}
              AND "lockedTill" > NOW()
              AND status = ${SeatStatus.AVAILABLE}::"SeatStatus"
            FOR UPDATE`,
            )
          );

        if (!allSeats || allSeats.length === 0) {
          throw new Error(
            "Seat lock has expired or seat is not available. Please lock the seats again before confirming.",
          );
        }

        await tx.$queryRaw(
          Prisma.sql`UPDATE "Booking"
          SET status = ${BookingStatus.CONFIRMED}::"BookingStatus", "updatedAt" = NOW()
          WHERE id::text = ${bookingId}`,
        );

        await tx.$queryRaw(
          Prisma.sql`UPDATE "Seat"
          SET 
            status = ${SeatStatus.BOOKED}::"SeatStatus",
            "lockedByUserId" = NULL,
            "lockedTill" = NULL
          WHERE "bookingId"::text = ${bookingId}`,
        );

        const updatedBooking = await tx.booking.findUnique({
          where: { id: bookingId },
          include: {
            user: true,
            show: { include: { event: { include: { venue: true } } } },
            seats: { orderBy: { seatNumber: "asc" } },
          },
        });

        return updatedBooking;
      });

      await this.seatLockService.unlockByBookingId(bookingId).catch((err) => {
        console.error(
          "Failed to unlock seats in Redis after confirmation:",
          err,
        );
      });

      await this.auditService.logSuccess({
        operationType: OperationType.BOOK,
        showId: confirmedBooking.showId,
        userId,
        bookingId,
      });

      return confirmedBooking;
    } catch (error) {

      let showId = null;
      try {
        const booking = await this.bookingRepository.findById(bookingId);
        if (booking) {
          showId = booking.showId;
        }
      } catch (e) {
        // Ignore error
      }

      await this.auditService.logFailure({
        operationType: OperationType.BOOK,
        showId,
        userId,
        bookingId,
        reason: error.message || "Failed to confirm booking",
      });
      throw error;
    }
  }

  /**
   * @param {string} bookingId
   * @param {string} userId
   * @returns {Promise<import('@prisma/client').Booking | null>}
   */
  async cancelBooking(bookingId, userId) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.userId !== userId) {
      throw new Error("You do not have permission to cancel this booking");
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new Error("Booking is already cancelled");
    }

    const isPending = booking.status === BookingStatus.PENDING;

    try {
      const result = await prisma.$transaction(async (tx) => {
          await tx.seat.updateMany({
            where: { bookingId: bookingId },
            data: {
              status: SeatStatus.AVAILABLE,
              lockedByUserId: null,
              lockedTill: null,
              bookingId: null,
            },
          });

        if (isPending) {
          await tx.booking.delete({
            where: { id: bookingId },
          });
          return null;
        } else {
          return await tx.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.CANCELLED },
          });
        }
      });

      await this.seatLockService.unlockByBookingId(bookingId).catch((err) => {
        console.error("Failed to unlock Redis seats:", err);
      });

      await this.auditService.logSuccess({
        operationType: OperationType.CANCEL,
        showId: booking.showId,
        userId,
        bookingId,
        metadata: {
          action: isPending
            ? "deleted_pending_booking"
            : "cancelled_confirmed_booking",
        },
      });

      return result;
    } catch (error) {
      await this.auditService.logFailure({
        operationType: OperationType.CANCEL,
        showId: booking.showId,
        userId,
        bookingId,
        reason: error.message || "Failed to cancel booking",
      });
      throw error;
    }
  }

  /**
   * Get bookings with pagination and filters (works for both user and admin)
   * @param {number} page
   * @param {number} limit
   * @param {string | null} [userId=null] - If provided, filters by user (for user bookings). If null, returns all bookings (for admin)
   * @param {import('@prisma/client').BookingStatus | null} [status=null] - Optional status filter: PENDING, CONFIRMED, CANCELLED
   * @param {string | null} [showId=null] - Optional show ID filter (admin only)
   * @param {boolean} [includeUser=false] - Whether to include user information (for admin)
   * @returns {Promise<{ data: Array<import('@prisma/client').Booking & { show: any, seats: any[], user?: any }>, total: number, page: number, limit: number }>}
   */
  async getBookingsPaginated(
    page = 1,
    limit = 10,
    userId = null,
    status = null,
    showId = null,
    includeUser = false,
  ) {
    const whereClause = {};

    if (userId) {
      whereClause.userId = userId;
    }

    if (status && Object.values(BookingStatus).includes(status)) {
      whereClause.status = status;
    }

    if (showId) {
      whereClause.showId = showId;
    }

    const total = await prisma.booking.count({ where: whereClause });

    const skip = (page - 1) * limit;
    const bookings = await prisma.booking.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        ...(includeUser ? { user: true } : {}),
        show: { include: { event: { include: { venue: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const bookingsWithSeats = await Promise.all(
      bookings.map(async (booking) => {
        const seats = await prisma.seat.findMany({
          where: {
            bookingId: booking.id,
          },
          orderBy: { seatNumber: "asc" },
        });

        return {
          ...booking,
          seats: seats,
        };
      }),
    );

    return {
      data: bookingsWithSeats,
      total,
      page,
      limit,
    };
  }

  /**
   * @param {string} userId
   * @param {number} page
   * @param {number} limit
   * @param {import('@prisma/client').BookingStatus | null} [status=null] - Optional status filter: PENDING, CONFIRMED, CANCELLED
   * @returns {Promise<{ data: Array<import('@prisma/client').Booking & { show: any, seats: any[] }>, total: number, page: number, limit: number }>}
   */
  async getUserBookingsPaginated(userId, page = 1, limit = 10, status = null) {
    return this.getBookingsPaginated(page, limit, userId, status, null);
  }

  /**
   * Get all bookings with pagination and filters (for admin)
   * @param {number} page
   * @param {number} limit
   * @param {import('@prisma/client').BookingStatus | null} [status=null] - Optional status filter
   * @param {string | null} [userId=null] - Optional user ID filter
   * @param {string | null} [showId=null] - Optional show ID filter
   * @returns {Promise<{ data: Array<import('@prisma/client').Booking & { show: any, seats: any[], user?: any }>, total: number, page: number, limit: number }>}
   */
  async getAllBookingsPaginated(
    page = 1,
    limit = 10,
    status = null,
    userId = null,
    showId = null,
  ) {
    return this.getBookingsPaginated(page, limit, userId, status, showId, true);
  }

  /**
   * @param {string} bookingId
   * @returns {Promise<import('@prisma/client').Booking & { user: any, show: any, seats: any[] }>}
   */
  async getBookingById(bookingId) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new Error("Booking not found");
    }
    return booking;
  }
}
