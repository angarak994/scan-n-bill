import { redirect } from 'next/navigation';
import { businessManager } from '@/lib/businessManager';

// Legacy QR Code redirector for old printed QR codes
export default async function LegacySessionRedirect({
  searchParams,
}: {
  searchParams: { table?: string; type?: string; b?: string };
}) {
  const tableId = searchParams.table;
  const businessId = searchParams.b;

  if (!tableId || !businessId) {
    redirect('/404');
  }

  const business = await businessManager.getBusiness(businessId);
  if (!business) {
    redirect('/404');
  }

  const slug = (business.business_name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  
  if (!slug) {
    redirect('/404');
  }

  // Redirect to the new clean URL structure
  redirect(`/qr/${slug}/${tableId}`);
}
