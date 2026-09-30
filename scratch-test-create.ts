import { sessionRepository } from './src/lib/repositories/sessionRepository';
import { v4 as uuid } from 'uuid';

async function run() {
  try {
    await sessionRepository.create({
      id: uuid(),
      date: '27 Sep 2026',
      customer_name: 'Test',
      table_id: 'T1',
      game_type: 'pool',
      start_time: new Date().toISOString(),
      end_time: null,
      duration: null,
      applied_pricing: null,
      cost: null,
      status: 'ACTIVE',
    }, '1e5e0cf0-388a-4424-b153-f14d11cfc679'); // This is a fake business ID, should fail with FK violation
  } catch (e) {
    console.error(e);
  }
}
run();
