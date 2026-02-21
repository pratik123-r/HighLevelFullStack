import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler.js';

import { UserRepository } from './repositories/UserRepository.js';
import { AdminRepository } from './repositories/AdminRepository.js';
import { VenueRepository } from './repositories/VenueRepository.js';
import { EventRepository } from './repositories/EventRepository.js';
import { ShowRepository } from './repositories/ShowRepository.js';
import { SeatRepository } from './repositories/SeatRepository.js';
import { BookingRepository } from './repositories/BookingRepository.js';

import { AuditService } from './services/AuditService.js';
import { UserService } from './services/UserService.js';
import { AdminService } from './services/AdminService.js';
import { VenueService } from './services/VenueService.js';
import { EventService } from './services/EventService.js';
import { ShowService } from './services/ShowService.js';
import { SeatService } from './services/SeatService.js';
import { BookingService } from './services/BookingService.js';
import { QueueService } from './services/QueueService.js';

import { UserController } from './controllers/UserController.js';
import { AdminController } from './controllers/AdminController.js';
import { VenueController } from './controllers/VenueController.js';
import { EventController } from './controllers/EventController.js';
import { ShowController } from './controllers/ShowController.js';
import { BookingController } from './controllers/BookingController.js';
import { AuditLogController } from './controllers/AuditLogController.js';

import { createAdminRoutes } from './routes/adminRoutes.js';
import { createUserRoutes } from './routes/userRoutes.js';
import { createPublicRoutes } from './routes/publicRoutes.js';

export function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  const userRepository = new UserRepository();
  const adminRepository = new AdminRepository();
  const venueRepository = new VenueRepository();
  const eventRepository = new EventRepository();
  const showRepository = new ShowRepository();
  const seatRepository = new SeatRepository();
  const bookingRepository = new BookingRepository();

  const queueService = new QueueService();
  
  const auditService = new AuditService(
    queueService,
    userRepository,
    adminRepository,
    showRepository,
    bookingRepository,
    seatRepository
  );
  const userService = new UserService(userRepository);
  const adminService = new AdminService(adminRepository);
  const venueService = new VenueService(venueRepository);
  const eventService = new EventService(eventRepository, venueRepository);
  const showService = new ShowService(
    showRepository,
    eventRepository,
    venueRepository,
    queueService,
    adminRepository
  );
  const seatService = new SeatService(seatRepository, showRepository);
  const bookingService = new BookingService(
    bookingRepository,
    seatRepository,
    showRepository,
    userRepository,
    auditService
  );

  const userController = new UserController(userService);
  const adminController = new AdminController(adminService);
  const venueController = new VenueController(venueService);
  const eventController = new EventController(eventService);
  const showController = new ShowController(showService, seatService);
  const bookingController = new BookingController(bookingService);
  const auditLogController = new AuditLogController(auditService);

  // Public routes (no authentication required)
  app.use('/api', createPublicRoutes(showController, venueController, eventController));

  // Admin routes
  app.use('/api/admin', createAdminRoutes(adminController, venueController, eventController, showController, userController, auditLogController, bookingController));
  
  // User routes (authentication required for some endpoints)
  app.use('/api', createUserRoutes(userController, showController, bookingController));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(errorHandler);

  return app;
}

