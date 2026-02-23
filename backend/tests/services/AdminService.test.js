import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockHashPassword = jest.fn();
const mockVerifyPassword = jest.fn();

// Mock the password utils module using unstable_mockModule for ES modules
jest.unstable_mockModule('../../src/utils/password.js', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
}));

const { AdminService } = await import('../../src/services/AdminService.js');

describe('AdminService', () => {
  let adminService;
  let mockAdminRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset password mocks
    mockHashPassword.mockReset();
    mockVerifyPassword.mockReset();

    mockAdminRepository = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findAllPaginated: jest.fn(),
    };

    adminService = new AdminService(mockAdminRepository);
  });

  describe('createAdmin', () => {
    it('should create admin successfully', async () => {
      const adminData = {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123',
      };

      const hashedPassword = 'hashed-password';
      const salt = 'salt-value';

      mockHashPassword.mockResolvedValue({ hash: hashedPassword, salt });
      mockAdminRepository.findByEmail.mockResolvedValue(null);
      mockAdminRepository.create.mockResolvedValue({
        id: 'admin-123',
        ...adminData,
        password: hashedPassword,
        salt,
      });

      const result = await adminService.createAdmin(adminData);

      expect(result).toHaveProperty('id');
      expect(mockAdminRepository.findByEmail).toHaveBeenCalledWith(adminData.email);
      expect(mockHashPassword).toHaveBeenCalledWith(adminData.password);
      expect(mockAdminRepository.create).toHaveBeenCalledWith({
        name: adminData.name,
        email: adminData.email,
        password: hashedPassword,
        salt,
      });
    });

    it('should throw error when name is missing', async () => {
      await expect(
        adminService.createAdmin({
          email: 'admin@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Name, email, and password are required');
    });

    it('should throw error when email is missing', async () => {
      await expect(
        adminService.createAdmin({
          name: 'Admin User',
          password: 'password123',
        })
      ).rejects.toThrow('Name, email, and password are required');
    });

    it('should throw error when password is missing', async () => {
      await expect(
        adminService.createAdmin({
          name: 'Admin User',
          email: 'admin@example.com',
        })
      ).rejects.toThrow('Name, email, and password are required');
    });

    it('should throw error when admin already exists', async () => {
      const adminData = {
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123',
      };

      mockAdminRepository.findByEmail.mockResolvedValue({ id: 'existing-admin' });

      await expect(adminService.createAdmin(adminData)).rejects.toThrow(
        'Admin with this email already exists'
      );
    });
  });

  describe('verifyCredentials', () => {
    it('should return admin when credentials are valid', async () => {
      const email = 'admin@example.com';
      const password = 'password123';
      const admin = {
        id: 'admin-123',
        name: 'Admin User',
        email,
        password: 'hashed-password',
        salt: 'salt-value',
      };

      mockAdminRepository.findByEmail.mockResolvedValue(admin);
      mockVerifyPassword.mockResolvedValue(true);

      const result = await adminService.verifyCredentials(email, password);

      expect(result).toHaveProperty('id', admin.id);
      expect(result).toHaveProperty('name', admin.name);
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('salt');
      expect(mockVerifyPassword).toHaveBeenCalledWith(password, admin.password);
    });

    it('should return null when admin not found', async () => {
      mockAdminRepository.findByEmail.mockResolvedValue(null);

      const result = await adminService.verifyCredentials('admin@example.com', 'password123');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      const admin = {
        id: 'admin-123',
        email: 'admin@example.com',
        password: 'hashed-password',
      };

      mockAdminRepository.findByEmail.mockResolvedValue(admin);
      mockVerifyPassword.mockResolvedValue(false);

      const result = await adminService.verifyCredentials('admin@example.com', 'wrong-password');

      expect(result).toBeNull();
    });

    it('should throw error when email is missing', async () => {
      await expect(adminService.verifyCredentials('', 'password123')).rejects.toThrow(
        'Email and password are required'
      );
    });

    it('should throw error when password is missing', async () => {
      await expect(adminService.verifyCredentials('admin@example.com', '')).rejects.toThrow(
        'Email and password are required'
      );
    });
  });

  describe('getAdminById', () => {
    it('should return admin without password and salt', async () => {
      const adminId = 'admin-123';
      const admin = {
        id: adminId,
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'hashed-password',
        salt: 'salt-value',
      };

      mockAdminRepository.findById.mockResolvedValue(admin);

      const result = await adminService.getAdminById(adminId);

      expect(result).toHaveProperty('id', adminId);
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('salt');
    });

    it('should throw error when admin not found', async () => {
      mockAdminRepository.findById.mockResolvedValue(null);

      await expect(adminService.getAdminById('invalid-id')).rejects.toThrow('Admin not found');
    });
  });

  describe('getAllAdminsPaginated', () => {
    it('should get paginated admins without passwords', async () => {
      const admins = [
        {
          id: 'admin-1',
          name: 'Admin 1',
          email: 'admin1@example.com',
          password: 'hash1',
          salt: 'salt1',
        },
        {
          id: 'admin-2',
          name: 'Admin 2',
          email: 'admin2@example.com',
          password: 'hash2',
          salt: 'salt2',
        },
      ];

      mockAdminRepository.findAllPaginated.mockResolvedValue({
        data: admins,
        total: 2,
      });

      const result = await adminService.getAllAdminsPaginated(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.data[0]).not.toHaveProperty('salt');
      expect(result.data[1]).not.toHaveProperty('password');
      expect(result.data[1]).not.toHaveProperty('salt');
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should calculate skip correctly', async () => {
      mockAdminRepository.findAllPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      await adminService.getAllAdminsPaginated(2, 10);

      expect(mockAdminRepository.findAllPaginated).toHaveBeenCalledWith(10, 10);
    });

    it('should use default pagination values', async () => {
      mockAdminRepository.findAllPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      await adminService.getAllAdminsPaginated();

      expect(mockAdminRepository.findAllPaginated).toHaveBeenCalledWith(0, 10);
    });
  });
});

