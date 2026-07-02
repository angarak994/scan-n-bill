export interface SessionStatusData {
  status: 'ACTIVE' | 'COMPLETED' | string;
  last_activity_at: string;
}

export function isForgotten(session: SessionStatusData, idleThresholdMin: number = 20): boolean {
  if (session.status !== 'ACTIVE') return false;
  if (!session.last_activity_at) return false;
  
  const idleMinutes = (Date.now() - new Date(session.last_activity_at).getTime()) / 60000;
  return idleMinutes > idleThresholdMin;
}
