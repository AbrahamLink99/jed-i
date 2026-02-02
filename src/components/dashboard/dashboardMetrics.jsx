/**
 * Dashboard Metrics Data Source
 * 
 * TODO: Replace mock data with real calculations from:
 * - InventoryLedger
 * - Batch
 * - Product (safety_stock, lead_time)
 * - PlanningScenario
 * - InventoryAlert
 */

// Helper to generate trend data
const generateTrendData = (days, baseValue, variance) => {
  const data = [];
  let value = baseValue;
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Add some randomness
    value = value + (Math.random() - 0.5) * variance;
    value = Math.max(0, Math.min(100, value)); // Clamp between 0-100
    
    data.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(value * 10) / 10
    });
  }
  
  return data;
};

// Helper for plan vs actual data
const generatePlanVsActual = (days) => {
  const data = [];
  
  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const plan = 80 + Math.random() * 40;
    const actual = plan + (Math.random() - 0.5) * 20;
    
    data.push({
      date: date.toISOString().split('T')[0],
      plan: Math.round(plan),
      actual: Math.round(actual)
    });
  }
  
  return data;
};

// Helper for deviation distribution
const generateDeviationDistribution = () => {
  return [
    { range: '-7+ dagar', count: 2 },
    { range: '-4 till -6', count: 5 },
    { range: '-1 till -3', count: 12 },
    { range: 'På plan', count: 45 },
    { range: '+1 till +3', count: 18 },
    { range: '+4 till +6', count: 8 },
    { range: '+7+ dagar', count: 3 }
  ];
};

/**
 * Get dashboard metrics for a given period
 * @param {number} days - Number of days to analyze (7, 30, 90)
 * @param {string} environment - 'production' or 'sandbox'
 * @returns {object} Dashboard metrics
 */
export const getDashboardMetrics = (days = 30, environment = 'production') => {
  // TODO: Fetch real data based on environment filter
  
  // Mock KPI calculations
  const kpis = {
    planningPrecision: {
      value: 87.5,
      trend: 'up',
      delta: 2.3,
      description: 'Andel produktionsplaner som följs ±2 dagar'
    },
    inventoryStability: {
      value: 92.1,
      trend: 'up',
      delta: 1.8,
      description: 'Andel tid inom säkerhetsmarginaler'
    },
    purchasePrecision: {
      value: 78.3,
      trend: 'down',
      delta: -3.2,
      description: 'Inköpsorder som levereras i tid'
    },
    deliveryFlow: {
      value: 94.7,
      trend: 'neutral',
      delta: 0.1,
      description: 'Order som skickas inom SLA'
    }
  };

  // Mock trend data
  const trends = {
    inventoryStability: generateTrendData(days, 90, 5),
    planVsActual: generatePlanVsActual(days)
  };

  // Mock distribution data
  const distributions = {
    planDeviation: generateDeviationDistribution(),
    inventoryIssues: {
      belowSafety: 8.2,
      aboveMax: 3.1,
      avgTimeInRisk: 2.4, // days
      totalProducts: 120,
      productsAtRisk: 14
    }
  };

  // Mock root causes
  const rootCauses = [
    {
      id: 1,
      cause: 'För sen inköpssignal',
      percentage: 34.2,
      trend: 'up',
      count: 12,
      examples: [
        { date: '2026-01-28', product: 'Hyaluronsyra', impact: 'Produktionsstopp 3 dagar' },
        { date: '2026-01-25', product: 'Aloe Vera Extract', impact: 'Försenad leverans' },
        { date: '2026-01-20', product: 'Glycerin', impact: 'Nödleverans från alternativ leverantör' }
      ]
    },
    {
      id: 2,
      cause: 'Felaktig prognos',
      percentage: 28.7,
      trend: 'down',
      count: 10,
      examples: [
        { date: '2026-01-30', product: 'Face Cream Luxury', impact: 'Överberedning 45 kg' },
        { date: '2026-01-22', product: 'Night Serum', impact: 'Underberedning 25 units' }
      ]
    },
    {
      id: 3,
      cause: 'Manuell planändring',
      percentage: 22.1,
      trend: 'neutral',
      count: 8,
      examples: [
        { date: '2026-01-29', product: 'Body Lotion', impact: 'Batch flyttad 2 dagar' },
        { date: '2026-01-24', product: 'Lip Balm', impact: 'Prioritering ändrad' }
      ]
    },
    {
      id: 4,
      cause: 'Leverantörsförsening',
      percentage: 15.0,
      trend: 'up',
      count: 5,
      examples: [
        { date: '2026-01-27', product: 'Shea Butter', impact: '5 dagars försening' },
        { date: '2026-01-18', product: 'Essential Oil Mix', impact: '3 dagars försening' }
      ]
    }
  ];

  return {
    kpis,
    trends,
    distributions,
    rootCauses,
    metadata: {
      period: days,
      environment,
      generatedAt: new Date().toISOString()
    }
  };
};

/**
 * TODO: Real data integration functions
 */

// Calculate planning precision from Batch and PlanningScenario
export const calculatePlanningPrecision = async (days, environment) => {
  // const batches = await base44.entities.Batch.filter({ environment });
  // const scenarios = await base44.entities.PlanningScenario.filter({ environment });
  // Calculate deviation between planned_date and actual production_date
  // Return percentage within ±2 days tolerance
  return 87.5;
};

// Calculate inventory stability from InventoryLedger
export const calculateInventoryStability = async (days, environment) => {
  // const ledger = await base44.entities.InventoryLedger.filter({ environment });
  // const products = await base44.entities.Product.filter({ environment });
  // For each product, check if available stock stays within safety_stock boundaries
  // Return percentage of time within margins
  return 92.1;
};

// Calculate purchase precision from InventoryAlert acknowledgements
export const calculatePurchasePrecision = async (days, environment) => {
  // const alerts = await base44.entities.InventoryAlert.filter({ 
  //   environment, 
  //   status: 'ORDERED_ACKNOWLEDGED' 
  // });
  // Compare need_by_date with actual delivery (when status changed to CLOSED)
  // Return percentage delivered on time
  return 78.3;
};

// Calculate delivery flow from BatchOrderLink
export const calculateDeliveryFlow = async (days, environment) => {
  // const links = await base44.entities.BatchOrderLink.filter({ environment });
  // Check if orders were linked to batches within expected timeframe
  // Return percentage meeting SLA
  return 94.7;
};