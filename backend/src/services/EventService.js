/**
 * @typedef {import('../repositories/EventRepository.js').EventRepository} EventRepository
 * @typedef {import('../repositories/VenueRepository.js').VenueRepository} VenueRepository
 */

export class EventService {
  /**
   * @param {EventRepository} eventRepository
   * @param {VenueRepository} venueRepository
   */
  constructor(eventRepository, venueRepository) {
    this.eventRepository = eventRepository;
    this.venueRepository = venueRepository;
  }

  /**
   * @param {{ name: string, venueId: string }} data
   * @returns {Promise<import('@prisma/client').Event & { venue: import('@prisma/client').Venue }>}
   */
  async createEvent(data) {
    const venue = await this.venueRepository.findById(data.venueId);
    if (!venue) {
      throw new Error('Venue not found');
    }

    return this.eventRepository.create({
      name: data.name,
      venue: { connect: { id: data.venueId } },
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<import('@prisma/client').Event & { venue: import('@prisma/client').Venue }>}
   */
  async getEventById(id) {
    const event = await this.eventRepository.findById(id);
    if (!event) {
      throw new Error('Event not found');
    }
    return event;
  }

  /**
   * @returns {Promise<Array<import('@prisma/client').Event & { venue: import('@prisma/client').Venue }>>}
   */
  async getAllEvents() {
    return this.eventRepository.findAll();
  }

  /**
   * @param {number} page
   * @param {number} limit
   * @returns {Promise<{ data: Array<import('@prisma/client').Event & { venue: import('@prisma/client').Venue }>, total: number, page: number, limit: number }>}
   */
  async getAllEventsPaginated(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const { data, total } = await this.eventRepository.findAllPaginated(skip, limit);
    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * @param {string} venueId
   * @returns {Promise<Array<import('@prisma/client').Event & { venue: import('@prisma/client').Venue }>>}
   */
  async getEventsByVenue(venueId) {
    return this.eventRepository.findByVenueId(venueId);
  }
}

