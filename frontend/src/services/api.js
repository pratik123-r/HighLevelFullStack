import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable sending cookies
});

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear any remaining localStorage data
      localStorage.removeItem('user');
      localStorage.removeItem('userType');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// User API
export const userAPI = {
  register: (data) => api.post('/api/users/register', data),
  login: (data) => api.post('/api/users/login', data),
  logout: () => api.post('/api/users/logout'),
  getProfile: () => api.get('/api/users/me'),
};

// Admin API
export const adminAPI = {
  register: (data) => api.post('/api/admin/auth/register', data),
  login: (data) => api.post('/api/admin/auth/login', data),
  logout: () => api.post('/api/admin/auth/logout'),
  getAllUsers: (params) => api.get('/api/admin/users', { params }),
  getUserById: (id) => api.get(`/api/admin/users/${id}`),
  getAllAdmins: (params) => api.get('/api/admin/auth', { params }),
  getAdminById: (id) => api.get(`/api/admin/auth/${id}`),
};

// Venue API
export const venueAPI = {
  create: (data) => api.post('/api/admin/venues', data), // Admin only
  getAll: (params) => api.get('/api/venues', { params }), // Public
  getById: (id) => api.get(`/api/venues/${id}`), // Public
};

// Event API
export const eventAPI = {
  create: (data) => api.post('/api/admin/events', data), // Admin only
  getAll: (params) => api.get('/api/events', { params }), // Public
  getById: (id) => api.get(`/api/events/${id}`), // Public
};

// Show API
export const showAPI = {
  create: (data) => api.post('/api/admin/shows', data), // Admin only
  getById: (id) => api.get(`/api/shows/${id}`), // Public
  getStatus: (id) => api.get(`/api/admin/shows/${id}/status`), // Admin only
  getAvailable: (params) => api.get('/api/shows', { params }), // Public - only AVAILABLE shows
  getAll: (params) => api.get('/api/admin/shows', { params }), // Admin only - all shows with optional status filter
  getSeats: (id, params) => api.get(`/api/shows/${id}/seats`, { params }), // Public
};

// Booking API
export const bookingAPI = {
  lockSeats: (data) => api.post('/api/seats/lock', data),
  getQueuePosition: (showId) => api.get(`/api/shows/${showId}/queue/position`),
  confirm: (bookingId) => api.post(`/api/bookings/${bookingId}/confirm`),
  cancel: (bookingId) => api.post(`/api/bookings/${bookingId}/cancel`),
  getAll: (params) => api.get('/api/bookings', { params }),
  getAllAdmin: (params) => api.get('/api/admin/bookings', { params }),
  getById: (bookingId) => api.get(`/api/bookings/${bookingId}`),
  getByIdAdmin: (bookingId) => api.get(`/api/admin/bookings/${bookingId}`),
};

// Audit Log API
export const auditAPI = {
  getLogs: (params) => api.get('/api/admin/audit-logs', { params }),
};

export default api;

