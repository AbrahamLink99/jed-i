import React, { createContext, useContext, useState, useEffect } from 'react';

const EnvironmentContext = createContext();

export function EnvironmentProvider({ children }) {
  const [environment, setEnvironment] = useState(() => {
    return localStorage.getItem('app_environment') || 'production';
  });

  useEffect(() => {
    localStorage.setItem('app_environment', environment);
  }, [environment]);

  return (
    <EnvironmentContext.Provider value={{ environment, setEnvironment }}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (!context) {
    throw new Error('useEnvironment must be used within EnvironmentProvider');
  }
  return context;
}