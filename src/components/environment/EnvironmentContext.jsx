import React, { createContext, useContext } from 'react';

const EnvironmentContext = createContext({ environment: 'production', setEnvironment: () => {} });

export function EnvironmentProvider({ children }) {
  return (
    <EnvironmentContext.Provider value={{ environment: 'production', setEnvironment: () => {} }}>
      {children}
    </EnvironmentContext.Provider>
  );
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  return context || { environment: 'production', setEnvironment: () => {} };
}