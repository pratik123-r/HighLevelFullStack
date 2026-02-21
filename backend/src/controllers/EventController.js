import { parsePagination, formatPaginationResponse } from '../utils/pagination.js';

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('../services/EventService.js').EventService} EventService
 */

export class EventController {
  /**
   * @param {EventService} eventService
   */
  constructor(eventService) {
    this.eventService = eventService;
  }

  createEvent = async (req, res) => {
    try {
      const event = await this.eventService.createEvent(req.body);
      res.status(201).json(event);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  getEventById = async (req, res) => {
    try {
      const event = await this.eventService.getEventById(req.params.id);
      res.json(event);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  };

  getAllEvents = async (req, res) => {
    try {
      const { page, limit } = parsePagination(req.query, 10, 100);
      
      const { data, total, page: currentPage, limit: currentLimit } = 
        await this.eventService.getAllEventsPaginated(page, limit);
      
      const response = formatPaginationResponse(data, total, currentPage, currentLimit);
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
}

