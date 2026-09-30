export const PRICING_CONFIG = {
  starter: {
    monthly: 1999,
    tables: 5
  },
  professional: {
    monthly: 4999,
    tables: 999
  }
};

export interface CalculatorInputs {
  tables: number;
  sessionsPerDay: number;
  avgSessionPrice: number;
}

export interface CalculatorOutputs {
  monthlyRevenue: number;
  qcontrolPrice: number | null;
  costPercentage: number | null;
  costPerSession: number | null;
  sessionsToPay: number | null;
}

export function calculateROI(inputs: CalculatorInputs): CalculatorOutputs {
  const safeTables = Math.max(0, Math.min(100, isNaN(inputs.tables) ? 0 : inputs.tables));
  const safeSessions = Math.max(0, Math.min(100, isNaN(inputs.sessionsPerDay) ? 0 : inputs.sessionsPerDay));
  const safePrice = Math.max(0, Math.min(10000, isNaN(inputs.avgSessionPrice) ? 0 : inputs.avgSessionPrice));

  const monthlyRevenue = safeTables * safeSessions * safePrice * 30;
  
  let qcontrolPrice: number | null = null;
  if (safeTables === 0) {
    qcontrolPrice = 0;
  } else if (safeTables <= PRICING_CONFIG.starter.tables) {
    qcontrolPrice = PRICING_CONFIG.starter.monthly;
  } else if (safeTables <= PRICING_CONFIG.professional.tables) {
    qcontrolPrice = PRICING_CONFIG.professional.monthly;
  }

  let costPercentage: number | null = null;
  let costPerSession: number | null = null;
  let sessionsToPay: number | null = null;

  if (qcontrolPrice !== null && qcontrolPrice > 0) {
    if (monthlyRevenue > 0) {
      costPercentage = (qcontrolPrice / monthlyRevenue) * 100;
    }
    
    const totalSessionsMonth = safeTables * safeSessions * 30;
    if (totalSessionsMonth > 0) {
      costPerSession = qcontrolPrice / totalSessionsMonth;
    }

    if (safePrice > 0) {
      sessionsToPay = Math.ceil(qcontrolPrice / safePrice);
    }
  }

  return {
    monthlyRevenue,
    qcontrolPrice,
    costPercentage,
    costPerSession,
    sessionsToPay
  };
}
