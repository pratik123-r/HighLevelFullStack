import { parsePagination, formatPaginationResponse } from '../utils/pagination.js';

/**
 * @typedef {import('express').Request} Request
 * @typedef {import('express').Response} Response
 * @typedef {import('../services/AuditService.js').AuditService} AuditService
 */

export class AuditLogController {
  /**
   * @param {AuditService} auditService
   */
  constructor(auditService) {
    this.auditService = auditService;
  }

  getLogs = async (req, res) => {
    try {
      const { showId, userId, operationType, outcome, startDate, endDate, limit, page } = req.query;
      
      const filters = {};
      if (showId) filters.showId = showId;
      if (userId) filters.userId = userId;
      if (operationType) filters.operationType = operationType;
      if (outcome) filters.outcome = outcome;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const pageNum = parseInt(page, 10) || 1;
      const limitNum = parseInt(limit, 10) || 20;
      
      const total = await this.auditService.getLogsCount(filters);
      
      const queryFilters = { ...filters, limit: limitNum + (pageNum - 1) * limitNum };
      const skip = (pageNum - 1) * limitNum;
      
      const allLogs = await this.auditService.getLogs(queryFilters);
      const paginatedLogs = allLogs.slice(skip, skip + limitNum);
      
      res.status(200).json(formatPaginationResponse(paginatedLogs, total, pageNum, limitNum));
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
}

