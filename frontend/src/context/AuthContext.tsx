import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

export interface IBusinessProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  plan: 'free' | 'starter' | 'pro';
  trialEndsAt?: string | null;
  whatsappNumber?: string;
  whatsappPhoneId?: string;
  aiEnabled?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  business: IBusinessProfile | null;
  loading: boolean;
  login: (token: string, business: IBusinessProfile) => void;
  logout: () => void;
  updateBusiness: (business: Partial<IBusinessProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [business, setBusiness] = useState<IBusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage on mount
    const storedToken = localStorage.getItem('token');
    const storedBusiness = localStorage.getItem('business');
    if (storedToken && storedBusiness) {
      setToken(storedToken);
      try {
        setBusiness(JSON.parse(storedBusiness));
      } catch (err) {
        console.error('Failed to parse business info from localStorage', err);
        localStorage.removeItem('business');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = (newToken: string, newBusiness: IBusinessProfile) => {
    setToken(newToken);
    setBusiness(newBusiness);
    localStorage.setItem('token', newToken);
    localStorage.setItem('business', JSON.stringify(newBusiness));
  };

  const logout = () => {
    setToken(null);
    setBusiness(null);
    localStorage.removeItem('token');
    localStorage.removeItem('business');
  };

  const updateBusiness = (updatedFields: Partial<IBusinessProfile>) => {
    setBusiness((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      localStorage.setItem('business', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token,
        token,
        business,
        loading,
        login,
        logout,
        updateBusiness
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
