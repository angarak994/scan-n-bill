import { v4 as uuid } from 'uuid';
import { sessionRepository, Session } from './repositories/sessionRepository';
import { getPricing, GameType } from './pricing';
import { calculateBilling } from './billing';

function toReadableIST(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
  return formatter.format(date).replace(' am', ' AM').replace(' pm', ' PM');
}

function toReadableDate(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric'
  });
  return formatter.format(date);
}

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function startSession(table_id: string, game_type: GameType, customer_name: string) {
  const activeCount = await sessionRepository.findActiveCount();
  if (activeCount >= 4) {
    throw new ApiError(400, 'Maximum active sessions limit (4) reached.');
  }

  const existingSession = await sessionRepository.findActiveByTable(table_id);
  if (existingSession) {
    throw new ApiError(400, 'A session is already active for this table');
  }

  if (!customer_name || customer_name.trim() === '') {
    throw new ApiError(400, 'Customer Name is mandatory');
  }

  const now = new Date();
  const dateStr = toReadableDate(now);
  const timeStr = toReadableIST(now);
  
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

  await sessionRepository.create(session);
  return session;
}

export async function endSession(table_id: string) {
  const session = await sessionRepository.findActiveByTable(table_id);
  if (!session || !session.id) {
    throw new ApiError(404, 'No active session found for this table');
  }

  const now = new Date();
  const timeStr = toReadableIST(now);
  const end_time = timeStr;
  
  const startFull = `${session.date}, ${session.start_time}`;
  const endFull = `${toReadableDate(now)}, ${end_time}`;
  
  const { duration, cost, slabs_applied } = calculateBilling(startFull, endFull, session.game_type, session.table_id);

  await sessionRepository.update(session.id, {
    end_time,
    status: 'COMPLETED',
    duration,
    applied_pricing: slabs_applied,
    cost,
  });

  return { duration, cost, end_time };
}

export async function getTableStatus(table_id: string) {
  const activeSession = await sessionRepository.findActiveByTable(table_id);
  if (activeSession) {
    return {
      status: 'active',
      id: activeSession.id,
      date: activeSession.date,
      customer_name: activeSession.customer_name,
      table_id: activeSession.table_id,
      game_type: activeSession.game_type,
      start_time: activeSession.start_time,
    };
  }

  return {
    status: 'idle',
    table_id,
  };
}
