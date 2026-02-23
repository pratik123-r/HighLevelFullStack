import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockGenerateToken = jest.fn();
const mockVerifyToken = jest.fn();
const mockExtractToken = jest.fn();
const mockExtractTokenFromHeader = jest.fn();

jest.unstable_mockModule('../../src/utils/jwt.js', () => ({
  generateToken: mockGenerateToken,
  verifyToken: mockVerifyToken,
  extractToken: mockExtractToken,
  extractTokenFromHeader: mockExtractTokenFromHeader,
}));

const { UserController } = await import('../../src/controllers/UserController.js');

describe('UserController', () => {
  let userController;
  let mockUserService;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserService = {
      createUser: jest.fn(),
      verifyCredentials: jest.fn(),
      getUserById: jest.fn(),
      getAllUsersPaginated: jest.fn(),
    };

    userController = new UserController(mockUserService);

    mockReq = {
      body: {},
      params: {},
      query: {},
      user: { id: 'user-123' },
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
    };
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };
      mockReq.body = userData;

      const createdUser = {
        id: 'user-123',
        ...userData,
        createdAt: new Date(),
      };
      mockUserService.createUser.mockResolvedValue(createdUser);

      await userController.register(mockReq, mockRes);

      expect(mockUserService.createUser).toHaveBeenCalledWith(userData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        createdAt: createdUser.createdAt,
      });
    });

    it('should return 400 when name is missing', async () => {
      mockReq.body = { email: 'test@example.com', password: 'password123' };

      await userController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Name, email, and password are required',
      });
      expect(mockUserService.createUser).not.toHaveBeenCalled();
    });

    it('should return 400 when email is missing', async () => {
      mockReq.body = { name: 'Test User', password: 'password123' };

      await userController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 when password is missing', async () => {
      mockReq.body = { name: 'Test User', email: 'test@example.com' };

      await userController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 409 when user already exists', async () => {
      mockReq.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };
      mockUserService.createUser.mockRejectedValue(
        new Error('User with this email already exists')
      );

      await userController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'User with this email already exists',
      });
    });

    it('should return 400 for other errors', async () => {
      mockReq.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };
      mockUserService.createUser.mockRejectedValue(new Error('Validation error'));

      await userController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };
      mockReq.body = loginData;

      const user = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: new Date(),
      };
      const token = 'jwt-token';

      mockUserService.verifyCredentials.mockResolvedValue(user);
      mockGenerateToken.mockReturnValue(token);

      await userController.login(mockReq, mockRes);

      expect(mockUserService.verifyCredentials).toHaveBeenCalledWith(
        loginData.email,
        loginData.password
      );
      expect(mockGenerateToken).toHaveBeenCalledWith({
        userId: user.id,
        email: user.email,
        type: 'user',
      });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'token',
        token,
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        })
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      });
    });

    it('should return 400 when email is missing', async () => {
      mockReq.body = { password: 'password123' };

      await userController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Email and password are required',
      });
    });

    it('should return 400 when password is missing', async () => {
      mockReq.body = { email: 'test@example.com' };

      await userController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 401 when credentials are invalid', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'wrong-password',
      };
      mockUserService.verifyCredentials.mockResolvedValue(null);

      await userController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid email or password',
      });
      expect(mockGenerateToken).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123',
      };
      mockUserService.verifyCredentials.mockRejectedValue(new Error('Database error'));

      await userController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getMyProfile', () => {
    it('should get user profile successfully', async () => {
      const user = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      };
      mockUserService.getUserById.mockResolvedValue(user);

      await userController.getMyProfile(mockReq, mockRes);

      expect(mockUserService.getUserById).toHaveBeenCalledWith('user-123');
      expect(mockRes.json).toHaveBeenCalledWith(user);
    });

    it('should return 404 when user not found', async () => {
      mockUserService.getUserById.mockRejectedValue(new Error('User not found'));

      await userController.getMyProfile(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'User not found',
      });
    });
  });

  describe('getUserById', () => {
    it('should get user by id successfully', async () => {
      const userId = 'user-123';
      mockReq.params = { id: userId };
      const user = {
        id: userId,
        name: 'Test User',
        email: 'test@example.com',
      };
      mockUserService.getUserById.mockResolvedValue(user);

      await userController.getUserById(mockReq, mockRes);

      expect(mockUserService.getUserById).toHaveBeenCalledWith(userId);
      expect(mockRes.json).toHaveBeenCalledWith(user);
    });

    it('should return 404 when user not found', async () => {
      mockReq.params = { id: 'invalid-id' };
      mockUserService.getUserById.mockRejectedValue(new Error('User not found'));

      await userController.getUserById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getAllUsers', () => {
    it('should get all users successfully', async () => {
      const users = [
        { id: 'user-1', name: 'User 1' },
        { id: 'user-2', name: 'User 2' },
      ];
      mockReq.query = { page: '1', limit: '10' };
      mockUserService.getAllUsersPaginated.mockResolvedValue({
        data: users,
        total: 2,
        page: 1,
        limit: 10,
      });

      await userController.getAllUsers(mockReq, mockRes);

      expect(mockUserService.getAllUsersPaginated).toHaveBeenCalledWith(1, 10);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      mockReq.query = {};
      mockUserService.getAllUsersPaginated.mockRejectedValue(new Error('Database error'));

      await userController.getAllUsers(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockRes.clearCookie = jest.fn().mockReturnThis();

      await userController.logout(mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('token');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });
  });
});

