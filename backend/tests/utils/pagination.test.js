import { describe, it, expect } from '@jest/globals';
import { parsePagination, formatPaginationResponse } from '../../src/utils/pagination.js';

describe('pagination utils', () => {
  describe('parsePagination', () => {
    it('should parse valid pagination query', () => {
      const query = { page: '2', limit: '20' };

      const result = parsePagination(query);

      expect(result).toEqual({
        page: 2,
        limit: 20,
        skip: 20,
      });
    });

    it('should use default values when not provided', () => {
      const query = {};

      const result = parsePagination(query);

      expect(result).toEqual({
        page: 1,
        limit: 10,
        skip: 0,
      });
    });

    it('should use custom default limit', () => {
      const query = {};

      const result = parsePagination(query, 20);

      expect(result.limit).toBe(20);
    });

    it('should enforce max limit', () => {
      const query = { limit: '200' };

      const result = parsePagination(query, 10, 100);

      expect(result.limit).toBe(100);
    });

    it('should set limit to default when less than 1', () => {
      const query = { limit: '0' };

      const result = parsePagination(query);

      expect(result.limit).toBe(10);
    });

    it('should set limit to default when negative', () => {
      const query = { limit: '-5' };

      const result = parsePagination(query);

      expect(result.limit).toBe(10);
    });

    it('should ensure page is at least 1', () => {
      const query = { page: '0' };

      const result = parsePagination(query);

      expect(result.page).toBe(1);
    });

    it('should ensure page is at least 1 when negative', () => {
      const query = { page: '-5' };

      const result = parsePagination(query);

      expect(result.page).toBe(1);
    });

    it('should handle invalid page as 1', () => {
      const query = { page: 'invalid' };

      const result = parsePagination(query);

      expect(result.page).toBe(1);
    });

    it('should handle invalid limit as default', () => {
      const query = { limit: 'invalid' };

      const result = parsePagination(query);

      expect(result.limit).toBe(10);
    });

    it('should calculate skip correctly', () => {
      const query = { page: '3', limit: '15' };

      const result = parsePagination(query);

      expect(result.skip).toBe(30);
    });
  });

  describe('formatPaginationResponse', () => {
    it('should format pagination response correctly', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const total = 20;
      const page = 2;
      const limit = 10;

      const result = formatPaginationResponse(data, total, page, limit);

      expect(result).toEqual({
        data,
        pagination: {
          page: 2,
          limit: 10,
          total: 20,
          totalPages: 2,
          hasNextPage: false,
          hasPreviousPage: true,
        },
      });
    });

    it('should calculate hasNextPage correctly', () => {
      const data = [{ id: 1 }];
      const total = 20;
      const page = 1;
      const limit = 10;

      const result = formatPaginationResponse(data, total, page, limit);

      expect(result.pagination.hasNextPage).toBe(true);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should handle last page', () => {
      const data = [{ id: 1 }];
      const total = 20;
      const page = 2;
      const limit = 10;

      const result = formatPaginationResponse(data, total, page, limit);

      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(true);
    });

    it('should handle first page', () => {
      const data = [{ id: 1 }];
      const total = 20;
      const page = 1;
      const limit = 10;

      const result = formatPaginationResponse(data, total, page, limit);

      expect(result.pagination.hasPreviousPage).toBe(false);
    });

    it('should calculate totalPages correctly', () => {
      const data = [];
      const total = 25;
      const page = 1;
      const limit = 10;

      const result = formatPaginationResponse(data, total, page, limit);

      expect(result.pagination.totalPages).toBe(3);
    });

    it('should handle empty data', () => {
      const data = [];
      const total = 0;
      const page = 1;
      const limit = 10;

      const result = formatPaginationResponse(data, total, page, limit);

      expect(result.data).toEqual([]);
      expect(result.pagination.totalPages).toBe(0);
      expect(result.pagination.hasNextPage).toBe(false);
      expect(result.pagination.hasPreviousPage).toBe(false);
    });
  });
});

