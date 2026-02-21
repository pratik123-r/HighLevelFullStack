import { parsePagination, formatPaginationResponse } from '../utils/pagination.js';

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('../services/VenueService.js').VenueService} VenueService
 */

export class VenueController {
  /**
   * @param {VenueService} venueService
   */
  constructor(venueService) {
    this.venueService = venueService;
  }

  createVenue = async (req, res) => {
    try {
      const venue = await this.venueService.createVenue(req.body);
      res.status(201).json(venue);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  getVenueById = async (req, res) => {
    try {
      const venue = await this.venueService.getVenueById(req.params.id);
      res.json(venue);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  };

  getAllVenues = async (req, res) => {
    try {
      const { page, limit } = parsePagination(req.query, 10, 100);
      
      const { data, total, page: currentPage, limit: currentLimit } = 
        await this.venueService.getAllVenuesPaginated(page, limit);
      
      const response = formatPaginationResponse(data, total, currentPage, currentLimit);
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}

