import { parsePagination, formatPaginationResponse } from '../utils/pagination.js';

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('../services/ShowService.js').ShowService} ShowService
 * @typedef {import('../services/SeatService.js').SeatService} SeatService
 */

export class ShowController {
  /**
   * @param {ShowService} showService
   * @param {SeatService} seatService
   */
  constructor(showService, seatService) {
    this.showService = showService;
    this.seatService = seatService;
  }

  createShow = async (req, res) => {
    try {
      const adminId = req.admin.id;

      const show = await this.showService.createShow({
        ...req.body,
        adminId,
      });
      res.status(201).json(show);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

  getShowById = async (req, res) => {
    try {
      const show = await this.showService.getShowById(req.params.id);
      res.json(show);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  };

  getShowStatus = async (req, res) => {
    try {
      const show = await this.showService.getShowById(req.params.id);
      res.json({ id: show.id, status: show.status });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  };

  getAvailableShows = async (req, res) => {
    try {
      const { status } = req.query;
      const { page: pageNum, limit: limitNum } = parsePagination(req.query, 10, 100);
      
      const { data, total, page: currentPage, limit: currentLimit } = 
        await this.showService.getAvailableShowsPaginated(pageNum, limitNum, status);
      
      const response = formatPaginationResponse(data, total, currentPage, currentLimit);
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  getAllShows = async (req, res) => {
    try {
      const { status } = req.query;
      const { page: pageNum, limit: limitNum } = parsePagination(req.query, 10, 100);
      
      const { data, total, page: currentPage, limit: currentLimit } = 
        await this.showService.getAllShowsPaginated(pageNum, limitNum, status);
      
      const response = formatPaginationResponse(data, total, currentPage, currentLimit);
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };

  getShowSeats = async (req, res) => {
    try {
      
      const { status } = req.query;
      const seatStatus = status ? status.toUpperCase() : undefined;
      const { page, limit } = parsePagination(req.query, 10, 100);
      
      const { data, total, page: currentPage, limit: currentLimit } = 
        await this.seatService.getSeatsByShowPaginated(req.params.id, seatStatus, page, limit);
      
      const response = formatPaginationResponse(data, total, currentPage, currentLimit);
      res.json(response);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  };
}

