'use client';

import { useEffect, useState } from 'react';
import { calculateBilling } from '@/lib/billing';

interface SessionData {
  id: string;
  date: string;
  customer_name: string;
  table_id: string;
  game_type: string;
  start_time: string;
  end_time: string | null;
  duration: string | null;
  applied_pricing: string | null;
  cost: number | null;
  status: 'ACTIVE' | 'COMPLETED';
}

function toReadableIST(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
  return formatter.format(date).replace(' am', ' AM').replace(' pm', ' PM');
}

export default function Dashboard() {
  const [data, setData] = useState<{ activeSessions: SessionData[], completedSessions: SessionData[], dailyRevenue: number, todayStr: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dashboard-data');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  if (loading) return <div className="p-8 text-center text-xl dark:text-white">Loading Dashboard...</div>;
  if (!data) return <div className="p-8 text-center text-xl text-red-500">Failed to load data</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 text-gray-900 dark:text-gray-100 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400">Live data for {data.todayStr}</p>
          </div>
          <button onClick={fetchData} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">
            Refresh
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Daily Revenue</h2>
            <p className="text-4xl font-bold text-green-600">₹{data.dailyRevenue}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Active Tables</h2>
            <p className="text-4xl font-bold text-blue-600">{data.activeSessions.length}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow border border-gray-100 dark:border-gray-700">
            <h2 className="text-sm text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-2">Completed Sessions</h2>
            <p className="text-4xl font-bold text-purple-600">{data.completedSessions.length}</p>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Active Sessions</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden mb-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm">
                <th className="p-4 font-semibold">Table</th>
                <th className="p-4 font-semibold">Customer</th>
                <th className="p-4 font-semibold">Game</th>
                <th className="p-4 font-semibold">Start Time</th>
                <th className="p-4 font-semibold">Live Duration</th>
                <th className="p-4 font-semibold">Current Slab</th>
                <th className="p-4 font-semibold">Live Bill</th>
              </tr>
            </thead>
            <tbody>
              {data.activeSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">No active sessions</td>
                </tr>
              ) : (
                data.activeSessions.map(session => {
                  const startFull = `${session.date}, ${session.start_time}`;
                  const endFull = `${data.todayStr}, ${toReadableIST(now)}`;
                  let liveDuration = '0 min';
                  let liveCost = 0;
                  let liveSlab = 'None';
                  try {
                    const res = calculateBilling(startFull, endFull, session.game_type, session.table_id);
                    liveDuration = res.duration;
                    liveCost = res.cost;
                    liveSlab = res.slabs_applied;
                  } catch (e) {}

                  return (
                    <tr key={session.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="p-4 font-semibold">{session.table_id}</td>
                      <td className="p-4">{session.customer_name}</td>
                      <td className="p-4 capitalize">{session.game_type}</td>
                      <td className="p-4">{session.start_time}</td>
                      <td className="p-4 font-mono">{liveDuration}</td>
                      <td className="p-4 text-sm">{liveSlab}</td>
                      <td className="p-4 font-bold text-green-600">₹{liveCost}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-bold mb-4">Completed Today</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-100 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm">
                <th className="p-4 font-semibold">Table</th>
                <th className="p-4 font-semibold">Customer</th>
                <th className="p-4 font-semibold">Game</th>
                <th className="p-4 font-semibold">Start Time</th>
                <th className="p-4 font-semibold">End Time</th>
                <th className="p-4 font-semibold">Duration</th>
                <th className="p-4 font-semibold">Slab Applied</th>
                <th className="p-4 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.completedSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">No completed sessions</td>
                </tr>
              ) : (
                data.completedSessions.map(session => (
                  <tr key={session.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="p-4 font-semibold">{session.table_id}</td>
                    <td className="p-4">{session.customer_name}</td>
                    <td className="p-4 capitalize">{session.game_type}</td>
                    <td className="p-4">{session.start_time}</td>
                    <td className="p-4">{session.end_time}</td>
                    <td className="p-4">{session.duration}</td>
                    <td className="p-4 text-sm">{session.applied_pricing}</td>
                    <td className="p-4 font-bold text-green-600">₹{session.cost}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
