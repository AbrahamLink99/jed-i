import React from 'react';
import { useEnvironment } from './EnvironmentContext';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FlaskConical } from 'lucide-react';

export default function EnvironmentBanner() {
  const { environment } = useEnvironment();

  if (environment === 'production') {
    return null;
  }

  return (
    <Alert className="border-amber-500 bg-amber-50 mb-4">
      <FlaskConical className="w-4 h-4 text-amber-600" />
      <AlertDescription className="text-amber-800 font-medium">
        Du är i <strong>SANDBOX-läge</strong> - alla ändringar här påverkar inte produktionsdata
      </AlertDescription>
    </Alert>
  );
}