import { sessionRepository } from './src/lib/repositories/sessionRepository';

async function main() {
  const sessions = await sessionRepository.findAllByDateRange('2026-09-01', '2026-09-30', '1');
  console.log('Sessions count:', sessions.length);
}
main();
