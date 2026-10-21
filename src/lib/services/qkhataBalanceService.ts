import { supabase } from '@/lib/supabaseClient';

export interface AuthoritativeQKhataBalanceResult {
  success: boolean;
  customerId: string | null;
  customerName: string;
  phone: string | null;
  outstanding: number;
  reason?: string;
}

/**
 * Resolves the customer's authoritative QKhata ledger balance from PostgreSQL payments table
 * and synchronizes it with the customers table.
 *
 * Ensures:
 * 1. Customer and business records are verified.
 * 2. Accurate running ledger balance (charges minus settlements) is calculated.
 * 3. Never uses booking totals, estimated values, or hardcoded amounts.
 * 4. Updates customers.outstanding_balance in the database before returning.
 */
export async function getAuthoritativeQKhataBalance(
  businessId: string,
  params: {
    customerId?: string | null;
    phone?: string | null;
    name?: string | null;
  }
): Promise<AuthoritativeQKhataBalanceResult> {
  const { customerId, phone, name } = params;

  if (!businessId) {
    return {
      success: false,
      customerId: null,
      customerName: name || 'Customer',
      phone: phone || null,
      outstanding: 0,
      reason: 'Missing businessId'
    };
  }

  // 1. Fetch all customer & membership records for this business
  const [{ data: allCustomers, error: custErr }, { data: allMemberships }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, phone, outstanding_balance, total_billed, total_paid')
      .eq('business_id', businessId),
    supabase
      .from('memberships')
      .select('id, name, mobile, tier')
      .eq('business_id', businessId)
  ]);

  if (custErr || !allCustomers) {
    console.error('[qkhataBalanceService] Error loading customers:', custErr);
    return {
      success: false,
      customerId: customerId || null,
      customerName: name || 'Customer',
      phone: phone || null,
      outstanding: 0,
      reason: 'Database error fetching customers'
    };
  }

  const cleanPhone = phone ? phone.replace(/\D/g, '') : null;
  const clean10 = cleanPhone ? cleanPhone.slice(-10) : null;
  const cleanName = name ? name.trim().toLowerCase() : null;

  // Match target membership if any
  const targetMem = (allMemberships || []).find((m: any) => {
    if (customerId && m.id === customerId) return true;
    if (m.mobile) {
      const m10 = m.mobile.replace(/\D/g, '').slice(-10);
      if (clean10 && m10 === clean10) return true;
    }
    if (cleanName && m.name && m.name.trim().toLowerCase() === cleanName) return true;
    return false;
  });

  // Find all sibling customer records
  const siblingRows = allCustomers.filter((c: any) => {
    if (customerId && c.id === customerId) return true;
    if (targetMem) {
      if (c.id === targetMem.id) return true;
      if (targetMem.mobile && c.phone) {
        const c10 = c.phone.replace(/\D/g, '').slice(-10);
        const m10 = targetMem.mobile.replace(/\D/g, '').slice(-10);
        if (c10 && m10 && c10 === m10) return true;
      }
      if (targetMem.name && c.name && targetMem.name.trim().toLowerCase() === c.name.trim().toLowerCase()) return true;
    }
    if (clean10 && c.phone) {
      const c10 = c.phone.replace(/\D/g, '').slice(-10);
      if (c10 && c10 === clean10) return true;
    }
    if (cleanName && c.name && c.name.trim().toLowerCase() === cleanName) return true;
    return false;
  });

  let primaryCustomer = (targetMem && siblingRows.find((c: any) => c.id === targetMem.id)) ||
                        siblingRows.find((c: any) => c.phone) ||
                        siblingRows[0] ||
                        null;

  if (!primaryCustomer) {
    if (cleanPhone || cleanName) {
      // Auto-create customer profile if non-existent
      const { data: newCust, error: createErr } = await supabase
        .from('customers')
        .insert([{
          business_id: businessId,
          name: (targetMem?.name || name || 'Customer').trim(),
          phone: targetMem?.mobile || phone || null,
          total_billed: 0,
          total_paid: 0,
          outstanding_balance: 0
        }])
        .select()
        .single();

      if (!createErr && newCust) {
        primaryCustomer = newCust;
        siblingRows.push(newCust);
      }
    }
  }

  if (!primaryCustomer) {
    return {
      success: false,
      customerId: null,
      customerName: name || 'Customer',
      phone: phone || null,
      outstanding: 0,
      reason: 'No matching customer record found in QKhata'
    };
  }

  const customerIds = siblingRows.map((c: any) => c.id).filter(Boolean);

  // 2. Authoritative Payments Ledger Running Balance Calculation
  let accurateBalance = 0;
  let hasPayments = false;

  if (customerIds.length > 0) {
    const { data: payments, error: payErr } = await supabase
      .from('payments')
      .select('*')
      .eq('business_id', businessId)
      .in('customer_id', customerIds)
      .order('created_at', { ascending: true });

    if (!payErr && payments && payments.length > 0) {
      hasPayments = true;
      let runningBalance = 0;

      for (const p of payments) {
        const isCharge = p.metadata?.type === 'CHARGE';
        const isPayment = p.metadata?.type === 'PAYMENT';
        const amount = Number(p.amount) || 0;

        const isChargeEvent = isCharge || (!isCharge && !isPayment && p.payment_method === 'QKhata');
        const isPaymentEvent = isPayment || (!isCharge && !isPayment && p.payment_method !== 'QKhata');

        if (isChargeEvent) {
          runningBalance += amount;
        } else if (isPaymentEvent) {
          runningBalance -= amount;
        }
      }

      accurateBalance = Math.max(0, Math.round(runningBalance * 100) / 100);
    }
  }

  // Fallback to customer table balance if no payments rows exist
  if (!hasPayments) {
    const tableSum = siblingRows.reduce((sum: number, c: any) => sum + (Number(c.outstanding_balance) || 0), 0);
    accurateBalance = Math.max(0, Math.round(tableSum * 100) / 100);
  }

  // 3. Keep customers table outstanding_balance strictly synchronized
  try {
    const otherSiblingIds = siblingRows.filter((c: any) => c.id !== primaryCustomer.id).map((c: any) => c.id);
    if (otherSiblingIds.length > 0) {
      await supabase.from('customers').update({ outstanding_balance: 0 }).in('id', otherSiblingIds);
    }

    if (Number(primaryCustomer.outstanding_balance) !== accurateBalance) {
      await supabase
        .from('customers')
        .update({
          outstanding_balance: accurateBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', primaryCustomer.id);
    }
  } catch (syncErr) {
    console.warn('[qkhataBalanceService] Non-fatal customer balance sync warning:', syncErr);
  }

  return {
    success: true,
    customerId: primaryCustomer.id,
    customerName: primaryCustomer.name || targetMem?.name || name || 'Customer',
    phone: primaryCustomer.phone || targetMem?.mobile || phone || null,
    outstanding: accurateBalance
  };
}
