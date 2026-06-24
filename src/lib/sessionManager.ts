import { v4 as uuid } from 'uuid';
import { sessionRepository } from './repositories/sessionRepository';
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

export async function startSession(table_id: string, game_type: GameType) {
  const activeCount = await sessionRepository.findActiveCount();
  if (activeCount >= 4) {
    throw new ApiError(400, 'Maximum active sessions limit (4) reached.');
  }

  const existingSession = await sessionRepository.findActiveByTable(table_id);
  if (existingSession) {
    throw new ApiError(400, 'A session is already active for this table');
  }

  const now = new Date();
  const dateStr = toReadableDate(now);
  const timeStr = toReadableIST(now);
  const amPm = timeStr.includes('AM') ? 'AM' : 'PM';
  
  const session = {
    id: uuid(),
    table_id,
    game_type,
    start_time: `${dateStr}, ${timeStr}`,
    end_time: null,
    session_type: amPm,
    duration: null,
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
  const dateStr = toReadableDate(now);
  const timeStr = toReadableIST(now);
  const end_time = `${dateStr}, ${timeStr}`;
  
  const { duration, cost } = calculateBilling(session.start_time, end_time, session.game_type);

  await sessionRepository.update(session.id, {
    end_time,
    status: 'COMPLETED',
    duration,
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
      table_id: activeSession.table_id,
      game_type: activeSession.game_type,
      start_time: activeSession.start_time,
      session_type: activeSession.session_type,
    };
  }

  return {
    status: 'idle',
    table_id,
  };
}
