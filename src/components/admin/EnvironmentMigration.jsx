import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function EnvironmentMigration() {
  const [result, setResult] = useState(null);

  const migrateMutation = useMutation({
    mutationFn: async () => {
      const entities = [
        'Product', 
        'BOMItem', 
        'InventoryLedger', 
        'Batch', 
        'MixBatch', 
        'PackagingRecipe',
        'FillingReport',
        'InventoryAlert',
        'PlanningScenario',
        'BatchLot'
      ];
      
      const results = {};
      
      for (const entityName of entities) {
        try {
          const allItems = await base44.entities[entityName].list();
          const itemsWithoutEnv = allItems.filter(item => !item.environment);
          
          let updated = 0;
          for (const item of itemsWithoutEnv) {
            await base44.entities[entityName].update(item.id, { environment: 'production' });
            updated++;
          }
          
          results[entityName] = { total: allItems.length, updated };
        } catch (error) {
          results[entityName] = { error: error.message };
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      setResult(results);
      toast.success('Migration genomförd!');
    },
    onError: (error) => {
      toast.error('Migration misslyckades: ' + error.message);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Environment Migration
        </CardTitle>
        <CardDescription>
          Migrera befintlig data till production-miljö (endast för första gången)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            <p className="font-medium mb-2">Vad gör denna migration?</p>
            <ul className="text-sm space-y-1">
              <li>• Hittar all data som saknar environment-fält</li>
              <li>• Sätter environment="production" på denna data</li>
              <li>• Efter migration kommer sandbox att endast visa sandbox-data</li>
              <li>• Denna migration behöver endast köras EN gång</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Button
          onClick={() => migrateMutation.mutate()}
          disabled={migrateMutation.isPending}
        >
          {migrateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Migrerar...
            </>
          ) : (
            <>
              <Database className="w-4 h-4 mr-2" />
              Kör Migration
            </>
          )}
        </Button>

        {result && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <AlertDescription>
              <p className="font-medium text-green-800 mb-2">Migration slutförd!</p>
              <div className="text-sm space-y-1 text-green-700">
                {Object.entries(result).map(([entity, data]) => (
                  <div key={entity}>
                    {data.error ? (
                      <div>❌ {entity}: {data.error}</div>
                    ) : (
                      <div>✓ {entity}: {data.updated} av {data.total} uppdaterade</div>
                    )}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}