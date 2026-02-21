import React, { useEffect, useState } from 'react';
import { auditAPI } from '../../services/api';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({
    operationType: '',
    outcome: '',
    showId: '',
    userId: '',
  });

  useEffect(() => {
    fetchLogs();
  }, [page, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filters.operationType) params.operationType = filters.operationType;
      if (filters.outcome) params.outcome = filters.outcome;
      if (filters.showId) params.showId = filters.showId;
      if (filters.userId) params.userId = filters.userId;

      const response = await auditAPI.getLogs(params);
      setLogs(response.data.data || []);
      setTotal(response.data.pagination?.total || response.data.total || 0);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filter changes
  };

  const handleLogClick = (log) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedLog(null);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Audit Logs</h1>
        
        <div className="mb-6 bg-white rounded-lg shadow-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Operation Type</label>
              <select
                value={filters.operationType}
                onChange={(e) => handleFilterChange('operationType', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Operations</option>
                <option value="LOCK">Lock</option>
                <option value="CONFIRM">Confirm</option>
                <option value="CANCEL">Cancel</option>
                <option value="SEAT_GENERATION">Seat Generation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Outcome</label>
              <select
                value={filters.outcome}
                onChange={(e) => handleFilterChange('outcome', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">All Outcomes</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILURE">Failure</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Show ID</label>
              <input
                type="text"
                value={filters.showId}
                onChange={(e) => handleFilterChange('showId', e.target.value)}
                placeholder="Filter by Show ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
              <input
                type="text"
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
                placeholder="Filter by User ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : logs.length > 0 ? (
          <>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Operation Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Outcome
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Admin ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Show ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Booking ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Seat ID(s)
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Metadata
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Timestamp
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr 
                        key={log._id || log.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleLogClick(log)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            log.operationType === 'LOCK' ? 'bg-blue-100 text-blue-800' :
                            log.operationType === 'BOOK' ? 'bg-green-100 text-green-800' :
                            log.operationType === 'CANCEL' ? 'bg-red-100 text-red-800' :
                            log.operationType === 'SEAT_GENERATION' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.operationType || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            log.outcome === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                            log.outcome === 'FAILURE' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.outcome || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.userId ? (
                            <span className="font-mono text-xs">{log.userId.substring(0, 8)}...</span>
                          ) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.adminId ? (
                            <span className="font-mono text-xs">{log.adminId.substring(0, 8)}...</span>
                          ) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.showId ? (
                            <span className="font-mono text-xs">{log.showId.substring(0, 8)}...</span>
                          ) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.bookingId ? (
                            <span className="font-mono text-xs">{log.bookingId.substring(0, 8)}...</span>
                          ) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {(() => {
                            // Check for multiple seat IDs in metadata
                            const seatIds = log.metadata?.seatIds || [];
                            if (Array.isArray(seatIds) && seatIds.length > 0) {
                              return (
                                <span className="font-mono text-xs" title={seatIds.join(', ')}>
                                  {seatIds.length} seat{seatIds.length !== 1 ? 's' : ''}
                                </span>
                              );
                            }
                            // Fallback to single seatId
                            if (log.seatId) {
                              return <span className="font-mono text-xs">{log.seatId.substring(0, 8)}...</span>;
                            }
                            return 'N/A';
                          })()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                          {log.metadata ? (
                            <div className="truncate" title={JSON.stringify(log.metadata, null, 2)}>
                              {(() => {
                                const keys = Object.keys(log.metadata).filter(k => k !== 'denormalized' && k !== 'seatIds');
                                if (keys.length > 0) {
                                  return <span className="text-xs">{keys.join(', ')}</span>;
                                }
                                return 'N/A';
                              })()}
                            </div>
                          ) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                          {log.reason ? (
                            <div className="truncate" title={log.reason}>
                              {log.reason}
                            </div>
                          ) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(log.timestamp || log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} logs
              </div>
              {totalPages > 1 && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700 flex items-center">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 text-lg">No audit logs found.</p>
          </div>
        )}

        {showModal && selectedLog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Audit Log Details</h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Operation Type</label>
                    <div className="mt-1">
                      <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                        selectedLog.operationType === 'LOCK' ? 'bg-blue-100 text-blue-800' :
                        selectedLog.operationType === 'BOOK' ? 'bg-green-100 text-green-800' :
                        selectedLog.operationType === 'CANCEL' ? 'bg-red-100 text-red-800' :
                        selectedLog.operationType === 'SEAT_GENERATION' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedLog.operationType || 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Outcome</label>
                    <div className="mt-1">
                      <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                        selectedLog.outcome === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                        selectedLog.outcome === 'FAILURE' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedLog.outcome || 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">User ID</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono break-all">
                      {selectedLog.userId || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Admin ID</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono break-all">
                      {selectedLog.adminId || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Show ID</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono break-all">
                      {selectedLog.showId || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Booking ID</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono break-all">
                      {selectedLog.bookingId || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Seat ID(s)</label>
                    {(() => {
                      const seatIds = selectedLog.metadata?.seatIds || [];
                      if (Array.isArray(seatIds) && seatIds.length > 0) {
                        return (
                          <div className="mt-1">
                            <p className="text-sm text-gray-600 mb-2">
                              {seatIds.length} seat{seatIds.length !== 1 ? 's' : ''} selected
                            </p>
                            <div className="bg-gray-50 p-3 rounded border border-gray-200 max-h-40 overflow-y-auto">
                              {seatIds.map((seatId, index) => {
                                // Match seat info by index since denormalized.seats array corresponds to seatIds array
                                const seatInfo = selectedLog.metadata?.denormalized?.seats?.[index];
                                return (
                                  <div key={seatId} className="mb-2 last:mb-0">
                                    <p className="text-xs font-mono text-gray-900">
                                      {index + 1}. {seatId}
                                      {seatInfo && ` (Seat #${seatInfo.seatNumber}, ${seatInfo.status})`}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                            {selectedLog.metadata?.denormalized?.seats && selectedLog.metadata.denormalized.seats.length > 0 && (
                              <p className="text-xs text-gray-500 mt-2">
                                Seat Numbers: {selectedLog.metadata.denormalized.seats.map(s => s.seatNumber).join(', ')}
                              </p>
                            )}
                          </div>
                        );
                      }
                      // Fallback to single seatId
                      if (selectedLog.seatId) {
                        const seatInfo = selectedLog.metadata?.denormalized?.seat;
                        return (
                          <div className="mt-1">
                            <p className="text-sm text-gray-900 font-mono break-all">
                              {selectedLog.seatId}
                            </p>
                            {seatInfo && (
                              <p className="text-xs text-gray-500 mt-1">
                                Seat Number: {seatInfo.seatNumber} | Status: {seatInfo.status}
                              </p>
                            )}
                          </div>
                        );
                      }
                      return <p className="mt-1 text-sm text-gray-900">N/A</p>;
                    })()}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Event ID</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono break-all">
                      {selectedLog.eventId || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">Timestamp</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(selectedLog.timestamp || selectedLog.createdAt).toLocaleString()}
                    </p>
                  </div>

                  {selectedLog.reason && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">Reason</label>
                      <p className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded border border-gray-200">
                        {selectedLog.reason}
                      </p>
                    </div>
                  )}

                  {/* Denormalized Data Section */}
                  {selectedLog.metadata?.denormalized && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-2">Additional Information</label>
                      <div className="bg-gray-50 p-4 rounded border border-gray-200 space-y-3">
                        {selectedLog.metadata.denormalized.user && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">User:</p>
                            <p className="text-xs text-gray-600">
                              {selectedLog.metadata.denormalized.user.name} ({selectedLog.metadata.denormalized.user.email})
                            </p>
                          </div>
                        )}
                        {selectedLog.metadata.denormalized.admin && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">Admin:</p>
                            <p className="text-xs text-gray-600">
                              {selectedLog.metadata.denormalized.admin.name} ({selectedLog.metadata.denormalized.admin.email})
                            </p>
                          </div>
                        )}
                        {selectedLog.metadata.denormalized.show && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">Show:</p>
                            <p className="text-xs text-gray-600">
                              {selectedLog.metadata.denormalized.show.event?.name || 'N/A'}
                              {selectedLog.metadata.denormalized.show.event?.venue && (
                                <> - {selectedLog.metadata.denormalized.show.event.venue.name}</>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Status: {selectedLog.metadata.denormalized.show.status} | 
                              Total Seats: {selectedLog.metadata.denormalized.show.totalSeats}
                            </p>
                          </div>
                        )}
                        {selectedLog.metadata.denormalized.booking && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">Booking:</p>
                            <p className="text-xs text-gray-600">
                              Status: {selectedLog.metadata.denormalized.booking.status}
                            </p>
                          </div>
                        )}
                        {selectedLog.metadata.seatCount && (
                          <div>
                            <p className="text-xs font-semibold text-gray-700 mb-1">Seat Count:</p>
                            <p className="text-xs text-gray-600">
                              {selectedLog.metadata.seatCount} seat{selectedLog.metadata.seatCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Raw Metadata (for debugging) */}
                  {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500 mb-1">Raw Metadata</label>
                      <div className="mt-1 bg-gray-50 p-4 rounded border border-gray-200">
                        <pre className="text-xs text-gray-900 whitespace-pre-wrap font-mono overflow-x-auto max-h-60 overflow-y-auto">
                          {JSON.stringify(selectedLog.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-500 mb-1">Log ID</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono break-all">
                      {selectedLog._id || selectedLog.id || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;

