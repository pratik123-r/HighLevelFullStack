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

const { AdminController } = await import('../../src/controllers/AdminController.js');

describe('AdminController', () => {
  let adminController;
  let mockAdminService;
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAdminService = {
      createAdmin: jest.fn(),
      verifyCredentials: jest.fn(),
      getAdminById: jest.fn(),
      getAllAdminsPaginated: jest.fn(),
    };

    adminController = new AdminController(mockAdminService);

    mockReq = {
      body: {},
      params: {},
      query: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis(),
    };
  });

  describe('register', () => {
    it('should register admin successfully', async () => {
      const adminData = {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123',
      };
      mockReq.body = adminData;

      const createdAdmin = {
        id: 'admin-123',
        ...adminData,
        createdAt: new Date(),
      };
      mockAdminService.createAdmin.mockResolvedValue(createdAdmin);

      await adminController.register(mockReq, mockRes);

      expect(mockAdminService.createAdmin).toHaveBeenCalledWith(adminData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        id: createdAdmin.id,
        name: createdAdmin.name,
        email: createdAdmin.email,
        createdAt: createdAdmin.createdAt,
      });
    });

    it('should return 400 when required fields are missing', async () => {
      mockReq.body = { email: 'admin@example.com' };

      await adminController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockAdminService.createAdmin).not.toHaveBeenCalled();
    });

    it('should return 409 when admin already exists', async () => {
      mockReq.body = {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123',
      };
      mockAdminService.createAdmin.mockRejectedValue(
        new Error('Admin with this email already exists')
      );

      await adminController.register(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(409);
    });
  });

  describe('login', () => {
    it('should login admin successfully', async () => {
      const loginData = {
        email: 'admin@example.com',
        password: 'password123',
      };
      mockReq.body = loginData;

      const admin = {
        id: 'admin-123',
        name: 'Admin User',
        email: 'admin@example.com',
        createdAt: new Date(),
      };
      const token = 'jwt-token';

      mockAdminService.verifyCredentials.mockResolvedValue(admin);
      mockGenerateToken.mockReturnValue(token);

      await adminController.login(mockReq, mockRes);

      expect(mockGenerateToken).toHaveBeenCalledWith({
        adminId: admin.id,
        email: admin.email,
        type: 'admin',
      });
      expect(mockRes.cookie).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 401 when credentials are invalid', async () => {
      mockReq.body = {
        email: 'admin@example.com',
        password: 'wrong-password',
      };
      mockAdminService.verifyCredentials.mockResolvedValue(null);

      await adminController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid email or password',
      });
    });
  });

  describe('getAdminById', () => {
    it('should get admin by id successfully', async () => {
      const adminId = 'admin-123';
      mockReq.params = { id: adminId };
      const admin = { id: adminId, name: 'Admin User' };
      mockAdminService.getAdminById.mockResolvedValue(admin);

      await adminController.getAdminById(mockReq, mockRes);

      expect(mockAdminService.getAdminById).toHaveBeenCalledWith(adminId);
      expect(mockRes.json).toHaveBeenCalledWith(admin);
    });

    it('should return 404 when admin not found', async () => {
      mockReq.params = { id: 'invalid-id' };
      mockAdminService.getAdminById.mockRejectedValue(new Error('Admin not found'));

      await adminController.getAdminById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });
  });

  describe('getAllAdmins', () => {
    it('should get all admins successfully', async () => {
      mockReq.query = { page: '1', limit: '10' };
      mockAdminService.getAllAdminsPaginated.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });

      await adminController.getAllAdmins(mockReq, mockRes);

      expect(mockAdminService.getAllAdminsPaginated).toHaveBeenCalledWith(1, 10);
      expect(mockRes.json).toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      await adminController.logout(mockReq, mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('token');
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Logged out successfully',
      });
    });
  });
});

