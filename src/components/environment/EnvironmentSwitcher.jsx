import React from 'react';
import { useEnvironment } from './EnvironmentContext';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Building2 } from 'lucide-react';

export default function EnvironmentSwitcher() {
  const { environment, setEnvironment } = useEnvironment();

  const toggleEnvironment = () => {
    setEnvironment(environment === 'production' ? 'sandbox' : 'production');
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleEnvironment}
      className={environment === 'sandbox' ? 'border-amber-500 bg-amber-50 hover:bg-amber-100' : ''}
    >
      {environment === 'production' ? (
        <>
          <Building2 className="w-4 h-4 mr-2" />
          Produktion
        </>
      ) : (
        <>
          <FlaskConical className="w-4 h-4 mr-2" />
          Sandbox
        </>
      )}
    </Button>
  );
}