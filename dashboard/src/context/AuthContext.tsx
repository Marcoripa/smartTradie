'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '../types/auth';
import { api } from '../lib/api';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAdmin: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<User>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initSession = useCallback(async () => {
    try {
      const savedToken = api.getToken();
      const savedUser = api.getCurrentUser();

      if (savedToken && savedUser) {
        try {
          const bizProfile = await api.getBusinessProfile();
          if (bizProfile?.business_name) {
            savedUser.business_name = bizProfile.business_name;
          }
        } catch {}
        setUser(savedUser);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('[AuthProvider] Session initialization notice:', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const login = async (email: string, password?: string): Promise<User> => {
    setIsLoading(true);
    try {
      const response = await api.login(email, password);
      setUser(response.user);
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
  };

  const switchRole = async (newRole: UserRole) => {
    if (user) {
      const updated = { ...user, role: newRole };
      setUser(updated);
      api.setCurrentUser(updated);
    }
  };

  const role: UserRole = user?.role || 'USER';
  const isAdmin = role === 'ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isAdmin,
        isLoading,
        login,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
