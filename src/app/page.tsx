export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-6">
        <h1 className="text-4xl font-bold text-center text-blue-600 dark:text-blue-400">QR-Based Session Tracking & Billing System</h1>
        <p className="text-xl text-center text-gray-600 dark:text-gray-300">Scan a station&apos;s QR code to start a session.</p>
        <div className="flex flex-col gap-4 mt-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
          <h2 className="text-2xl font-semibold mb-4 border-b pb-2">Available Demo Stations (For Testing)</h2>
          <a href="/session?table=TABLE_1&type=snooker" className="text-lg text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span> Snooker Table 1 (TABLE_1)
          </a>
          <a href="/session?table=TABLE_2&type=pool" className="text-lg text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span> Pool Table 2 (TABLE_2)
          </a>
        </div>
      </div>
    </main>
  );
}
