import { Router } from 'express';
import { authenticateUser } from '../middleware/auth.js';
import rateLimiter from '../middleware/rateLimiter.js';

/**
 * @typedef {import('../controllers/UserController.js').UserController} UserController
 * @typedef {import('../controllers/ShowController.js').ShowController} ShowController
 * @typedef {import('../controllers/BookingController.js').BookingController} BookingController
 */

/**
 * @param {UserController} userController
 * @param {ShowController} showController
 * @param {BookingController} bookingController
 * @returns {import('express').Router}
 */
export function createUserRoutes(userController, showController, bookingController) {
  const router = Router();

  router.post('/users/register', userController.register);
  router.post('/users/login', rateLimiter(5, 1 * 60 * 1000), userController.login);
  router.post('/users/logout', authenticateUser, userController.logout);
  
  router.get('/users/me', authenticateUser, userController.getMyProfile);

  router.post('/seats/lock', authenticateUser, rateLimiter(5, 5 * 60 * 1000), bookingController.lockSeats); 
  
  router.post('/bookings/:bookingId/confirm', authenticateUser, bookingController.confirmBooking); 
  
  router.post('/bookings/:bookingId/cancel', authenticateUser, bookingController.cancelBooking);
  
  router.get('/bookings', authenticateUser, bookingController.getUserBookings);
  
  router.get('/bookings/:bookingId', authenticateUser, bookingController.getBookingById);

  return router;
}

