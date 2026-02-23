import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockRouterInstance = {
  post: jest.fn().mockReturnThis(),
  get: jest.fn().mockReturnThis(),
  put: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

const mockRouter = jest.fn(() => mockRouterInstance);

jest.unstable_mockModule('express', () => ({
  Router: mockRouter,
}));

jest.unstable_mockModule('../../src/middleware/auth.js', () => ({
  authenticateUser: jest.fn((req, res, next) => next()),
}));

jest.unstable_mockModule('../../src/middleware/rateLimiter.js', () => ({
  default: jest.fn(() => (req, res, next) => next()),
}));

const { createUserRoutes } = await import('../../src/routes/userRoutes.js');

describe('userRoutes', () => {
  let mockUserController;
  let mockShowController;
  let mockBookingController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.mockReturnValue(mockRouterInstance);

    mockUserController = {
      register: jest.fn(),
      login: jest.fn(),
      logout: jest.fn(),
      getMyProfile: jest.fn(),
    };

    mockShowController = {};

    mockBookingController = {
      lockSeats: jest.fn(),
      confirmBooking: jest.fn(),
      cancelBooking: jest.fn(),
      getUserBookings: jest.fn(),
      getBookingById: jest.fn(),
    };
  });

  it('should register all user routes', () => {
    createUserRoutes(mockUserController, mockShowController, mockBookingController);

    expect(mockRouter).toHaveBeenCalled();
    // POST routes: /users/register, /users/login, /users/logout, /seats/lock, /bookings/:bookingId/confirm, /bookings/:bookingId/cancel
    expect(mockRouterInstance.post).toHaveBeenCalledTimes(6);
    // GET routes: /users/me, /bookings, /bookings/:bookingId
    expect(mockRouterInstance.get).toHaveBeenCalledTimes(3);
  });

  it('should register /users/register route', () => {
    createUserRoutes(mockUserController, mockShowController, mockBookingController);

    expect(mockRouterInstance.post).toHaveBeenCalledWith('/users/register', mockUserController.register);
  });

  it('should register /users/login route with rate limiter', () => {
    createUserRoutes(mockUserController, mockShowController, mockBookingController);

    expect(mockRouterInstance.post).toHaveBeenCalledWith(
      '/users/login',
      expect.any(Function), // rate limiter
      mockUserController.login
    );
  });

  it('should register /users/logout route with authentication', () => {
    createUserRoutes(mockUserController, mockShowController, mockBookingController);

    expect(mockRouterInstance.post).toHaveBeenCalledWith(
      '/users/logout',
      expect.any(Function), // authenticateUser
      mockUserController.logout
    );
  });

  it('should register /users/me route with authentication', () => {
    createUserRoutes(mockUserController, mockShowController, mockBookingController);

    expect(mockRouterInstance.get).toHaveBeenCalledWith(
      '/users/me',
      expect.any(Function), // authenticateUser
      mockUserController.getMyProfile
    );
  });

  it('should register /seats/lock route with authentication and rate limiter', () => {
    createUserRoutes(mockUserController, mockShowController, mockBookingController);

    expect(mockRouterInstance.post).toHaveBeenCalledWith(
      '/seats/lock',
      expect.any(Function), // authenticateUser
      expect.any(Function), // rate limiter
      mockBookingController.lockSeats
    );
  });

  it('should register /bookings/:bookingId/confirm route', () => {
    createUserRoutes(mockUserController, mockShowController, mockBookingController);

    expect(mockRouterInstance.post).toHaveBeenCalledWith(
      '/bookings/:bookingId/confirm',
      expect.any(Function), // authenticateUser
      mockBookingController.confirmBooking
    );
  });

  it('should register /bookings/:bookingId/cancel route', () => {
    createUserRoutes(mockUserController, mockShowController, mockBookingController);

    expect(mockRouterInstance.post).toHaveBeenCalledWith(
      '/bookings/:bookingId/cancel',
      expect.any(Function), // authenticateUser
      mockBookingController.cancelBooking
    );
  });

  it('should register /bookings route', () => {
    createUserRoutes(mockUserController, mockShowController, mockBookingController);

    expect(mockRouterInstance.get).toHaveBeenCalledWith(
      '/bookings',
      expect.any(Function), // authenticateUser
      mockBookingController.getUserBookings
    );
  });

  it('should register /bookings/:bookingId route', () => {
    createUserRoutes(mockUserController, mockShowController, mockBookingController);

    expect(mockRouterInstance.get).toHaveBeenCalledWith(
      '/bookings/:bookingId',
      expect.any(Function), // authenticateUser
      mockBookingController.getBookingById
    );
  });

  it('should return router instance', () => {
    const router = createUserRoutes(mockUserController, mockShowController, mockBookingController);

    expect(router).toBe(mockRouterInstance);
  });
});

