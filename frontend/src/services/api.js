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
  create: (data) => api.post('/api/admin/venues', data),
  getAll: (params) => api.get('/api/admin/venues', { params }),
  getById: (id) => api.get(`/api/admin/venues/${id}`),
};

// Event API
export const eventAPI = {
  create: (data) => api.post('/api/admin/events', data),
  getAll: (params) => api.get('/api/admin/events', { params }),
  getById: (id) => api.get(`/api/admin/events/${id}`),
};

// Show API
export const showAPI = {
  create: (data) => api.post('/api/admin/shows', data),
  getById: (id) => api.get(`/api/shows/${id}`), // User endpoint, works for both
  getByIdAdmin: (id) => api.get(`/api/admin/shows/${id}`), // Admin endpoint
  getStatus: (id) => api.get(`/api/admin/shows/${id}/status`),
  getAvailable: (params) => api.get('/api/shows', { params }), // User endpoint - only AVAILABLE shows
  getAll: (params) => api.get('/api/admin/shows', { params }), // Admin endpoint - all shows with optional status filter
  getSeats: (id, params) => api.get(`/api/shows/${id}/seats`, { params }),
};

// Booking API
export const bookingAPI = {
  lockSeats: (data) => api.post('/api/seats/lock', data),
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

