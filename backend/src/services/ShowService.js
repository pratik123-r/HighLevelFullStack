import { ShowStatus } from '@prisma/client';
import { QueueService } from './QueueService.js';

/**
 * @typedef {import('../repositories/ShowRepository.js').ShowRepository} ShowRepository
 * @typedef {import('../repositories/EventRepository.js').EventRepository} EventRepository
 * @typedef {import('../repositories/VenueRepository.js').VenueRepository} VenueRepository
 * @typedef {import('../repositories/AdminRepository.js').AdminRepository} AdminRepository
 */

export class ShowService {
  /**
   * @param {ShowRepository} showRepository
   * @param {EventRepository} eventRepository
   * @param {VenueRepository} venueRepository
   * @param {QueueService} queueService
   * @param {AdminRepository} adminRepository
   */
  constructor(showRepository, eventRepository, venueRepository, queueService, adminRepository) {
    this.showRepository = showRepository;
    this.eventRepository = eventRepository;
    this.venueRepository = venueRepository;
    this.queueService = queueService;
    this.adminRepository = adminRepository;
  }

  /**
   * @param {{ eventId: string, adminId: string }} data
   * @returns {Promise<import('@prisma/client').Show>}
   */
  async createShow(data) {
    const { eventId, adminId } = data;

    if (!adminId) {
      throw new Error('Admin ID is required to create a show');
    }

    const admin = await this.adminRepository.findById(adminId);
    if (!admin) {
      throw new Error('Admin not found');
    }

    const event = await this.eventRepository.findById(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    const show = await this.showRepository.create({
      event: { connect: { id: eventId } },
      createdByAdmin: { connect: { id: adminId } },
      status: ShowStatus.SEAT_GENERATION_IN_PROGRESS,
      totalSeats: event.venue.totalSeatCount,
    });

    await this.queueService.enqueueSeatGeneration(show.id);

    return show;
  }

  /**
   * @param {string} id
   * @returns {Promise<import('@prisma/client').Show & { event: any, createdByAdmin: any }>}
   */
  async getShowById(id) {
    const show = await this.showRepository.findById(id);
    if (!show) {
      throw new Error('Show not found');
    }
    return show;
  }

  /**
   * @param {number} page
   * @param {number} limit
   * @param {string} [status] - Optional status filter
   * @returns {Promise<{ data: Array<import('@prisma/client').Show & { event: any }>, total: number, page: number, limit: number }>}
   */
  async getAvailableShowsPaginated(page = 1, limit = 10, status = null) {
    const skip = (page - 1) * limit;
    
    /** @type {ShowStatus} */
    let showStatus = ShowStatus.AVAILABLE;
    if (status && Object.values(ShowStatus).includes(/** @type {any} */ (status))) {
      showStatus = /** @type {ShowStatus} */ (status);
    }
    
    const { data, total } = await this.showRepository.findByStatusPaginated(
      showStatus,
      skip,
      limit
    );
    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * @param {number} page
   * @param {number} limit
   * @param {string} [status] - Optional status filter
   * @returns {Promise<{ data: Array<import('@prisma/client').Show & { event: any }>, total: number, page: number, limit: number }>}
   */
  async getAllShowsPaginated(page = 1, limit = 10, status = null) {
    const skip = (page - 1) * limit;
    
    let showStatus = null;
    if (status && Object.values(ShowStatus).includes(/** @type {any} */ (status))) {
      showStatus = /** @type {ShowStatus} */ (status);
    }
    
    const { data, total } = await this.showRepository.findAllPaginated(
      skip,
      limit,
      showStatus
    );
    return {
      data,
      total,
      page,
      limit,
    };
  }

}

