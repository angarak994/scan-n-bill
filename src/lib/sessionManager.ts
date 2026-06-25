import { v4 as uuid } from 'uuid';
import { sessionRepository, Session } from './repositories/sessionRepository';
import { GameType } from './pricing';
import { calculateBilling } from './billing';
import { businessManager } from './businessManager';

// Use ISO strings for robust time storage

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function startSession(table_id: string, game_type: GameType, customer_name: string, businessId?: string) {
  const existingSession = await sessionRepository.findActiveByTable(table_id, businessId);
  if (existingSession) {
    throw new ApiError(400, 'A session is already active for this table');
  }

  if (!customer_name || customer_name.trim() === '') {
    throw new ApiError(400, 'Customer Name is mandatory');
  }

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeStr = now.toISOString(); // Full ISO timestamp
  
  const session: Session = {
    id: uuid(),
    date: dateStr,
    customer_name: customer_name.trim(),
    table_id,
    game_type,
    start_time: timeStr,
    end_time: null,
    duration: null,
    applied_pricing: null,
    cost: null,
    status: 'ACTIVE' as const,
  };

  await sessionRepository.create(session, businessId);
  return session;
}

export async function endSession(table_id: string, businessId?: string) {
  const session = await sessionRepository.findActiveByTable(table_id, businessId);
  if (!session || !session.id) {
    throw new ApiError(404, 'No active session found for this table');
  }

  const now = new Date();
  const timeStr = now.toISOString();
  const end_time = timeStr;
  
  const startFull = session.start_time;
  const endFull = end_time;
  
  let pricingRules;
  if (businessId) {
    const business = await businessManager.getBusiness(businessId);
    pricingRules = business?.pricing_rules;
  }
  
  const { duration, cost, slabs_applied } = calculateBilling(startFull, endFull, session.game_type, pricingRules);

  await sessionRepository.update(session.id, {
    end_time,
    status: 'COMPLETED',
    duration,
    applied_pricing: slabs_applied,
    cost,
  }, businessId);

  return { duration, cost, end_time };
}

export async function getTableStatus(table_id: string, businessId?: string) {
  const activeSession = await sessionRepository.findActiveByTable(table_id, businessId);
  if (activeSession) {
    let pricingRules;
    if (businessId) {
      const business = await businessManager.getBusiness(businessId);
      pricingRules = business?.pricing_rules;
    }

    return {
      status: 'active',
      id: activeSession.id,
      date: activeSession.date,
      customer_name: activeSession.customer_name,
      table_id: activeSession.table_id,
      game_type: activeSession.game_type,
      start_time: activeSession.start_time,
      pricingRules,
    };
  }

  let pricingRules;
  if (businessId) {
    const business = await businessManager.getBusiness(businessId);
    pricingRules = business?.pricing_rules;
  }

  return {
    status: 'idle',
    table_id,
    pricingRules,
  };
}
