import QRCode from 'qrcode';
import { headers } from 'next/headers';

export default async function OnboardQRPage() {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const onboardUrl = `${protocol}://${host}/onboard`;

  const qrDataUrl = await QRCode.toDataURL(onboardUrl, { width: 400 });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 p-8 flex flex-col items-center text-center gap-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Business Onboarding</h1>
        <p className="text-gray-500 dark:text-gray-400">Scan this QR code to register a new business into the system.</p>
        
        <div className="bg-white p-4 rounded-xl border-4 border-gray-100 dark:border-gray-700 shadow-sm">
          <img src={qrDataUrl} alt="Onboarding QR Code" className="w-64 h-64" />
        </div>
        
        <p className="text-sm text-gray-400">
          Or visit <a href="/onboard" className="text-blue-500 hover:underline">{onboardUrl}</a> directly.
        </p>
      </div>
    </main>
  );
}
