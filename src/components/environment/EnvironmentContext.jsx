import React, { createContext, useContext, useState, useEffect } from 'react';

const EnvironmentContext = createContext();

const getInitialEnvironment = () => 'production';

export function EnvironmentProvider({ children }) {
  const [environment, setEnvironment] = useState(getInitialEnvironment);

  useEffect(() => {
    localStorage.setItem('app_environment', environment);
  }, [environment]);

  useEffect(() => {
    if (environment !== 'production') setEnvironment('production');
  }, [environment]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'app_environment' && e.newValue && e.newValue !== environment) {
        setEnvironment(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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
    // Fallback to a safe default so the app never crashes if the provider isn't mounted yet
    return { environment: 'production', setEnvironment: () => {} };
  }
  return context;
}