import { useEnvironment } from './EnvironmentContext';

/**
 * Hook to get environment filter for queries
 * Usage: const envFilter = useEnvironmentFilter();
 * Then: base44.entities.Product.filter(envFilter)
 */
export function useEnvironmentFilter() {
  const { environment } = useEnvironment();
  return { environment };
}