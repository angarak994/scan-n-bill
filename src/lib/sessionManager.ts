import { v4 as uuid } from 'uuid';
import { sessionRepository } from './repositories/sessionRepository';
import { getPricing, GameType } from './pricing';
import { calculateBilling } from './billing';

function toReadableIST(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  });
  return formatter.format(date).replace(' am', ' AM').replace(' pm', ' PM') + ' +0530';
}

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const MAX_CONCURRENT_SESSIONS = 10;

export async function startSession(table_id: string, game_type: GameType) {
  // Check if this table already has an active session
  const existingActive = await sessionRepository.findActiveByTable(table_id);
  if (existingActive) {
    return { ...existingActive, isExisting: true }; // Prevent duplicates
  }

  // Check the maximum concurrent sessions limit
  const activeCount = await sessionRepository.findActiveCount();
  if (activeCount >= MAX_CONCURRENT_SESSIONS) {
    throw new ApiError(429, `System limit reached: Maximum ${MAX_CONCURRENT_SESSIONS} concurrent sessions allowed.`);
  }

  const { session_type, rate_per_hour } = getPricing(game_type);

  const session = {
    id: uuid(),
    table_id,
    game_type,
    start_time: toReadableIST(new Date()),
    end_time: null,
    session_type,
    rate_per_hour,
    duration: null,
    cost: null,
    status: 'ACTIVE' as const,
  };

  await sessionRepository.create(session);
  return { ...session, isExisting: false };
}

export async function endSession(table_id: string) {
  const session = await sessionRepository.findActiveByTable(table_id);
  if (!session || !session.id) {
    throw new ApiError(404, 'No active session found for this table');
  }

  const end_time = toReadableIST(new Date());
  const { duration, cost } = calculateBilling(session.start_time, end_time, session.game_type);

  await sessionRepository.update(session.id, {
    end_time,
    status: 'COMPLETED',
    duration,
    cost,
  });

  return { 
    id: session.id,
    duration, 
    cost,
    end_time
  };
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
      rate_per_hour: activeSession.rate_per_hour,
    };
  }

  return {
    status: 'idle',
    table_id,
  };
}
