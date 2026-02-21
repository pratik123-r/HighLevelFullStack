/**
 * @typedef {import('../repositories/VenueRepository.js').VenueRepository} VenueRepository
 */

export class VenueService {
  /**
   * @param {VenueRepository} venueRepository
   */
  constructor(venueRepository) {
    this.venueRepository = venueRepository;
  }

  /**
   * @param {{ name: string, totalSeatCount: number | string }} data
   * @returns {Promise<import('@prisma/client').Venue>}
   */
  async createVenue(data) {
    // Convert totalSeatCount to integer if it's a string
    const totalSeatCount = typeof data.totalSeatCount === 'string' 
      ? parseInt(data.totalSeatCount, 10) 
      : data.totalSeatCount;

    if (isNaN(totalSeatCount) || totalSeatCount <= 0) {
      throw new Error('Total seat count must be a positive number');
    }

    return this.venueRepository.create({
      name: data.name,
      totalSeatCount: totalSeatCount,
    });
  }

  /**
   * @param {string} id
   * @returns {Promise<import('@prisma/client').Venue>}
   */
  async getVenueById(id) {
    const venue = await this.venueRepository.findById(id);
    if (!venue) {
      throw new Error('Venue not found');
    }
    return venue;
  }

  /**
   * @returns {Promise<Array<import('@prisma/client').Venue>>}
   */
  async getAllVenues() {
    return this.venueRepository.findAll();
  }

  /**
   * @param {number} page
   * @param {number} limit
   * @returns {Promise<{ data: Array<import('@prisma/client').Venue>, total: number, page: number, limit: number }>}
   */
  async getAllVenuesPaginated(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const { data, total } = await this.venueRepository.findAllPaginated(skip, limit);
    return {
      data,
      total,
      page,
      limit,
    };
  }
}

