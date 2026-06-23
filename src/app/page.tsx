export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex flex-col gap-6">
        <h1 className="text-4xl font-bold text-center text-blue-600 dark:text-blue-400">QR-Based Session Tracking & Billing System</h1>
        <p className="text-xl text-center text-gray-600 dark:text-gray-300">Scan a station&apos;s QR code to start a session.</p>
      </div>
    </main>
  );
}
