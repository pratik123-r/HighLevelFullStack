import React, { createContext, useContext, useState, useEffect } from 'react';
import { userAPI, adminAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userType, setUserType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user data exists in localStorage (from login response)
    const storedUser = localStorage.getItem('user');
    const storedUserType = localStorage.getItem('userType');

    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setUserType(storedUserType);
    }
    setLoading(false);
  }, []);

  const login = async (email, password, type = 'user') => {
    try {
      const response = type === 'admin' 
        ? await adminAPI.login({ email, password })
        : await userAPI.login({ email, password });

      // Token is now in HTTP-only cookie, we only store user data
      const userData = response.data;
      
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('userType', type);

      setUser(userData);
      setUserType(type);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const register = async (name, email, password, type = 'user') => {
    try {
      const response = type === 'admin'
        ? await adminAPI.register({ name, email, password })
        : await userAPI.register({ name, email, password });

      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || 'Registration failed' 
      };
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to clear cookie
      if (userType === 'admin') {
        await adminAPI.logout();
      } else {
        await userAPI.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state regardless
      localStorage.removeItem('user');
      localStorage.removeItem('userType');
      setUser(null);
      setUserType(null);
    }
  };

  const value = {
    user,
    userType,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin: userType === 'admin',
    isUser: userType === 'user',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

