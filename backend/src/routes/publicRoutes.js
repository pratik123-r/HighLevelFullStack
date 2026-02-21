import { Router } from 'express';

/**
 * @typedef {import('../controllers/ShowController.js').ShowController} ShowController
 * @typedef {import('../controllers/VenueController.js').VenueController} VenueController
 * @typedef {import('../controllers/EventController.js').EventController} EventController
 */

/**
 * Public routes that don't require authentication
 * @param {ShowController} showController
 * @param {VenueController} venueController
 * @param {EventController} eventController
 * @returns {import('express').Router}
 */
export function createPublicRoutes(showController, venueController, eventController) {
  const router = Router();

  // Public show routes
  router.get('/shows', showController.getAvailableShows);
  router.get('/shows/:id', showController.getShowById);
  router.get('/shows/:id/seats', showController.getShowSeats);

  // Public venue routes
  router.get('/venues', venueController.getAllVenues);
  router.get('/venues/:id', venueController.getVenueById);

  // Public event routes
  router.get('/events', eventController.getAllEvents);
  router.get('/events/:id', eventController.getEventById);

  return router;
}

