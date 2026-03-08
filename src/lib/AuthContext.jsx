import React, { createContext, useState, useContext } from 'react';

// This app uses wallet-based auth (authWallet function + localStorage).
// Base44 platform auth is not used. This is a stub that satisfies all
// imports of useAuth / AuthProvider throughout the codebase.

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated] = useState(false);
  const [isLoadingAuth] = useState(false);
  const [isLoadingPublicSettings] = useState(false);
  const [authError] = useState(null);
  const [appPublicSettings] = useState(null);

  const logout = () => { setUser(null); };
  const navigateToLogin = () => {};
  const checkAppState = () => {};

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
