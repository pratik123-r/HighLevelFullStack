import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth.js';
import rateLimiter from '../middleware/rateLimiter.js';

/**
 * @typedef {import('../controllers/AdminController.js').AdminController} AdminController
 * @typedef {import('../controllers/VenueController.js').VenueController} VenueController
 * @typedef {import('../controllers/EventController.js').EventController} EventController
 * @typedef {import('../controllers/ShowController.js').ShowController} ShowController
 * @typedef {import('../controllers/UserController.js').UserController} UserController
 * @typedef {import('../controllers/AuditLogController.js').AuditLogController} AuditLogController
 */

/**
 * @param {AdminController} adminController
 * @param {VenueController} venueController
 * @param {EventController} eventController
 * @param {ShowController} showController
 * @param {UserController} userController
 * @param {AuditLogController} auditLogController
 * @param {import('../controllers/BookingController.js').BookingController} bookingController
 * @returns {import('express').Router}
 */
export function createAdminRoutes(adminController, venueController, eventController, showController, userController, auditLogController, bookingController) {
  const router = Router();

  router.post('/auth/register', adminController.register);
  router.post('/auth/login', rateLimiter(5, 1 * 60 * 1000), adminController.login);
  router.post('/auth/logout', authenticateAdmin, adminController.logout);
  router.get('/auth/:id', adminController.getAdminById);
  router.get('/auth', adminController.getAllAdmins);

  router.get('/users', authenticateAdmin, userController.getAllUsers);
  router.get('/users/:id', authenticateAdmin, userController.getUserById);

  router.post('/venues', authenticateAdmin, venueController.createVenue);

  router.post('/events', authenticateAdmin, eventController.createEvent);

  router.post('/shows', authenticateAdmin, showController.createShow);
  router.get('/shows', authenticateAdmin, showController.getAllShows);
  router.get('/shows/:id/status', showController.getShowStatus); 

  router.get('/bookings', authenticateAdmin, bookingController.getAllBookings);
  router.get('/bookings/:id', authenticateAdmin, bookingController.getBookingById);

  router.get('/audit-logs', authenticateAdmin, auditLogController.getLogs);

  return router;
}

