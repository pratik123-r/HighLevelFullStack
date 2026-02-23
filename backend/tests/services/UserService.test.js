import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockHashPassword = jest.fn();
const mockVerifyPassword = jest.fn();

// Mock the password utils module using unstable_mockModule for ES modules
jest.unstable_mockModule('../../src/utils/password.js', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
}));

const { UserService } = await import('../../src/services/UserService.js');

describe('UserService', () => {
  let userService;
  let mockUserRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset password mocks
    mockHashPassword.mockReset();
    mockVerifyPassword.mockReset();

    mockUserRepository = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findAllPaginated: jest.fn(),
    };

    userService = new UserService(mockUserRepository);
  });

  describe('createUser', () => {
    it('should create user successfully', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      const hashedPassword = 'hashed-password';
      const salt = 'salt-value';

      mockHashPassword.mockResolvedValue({ hash: hashedPassword, salt });
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: 'user-123',
        ...userData,
        password: hashedPassword,
        salt,
      });

      const result = await userService.createUser(userData);

      expect(result).toHaveProperty('id');
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockHashPassword).toHaveBeenCalledWith(userData.password);
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
        salt,
      });
    });

    it('should throw error when name is missing', async () => {
      await expect(
        userService.createUser({
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Name, email, and password are required');
    });

    it('should throw error when email is missing', async () => {
      await expect(
        userService.createUser({
          name: 'Test User',
          password: 'password123',
        })
      ).rejects.toThrow('Name, email, and password are required');
    });

    it('should throw error when password is missing', async () => {
      await expect(
        userService.createUser({
          name: 'Test User',
          email: 'test@example.com',
        })
      ).rejects.toThrow('Name, email, and password are required');
    });

    it('should throw error when user already exists', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      mockUserRepository.findByEmail.mockResolvedValue({ id: 'existing-user' });

      await expect(userService.createUser(userData)).rejects.toThrow(
        'User with this email already exists'
      );
    });
  });

  describe('verifyCredentials', () => {
    it('should return user when credentials are valid', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const user = {
        id: 'user-123',
        name: 'Test User',
        email,
        password: 'hashed-password',
        salt: 'salt-value',
      };

      mockUserRepository.findByEmail.mockResolvedValue(user);
      mockVerifyPassword.mockResolvedValue(true);

      const result = await userService.verifyCredentials(email, password);

      expect(result).toHaveProperty('id', user.id);
      expect(result).toHaveProperty('name', user.name);
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('salt');
      expect(mockVerifyPassword).toHaveBeenCalledWith(password, user.password);
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const result = await userService.verifyCredentials('test@example.com', 'password123');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      const user = {
        id: 'user-123',
        email: 'test@example.com',
        password: 'hashed-password',
      };

      mockUserRepository.findByEmail.mockResolvedValue(user);
      mockVerifyPassword.mockResolvedValue(false);

      const result = await userService.verifyCredentials('test@example.com', 'wrong-password');

      expect(result).toBeNull();
    });

    it('should throw error when email is missing', async () => {
      await expect(userService.verifyCredentials('', 'password123')).rejects.toThrow(
        'Email and password are required'
      );
    });

    it('should throw error when password is missing', async () => {
      await expect(userService.verifyCredentials('test@example.com', '')).rejects.toThrow(
        'Email and password are required'
      );
    });
  });

  describe('getUserById', () => {
    it('should return user without password and salt', async () => {
      const userId = 'user-123';
      const user = {
        id: userId,
        name: 'Test User',
        email: 'test@example.com',
        password: 'hashed-password',
        salt: 'salt-value',
      };

      mockUserRepository.findById.mockResolvedValue(user);

      const result = await userService.getUserById(userId);

      expect(result).toHaveProperty('id', userId);
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('salt');
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.getUserById('invalid-id')).rejects.toThrow('User not found');
    });
  });

  describe('getAllUsersPaginated', () => {
    it('should get paginated users without passwords', async () => {
      const users = [
        {
          id: 'user-1',
          name: 'User 1',
          email: 'user1@example.com',
          password: 'hash1',
          salt: 'salt1',
        },
        {
          id: 'user-2',
          name: 'User 2',
          email: 'user2@example.com',
          password: 'hash2',
          salt: 'salt2',
        },
      ];

      mockUserRepository.findAllPaginated.mockResolvedValue({
        data: users,
        total: 2,
      });

      const result = await userService.getAllUsersPaginated(1, 10);

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
      mockUserRepository.findAllPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      await userService.getAllUsersPaginated(2, 10);

      expect(mockUserRepository.findAllPaginated).toHaveBeenCalledWith(10, 10);
    });

    it('should use default pagination values', async () => {
      mockUserRepository.findAllPaginated.mockResolvedValue({
        data: [],
        total: 0,
      });

      await userService.getAllUsersPaginated();

      expect(mockUserRepository.findAllPaginated).toHaveBeenCalledWith(0, 10);
    });
  });
});

