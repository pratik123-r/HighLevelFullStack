/**
 * @param {any} query
 * @param {number} defaultLimit
 * @param {number} maxLimit
 * @returns {{ page: number, limit: number, skip: number }}
 */
export function parsePagination(query, defaultLimit = 10, maxLimit = 100) {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  let limit = parseInt(query.limit || String(defaultLimit), 10) || defaultLimit;
  
  if (limit > maxLimit) {
    limit = maxLimit;
  }
  
  if (limit < 1) {
    limit = defaultLimit;
  }
  
  const skip = (page - 1) * limit;
  
  return { page, limit, skip };
}

/**
 * @param {any[]} data
 * @param {number} total
 * @param {number} page
 * @param {number} limit
 * @returns {{ data: any[], pagination: { page: number, limit: number, total: number, totalPages: number, hasNextPage: boolean, hasPreviousPage: boolean } }}
 */
export function formatPaginationResponse(data, total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

