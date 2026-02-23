import React, { createContext, useContext, useState, useEffect } from 'react';

const EnvironmentContext = createContext();

const getInitialEnvironment = () => {
  try {
    const url = new URL(window.location.href);
    const param = (url.searchParams.get('env') || '').toLowerCase();
    if (param === 'production' || param === 'sandbox') return param; // explicit override via URL
  } catch {}
  const stored = localStorage.getItem('app_environment');
  if (stored === 'production' || stored === 'sandbox') return stored; // honor previous user choice
  try {
    const host = window.location.host.toLowerCase();
    if (host.includes('sandbox')) return 'sandbox'; // final fallback based on host naming
  } catch {}
  return 'production';
};

export function EnvironmentProvider({ children }) {
  const [environment, setEnvironment] = useState(getInitialEnvironment);

  useEffect(() => {
    localStorage.setItem('app_environment', environment);
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
    throw new Error('useEnvironment must be used within EnvironmentProvider');
  }
  return context;
}