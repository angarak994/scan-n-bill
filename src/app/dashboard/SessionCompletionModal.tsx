'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { Clock, Utensils, Tag, CreditCard, BookOpen, Banknote, Zap, AlertTriangle, Check } from 'lucide-react';

export interface EndSessionModalData {
  session: {
    id: string;
    table_id: string;
    customer_name?: string;
    member_id?: string;
    game_type?: string;
    num_players?: number;
    start_time?: string;
    food_cost?: number;
    paused_duration_seconds?: number;
    [key: string]: any;
  };
  cost: number;
  duration?: string;
  amountReceived?: string;
  paymentMode?: 'now' | 'credit';
  dueDate?: string;
  paymentMethodOption?: string;
  cashTendered?: string;
  splitWays?: number;
  isSplitPayment?: boolean;
  splitCash?: string;
  splitUpi?: string;
  splitCard?: string;
  breakdown?: {
    baseTableCost: number;
    foodCost: number;
    discountAmount: number;
    discountLabel?: string;
    appliedRateName?: string;
    discountPercent?: number;
  };
  notes?: string;
}

export interface SessionCompletionModalProps {
  isOpen: boolean;
  data: EndSessionModalData | null;
  pricingRules?: any;
  preferences?: any;
  customerByPhoneMap?: Map<string, any>;
  customerByNameMap?: Map<string, any>;
  customerByIdMap?: Map<string, any>;
  membershipByIdMap?: Map<string, any>;
  membershipPlans?: any[];
  getDisplayName?: (name: string, memberId?: string) => string;
  onClose: () => void;
  onConfirm: (payload: {
    isCredit: boolean;
    dueDate?: string;
    isSplit: boolean;
    amountPaid?: number;
    paymentMethod: string;
    splitPayments?: Array<{ method: string; amount: number }>;
  }) => Promise<boolean | any>;
  formatINR: (amount: number) => string;
  t?: (key: any, fallback?: string) => string;
}

export default function SessionCompletionModal({
  isOpen,
  data,
  preferences,
  customerByPhoneMap,
  customerByNameMap,
  customerByIdMap,
  membershipByIdMap,
  membershipPlans = [],
  getDisplayName,
  onClose,
  onConfirm,
  formatINR,
  t = (_key, fallback) => fallback || String(_key)
}: SessionCompletionModalProps) {
  const resolveTierName = useCallback((rawTier?: string) => {
    if (!rawTier) return 'Member';
    const matchedPlan = (membershipPlans || []).find(
      (p: any) => String(p.id).toLowerCase() === String(rawTier).toLowerCase() ||
                  String(p.name).toLowerCase() === String(rawTier).toLowerCase()
    );
    if (matchedPlan?.name) return matchedPlan.name;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTier.trim())) {
      return 'VIP';
    }
    return rawTier;
  }, [membershipPlans]);

  const session = data?.session;
  const initialCost = Math.max(0, Math.round(data?.cost || 0));
  const breakdown = data?.breakdown;

  // Resolve customer & membership details
  const customerMeta = useMemo(() => {
    const rawName = (session?.customer_name || '').trim();
    const memberId = session?.member_id;

    // Check membershipByIdMap first
    if (memberId && membershipByIdMap?.has(memberId)) {
      const mem = membershipByIdMap.get(memberId);
      const matchedCust =
        (mem.mobile && customerByPhoneMap?.get(mem.mobile.trim())) ||
        (mem.id && customerByIdMap?.get(mem.id)) ||
        (mem.name && customerByNameMap?.get(mem.name.trim().toLowerCase()));

      return {
        isMember: true,
        displayName: mem.name || rawName || 'Member',
        tier: resolveTierName(mem.tier),
        phone: mem.mobile || matchedCust?.phone || '',
        outstandingBalance: Number(matchedCust?.outstanding_balance || 0),
        loyaltyPoints: Number(mem.loyalty_points || 0)
      };
    }

    // Check customer maps by phone / name
    const matchedCust =
      (rawName && customerByPhoneMap?.get(rawName)) ||
      (rawName && customerByNameMap?.get(rawName.toLowerCase())) ||
      (memberId && customerByIdMap?.get(memberId));

    if (matchedCust) {
      return {
        isMember: Boolean(matchedCust.is_member || memberId),
        displayName: matchedCust.name || rawName || 'Customer',
        tier: matchedCust.tier || (matchedCust.is_member ? 'Member' : undefined),
        phone: matchedCust.phone || '',
        outstandingBalance: Number(matchedCust.outstanding_balance || 0),
        loyaltyPoints: Number(matchedCust.loyalty_points || 0)
      };
    }

    const fallbackName = getDisplayName ? getDisplayName(rawName, memberId) : (rawName || 'Guest');
    return {
      isMember: Boolean(memberId),
      displayName: fallbackName,
      tier: memberId ? 'Member' : undefined,
      phone: '',
      outstandingBalance: 0,
      loyaltyPoints: 0
    };
  }, [session, customerByPhoneMap, customerByNameMap, customerByIdMap, membershipByIdMap, getDisplayName, resolveTierName]);

  // Clean discount label logic: FIX MISLEADING "Discount: None"
  const discountInfo = useMemo(() => {
    if (breakdown && Number(breakdown.discountAmount || 0) > 0) {
      const amount = Number(breakdown.discountAmount);

      let rawLabel = (breakdown.discountLabel || '').trim();
      // Filter out useless/buggy labels like 'None', empty, or min-bill warnings
      if (!rawLabel || rawLabel.toLowerCase() === 'none' || rawLabel.toLowerCase().includes('required')) {
        if (breakdown.appliedRateName && breakdown.appliedRateName.toLowerCase() !== 'standard') {
          rawLabel = breakdown.appliedRateName;
        } else if (breakdown.discountPercent && breakdown.discountPercent > 0) {
          rawLabel = `${breakdown.discountPercent}% Off`;
        } else {
          rawLabel = 'Applied Discount';
        }
      }

      return {
        amount,
        label: rawLabel,
        isAutoApplied: false
      };
    }

    // Auto-detect membership plan discount if not yet applied in incoming breakdown
    if (customerMeta.isMember && customerMeta.tier) {
      const matchedPlan = (membershipPlans || []).find(
        (p: any) => String(p.id).toLowerCase() === String(customerMeta.tier).toLowerCase() ||
                    String(p.name).toLowerCase() === String(customerMeta.tier).toLowerCase()
      );

      if (matchedPlan) {
        const rawTable = Number(breakdown?.baseTableCost || initialCost);
        const rawFood = Number(breakdown?.foodCost || session?.food_cost || 0);
        const eligibleAmount = rawTable + rawFood;

        if (eligibleAmount > 0) {
          if (matchedPlan.discount_type === 'fixed' && Number(matchedPlan.discount_amount) > 0) {
            const fixedAmount = Math.min(eligibleAmount, Number(matchedPlan.discount_amount));
            return {
              amount: fixedAmount,
              label: `${matchedPlan.name} (-₹${matchedPlan.discount_amount})`,
              isAutoApplied: true
            };
          } else if (Number(matchedPlan.discount_percent) > 0) {
            const pctAmount = Math.min(eligibleAmount, Math.round((eligibleAmount * Number(matchedPlan.discount_percent)) / 100));
            return {
              amount: pctAmount,
              label: `${matchedPlan.name} (${matchedPlan.discount_percent}% Off)`,
              isAutoApplied: true
            };
          }
        }
      }
    }

    return null;
  }, [breakdown, customerMeta, membershipPlans, initialCost, session?.food_cost]);

  const totalCost = discountInfo?.isAutoApplied
    ? Math.max(0, (Number(breakdown?.baseTableCost || initialCost) + Number(breakdown?.foodCost || session?.food_cost || 0)) - discountInfo.amount)
    : initialCost;

  // Form State
  const [paymentMode, setPaymentMode] = useState<'now' | 'credit'>(
    data?.paymentMode === 'credit' && customerMeta.isMember ? 'credit' : 'now'
  );
  const [isSplitPayment, setIsSplitPayment] = useState<boolean>(Boolean(data?.isSplitPayment));
  const [paymentMethod, setPaymentMethod] = useState<string>(data?.paymentMethodOption || 'Cash');
  const [amountReceived, setAmountReceived] = useState<string>(
    data?.amountReceived !== undefined && data?.amountReceived !== '' ? String(data.amountReceived) : String(totalCost)
  );
  const [cashTendered, setCashTendered] = useState<string>(data?.cashTendered || '');
  const [splitCash, setSplitCash] = useState<string>(data?.splitCash || '');
  const [splitUpi, setSplitUpi] = useState<string>(data?.splitUpi || '');
  const [splitCard, setSplitCard] = useState<string>(data?.splitCard || '');
  const [splitWays, setSplitWays] = useState<number>(data?.splitWays && data.splitWays > 1 ? data.splitWays : 1);
  const [dueDate, setDueDate] = useState<string>(() => {
    if (data?.dueDate) return data.dueDate;
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().split('T')[0];
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Keyboard navigation: Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onClose]);

  useEffect(() => {
    if (discountInfo?.isAutoApplied && (data?.amountReceived === undefined || data?.amountReceived === '')) {
      const timer = setTimeout(() => {
        setAmountReceived(String(totalCost));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [discountInfo?.isAutoApplied, totalCost, data?.amountReceived]);

  // Calculations for Single Payment
  const numericAmountReceived = amountReceived === '' ? totalCost : Number(amountReceived);
  const isFullSinglePayment =
    amountReceived === '' ||
    numericAmountReceived >= totalCost ||
    Math.abs(numericAmountReceived - totalCost) <= 2;
  const singleRemainderForCredit = Math.max(0, totalCost - (isNaN(numericAmountReceived) ? 0 : numericAmountReceived));

  // Cash tendered calculations
  const numericTendered = Number(cashTendered || 0);
  const cashChangeDue = Math.max(0, numericTendered - (isNaN(numericAmountReceived) ? totalCost : numericAmountReceived));
  const isCashShort = numericTendered > 0 && numericTendered < (isNaN(numericAmountReceived) ? totalCost : numericAmountReceived);

  // Calculations for Split Payment
  const numSplitCash = Number(splitCash || 0);
  const numSplitUpi = Number(splitUpi || 0);
  const numSplitCard = Number(splitCard || 0);
  const currentSplitSum = numSplitCash + numSplitUpi + numSplitCard;
  const splitDifference = totalCost - currentSplitSum;
  const isSplitExact = Math.abs(splitDifference) <= 2;
  const isSplitOver = splitDifference < -2;
  const isSplitUnder = splitDifference > 2;

  // Validation
  const canSubmit = useMemo(() => {
    if (isSubmitting) return false;

    if (paymentMode === 'credit') {
      return customerMeta.isMember;
    }

    if (isSplitPayment) {
      if (currentSplitSum <= 0) return false;
      if (isSplitOver) return false; // Overpayment not allowed in split
      if (isSplitUnder && !customerMeta.isMember) return false; // Walk-ins must pay in full
      return true;
    }

    // Single payment mode
    if (isNaN(numericAmountReceived) || numericAmountReceived < 0) return false;
    if (numericAmountReceived === 0 && totalCost > 0) return false;
    if (!isFullSinglePayment && !customerMeta.isMember) return false; // Walk-ins must pay in full
    return true;
  }, [
    isSubmitting,
    paymentMode,
    customerMeta.isMember,
    isSplitPayment,
    currentSplitSum,
    isSplitOver,
    isSplitUnder,
    numericAmountReceived,
    totalCost,
    isFullSinglePayment
  ]);

  // Handlers for quick split fills
  const handleFillSplitRemaining = useCallback(
    (target: 'cash' | 'upi' | 'card') => {
      let otherSum = 0;
      if (target === 'cash') otherSum = numSplitUpi + numSplitCard;
      if (target === 'upi') otherSum = numSplitCash + numSplitCard;
      if (target === 'card') otherSum = numSplitCash + numSplitUpi;

      const remaining = Math.max(0, totalCost - otherSum);
      if (target === 'cash') setSplitCash(String(remaining));
      if (target === 'upi') setSplitUpi(String(remaining));
      if (target === 'card') setSplitCard(String(remaining));
    },
    [numSplitCash, numSplitUpi, numSplitCard, totalCost]
  );

  const handleSplitEvenly = (ways: number) => {
    if (ways <= 1) {
      setSplitCash(String(totalCost));
      setSplitUpi('');
      setSplitCard('');
      return;
    }
    const perPerson = Math.floor(totalCost / ways);
    const remainder = totalCost - perPerson * ways;

    if (ways === 2) {
      setSplitCash(String(perPerson + remainder));
      setSplitUpi(String(perPerson));
      setSplitCard('');
    } else {
      setSplitCash(String(perPerson + remainder));
      setSplitUpi(String(perPerson));
      setSplitCard(String(perPerson * (ways - 2)));
    }
  };

  // Submit Handler
  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (paymentMode === 'credit') {
        await onConfirm({
          isCredit: true,
          dueDate: dueDate || undefined,
          isSplit: false,
          amountPaid: 0,
          paymentMethod: 'QKhata'
        });
        return;
      }

      if (isSplitPayment) {
        if (currentSplitSum <= 0) {
          toast.error(t('split_zero_error', 'Please enter at least one payment amount.'));
          return;
        }

        if (isSplitOver) {
          toast.error(
            t('split_exceeds_error', `Split total (₹${currentSplitSum}) exceeds bill amount (₹${totalCost}).`)
          );
          return;
        }

        if (isSplitUnder && !customerMeta.isMember) {
          toast.error(
            t('walkin_full_payment_required', 'Walk-in customers must pay full bill amount. Register as member to use QKhata.')
          );
          return;
        }

        const splitList: Array<{ method: string; amount: number }> = [];
        if (numSplitCash > 0) splitList.push({ method: 'Cash', amount: numSplitCash });
        if (numSplitUpi > 0) splitList.push({ method: 'UPI', amount: numSplitUpi });
        if (numSplitCard > 0) splitList.push({ method: 'Card', amount: numSplitCard });

        const amountToSend = isSplitExact || currentSplitSum >= totalCost ? undefined : currentSplitSum;

        await onConfirm({
          isCredit: false,
          isSplit: true,
          amountPaid: amountToSend,
          paymentMethod: 'Split',
          splitPayments: splitList
        });
        return;
      }

      // Single Payment Mode
      if (!isFullSinglePayment && !customerMeta.isMember) {
        toast.error(
          t('walkin_full_payment_required', 'Walk-in customers must pay full bill amount. Register as member to use QKhata.')
        );
        return;
      }

      const amountToRecord = isFullSinglePayment ? undefined : numericAmountReceived;

      await onConfirm({
        isCredit: false,
        isSplit: false,
        amountPaid: amountToRecord,
        paymentMethod: paymentMethod || 'Cash'
      });
    } catch (err: any) {
      console.error('Session completion error:', err);
      toast.error(err?.message || 'Failed to complete session. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for fast cash tenders
  const roundUp = (val: number, step: number) => Math.ceil(val / step) * step;
  const quickCashOptions = useMemo(() => {
    const base = isNaN(numericAmountReceived) ? totalCost : numericAmountReceived;
    const opts = new Set<number>();
    opts.add(base);
    if (base > 0) {
      if (base % 50 !== 0) opts.add(roundUp(base, 50));
      if (base % 100 !== 0) opts.add(roundUp(base, 100));
      if (base < 500) opts.add(500);
      if (base > 500 && base < 1000) opts.add(1000);
      if (base > 1000 && base < 2000) opts.add(2000);
    }
    return Array.from(opts).filter(n => n >= base).slice(0, 4);
  }, [numericAmountReceived, totalCost]);

  if (!isOpen || !data || !session) return null;

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-md z-[200] flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 overflow-hidden"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-modal-title"
    >
      <div
        className="bg-bg-surface border-t md:border border-border-theme rounded-t-2xl md:rounded-2xl w-full max-w-lg md:max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] md:max-h-[88vh] animate-sheet-up md:animate-entrance"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 bg-border-theme rounded-full opacity-60" />
        </div>

        {/* Modal Header */}
        <div className="bg-bg-surface px-5 py-3.5 md:py-4 border-b border-border-theme flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono font-bold text-sm bg-emerald-500/15 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/30 shrink-0 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {session.table_id}
            </span>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h3 id="session-modal-title" className="text-base font-bold text-text-primary truncate">
                  {customerMeta.displayName}
                </h3>
                {customerMeta.tier && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/25 shrink-0">
                    {customerMeta.tier}
                  </span>
                )}
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-bg-card text-text-secondary border border-border-theme shrink-0">
                  {session.game_type || 'Table'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-text-secondary" /> {data.duration || '0m'}</span>
                {customerMeta.outstandingBalance > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-warning font-semibold">
                      Dues: {formatINR(customerMeta.outstandingBalance)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="touch-target w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors shrink-0 disabled:opacity-40"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm custom-scrollbar flex-1">
          {/* 1. Itemized Financial Summary Card */}
          <div className="bg-bg-card border border-border-theme rounded-xl p-3.5 space-y-2.5">
            <div className="flex justify-between items-center text-xs text-text-secondary">
              <span className="uppercase tracking-wider font-semibold">{t('table_fee', 'Table Session Fee')}</span>
              <span className="font-mono font-bold text-text-primary">
                {formatINR(breakdown ? breakdown.baseTableCost : (discountInfo?.isAutoApplied ? initialCost : totalCost))}
              </span>
            </div>

            {((breakdown && breakdown.foodCost > 0) || Number(session.food_cost || 0) > 0) && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5" />
                  <span>{t('food_orders', 'F&B Orders')}</span>
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  + {formatINR(breakdown?.foodCost ?? session.food_cost ?? 0)}
                </span>
              </div>
            )}

            {discountInfo && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{t('discount', 'Discount')}</span>
                  <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded text-emerald-400 font-bold">
                    {discountInfo.label}
                  </span>
                </span>
                <span className="font-mono text-emerald-400 font-black">
                  - {formatINR(discountInfo.amount)}
                </span>
              </div>
            )}

            {/* Total Payable Highlight */}
            <div className="pt-2.5 border-t border-border-theme/60 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-widest font-black text-text-secondary block">
                  {t('total_payable', 'Total Payable')}
                </span>
                {splitWays > 1 && (
                  <span className="text-[11px] font-mono text-emerald-400/90 font-medium block mt-0.5">
                    {formatINR(Math.round(totalCost / splitWays))} / person ({splitWays} ways)
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 tracking-tight">
                  {formatINR(totalCost)}
                </span>
              </div>
            </div>

            {/* Split Per Person Quick Helper */}
            <div className="pt-2 border-t border-border-theme/40 flex items-center justify-between text-xs">
              <span className="text-[11px] text-text-secondary uppercase font-semibold tracking-wider">
                {t('split_calculator', 'Per-Person Split:')}
              </span>
              <div className="flex items-center gap-1 bg-bg-surface border border-border-theme/60 rounded-lg p-0.5">
                {[1, 2, 3, 4, 5].map(ways => (
                  <button
                    key={ways}
                    type="button"
                    onClick={() => setSplitWays(ways)}
                    className={`px-2 py-0.5 text-xs font-bold rounded-md transition-colors font-mono ${
                      splitWays === ways
                        ? 'bg-emerald-500 text-black shadow-sm'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {ways === 1 ? '1' : `${ways}p`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Payment Mode Toggle (Only if registered member) */}
          {customerMeta.isMember && (
            <div className="flex bg-bg-surface p-1 rounded-xl border border-border-theme">
              <button
                type="button"
                onClick={() => setPaymentMode('now')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  paymentMode === 'now'
                    ? 'bg-accent/15 text-emerald-400 shadow-sm border border-emerald-500/30'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>{t('pay_now', 'Collect Payment Now')}</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode('credit')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  paymentMode === 'credit'
                    ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/40'
                    : 'text-text-secondary hover:text-amber-400/80'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>{t('play_on_credit', 'Add to QKhata (Credit)')}</span>
              </button>
            </div>
          )}

          {/* 3. Payment Mode: PAY NOW */}
          {paymentMode === 'now' ? (
            <div className="space-y-3.5">
              {/* Single vs Split Payment Segmented Tabs */}
              <div className="flex bg-bg-surface p-1 rounded-xl border border-border-theme">
                <button
                  type="button"
                  onClick={() => {
                    setIsSplitPayment(false);
                    setAmountReceived(String(totalCost));
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    !isSplitPayment
                      ? 'bg-bg-card text-text-primary shadow-sm border border-border-theme'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t('single_method', 'Single Payment')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSplitPayment(true);
                    if (!splitCash && !splitUpi && !splitCard) {
                      setSplitCash(String(totalCost));
                    }
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    isSplitPayment
                      ? 'bg-accent/15 text-emerald-400 shadow-sm border border-emerald-500/30'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {t('split_payment', 'Split Payment (Multi-Tender)')}
                </button>
              </div>

              {!isSplitPayment ? (
                /* SINGLE PAYMENT CONTROLS */
                <div className="space-y-3">
                  {/* Payment Method Selector Grid */}
                  <div>
                    <label className="block text-[11px] font-bold tracking-wider uppercase text-text-secondary mb-1.5">
                      {t('payment_method', 'Payment Method')}
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'Cash', label: 'Cash', icon: <Banknote className="w-4 h-4" /> },
                        { id: 'UPI', label: 'UPI / QR', icon: <Zap className="w-4 h-4" /> },
                        { id: 'Card', label: 'Card', icon: <CreditCard className="w-4 h-4" /> },
                        { id: 'Other', label: 'Other', icon: <Tag className="w-4 h-4" /> }
                      ].map(method => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPaymentMethod(method.id)}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
                            paymentMethod === method.id
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 shadow-sm'
                              : 'bg-bg-card border-border-theme text-text-secondary hover:border-border-theme/80 hover:text-text-primary'
                          }`}
                        >
                          <span className="text-sm flex items-center justify-center">{method.icon}</span>
                          <span>{method.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount Received Input */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[11px] font-bold tracking-wider uppercase text-text-secondary">
                        {t('amount_received', 'Amount Received')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setAmountReceived(String(totalCost))}
                        className="text-[11px] font-bold text-emerald-400 hover:underline"
                      >
                        {t('exact_bill', 'Exact Bill')} ({formatINR(totalCost)})
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary font-bold font-mono text-base">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={amountReceived}
                        onChange={e => setAmountReceived(e.target.value)}
                        className="w-full pl-8 pr-4 py-2.5 bg-bg-card border border-border-theme rounded-xl outline-none text-base font-mono tabular-nums text-text-primary focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        placeholder={String(totalCost)}
                      />
                    </div>

                    {/* Partial payment alerts */}
                    {!isFullSinglePayment && (
                      <div className="mt-2 p-2.5 rounded-lg text-xs flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          {customerMeta.isMember ? (
                            <span>
                              {t('partial_qkhata_info', 'Partial payment:')}{' '}
                              <strong>{formatINR(singleRemainderForCredit)}</strong>{' '}
                              {t('will_be_added_qkhata', `will be added to ${customerMeta.displayName}'s QKhata.`)}
                            </span>
                          ) : (
                            <span className="text-red-400 font-semibold">
                              {t('walkin_must_pay_full', 'Walk-in customers must pay full amount. Register as member to allow credit.')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cash Tendered & Change Due Calculator (Only when Cash is selected) */}
                  {paymentMethod === 'Cash' && (
                    <div className="p-3 bg-bg-card border border-border-theme rounded-xl space-y-2.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                          {t('cash_tendered', 'Cash Tendered (From Customer)')}
                        </label>
                        <span className="text-[10px] text-text-secondary">Change Calculator</span>
                      </div>

                      {/* Quick Cash Chips */}
                      <div className="flex flex-wrap gap-1.5">
                        {quickCashOptions.map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCashTendered(String(val))}
                            className={`px-2 py-1 text-xs font-mono font-bold rounded-lg border transition-all ${
                              numericTendered === val
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                : 'bg-bg-surface text-text-secondary border-border-theme hover:text-text-primary'
                            }`}
                          >
                            ₹{val}
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-bold font-mono text-xs">
                          ₹
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={cashTendered}
                          onChange={e => setCashTendered(e.target.value)}
                          placeholder="e.g. 500"
                          className="w-full pl-7 pr-3 py-2 bg-bg-surface border border-border-theme rounded-lg text-sm font-mono text-text-primary outline-none focus:border-emerald-500/50"
                        />
                      </div>

                      {/* Change Due Display */}
                      <div className="pt-2 border-t border-border-theme/50 flex justify-between items-center text-xs">
                        <span className="font-bold uppercase tracking-wider text-text-secondary">
                          {t('change_due', 'Change Due')}
                        </span>
                        {isCashShort ? (
                          <span className="font-mono font-bold text-amber-400">
                            Short by {formatINR(Math.abs(numericAmountReceived - numericTendered))}
                          </span>
                        ) : (
                          <span
                            className={`text-base font-mono font-black ${
                              cashChangeDue > 0 ? 'text-emerald-400' : 'text-text-secondary'
                            }`}
                          >
                            {formatINR(cashChangeDue)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* UPI Notice if business UPI is missing */}
                  {paymentMethod === 'UPI' && !preferences?.business_upi_id && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                      <span className="text-sm">ℹ️</span>
                      <div className="text-[11px] leading-snug">
                        <strong>Manual UPI Collection:</strong> No merchant UPI VPA is configured in Settings. Dynamic QR display is disabled, but manual UPI payment will be logged.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* SPLIT PAYMENT CONTROLS */
                <div className="p-3.5 bg-bg-card border border-border-theme rounded-xl space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-border-theme/50">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                      {t('split_breakdown', 'Tender Breakdown')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSplitEvenly(2)}
                        className="text-[10px] bg-bg-surface border border-border-theme px-2 py-0.5 rounded text-text-secondary hover:text-emerald-400 font-bold"
                      >
                        50 / 50
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSplitCash('');
                          setSplitUpi('');
                          setSplitCard('');
                        }}
                        className="text-[10px] text-text-secondary hover:text-red-400 font-bold"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Cash Input */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-text-secondary uppercase flex items-center gap-1.5">
                        <Banknote className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Cash (₹)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleFillSplitRemaining('cash')}
                        className="text-[10px] text-emerald-400 hover:underline font-bold"
                      >
                        Fill Remaining
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={splitCash}
                        onChange={e => setSplitCash(e.target.value)}
                        placeholder="0"
                        className="w-full pl-7 pr-3 py-2 bg-bg-surface border border-border-theme rounded-lg text-sm font-mono text-text-primary outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>

                  {/* UPI Input */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-text-secondary uppercase flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>UPI (₹)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleFillSplitRemaining('upi')}
                        className="text-[10px] text-emerald-400 hover:underline font-bold"
                      >
                        Fill Remaining
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={splitUpi}
                        onChange={e => setSplitUpi(e.target.value)}
                        placeholder="0"
                        className="w-full pl-7 pr-3 py-2 bg-bg-surface border border-border-theme rounded-lg text-sm font-mono text-text-primary outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>

                  {/* Card Input */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs font-bold text-text-secondary uppercase flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-sky-400" />
                        <span>Card / POS (₹)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleFillSplitRemaining('card')}
                        className="text-[10px] text-emerald-400 hover:underline font-bold"
                      >
                        Fill Remaining
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary font-bold text-xs">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={splitCard}
                        onChange={e => setSplitCard(e.target.value)}
                        placeholder="0"
                        className="w-full pl-7 pr-3 py-2 bg-bg-surface border border-border-theme rounded-lg text-sm font-mono text-text-primary outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>

                  {/* Split Summary / Status Banner */}
                  <div className="pt-2.5 border-t border-border-theme/50 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-mono">
                      <span className="text-text-secondary font-sans font-bold uppercase text-[10px]">
                        Total Split Tendered:
                      </span>
                      <span className="font-bold text-text-primary">{formatINR(currentSplitSum)}</span>
                    </div>

                    {isSplitExact ? (
                      <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          <span>Exact Amount Covered</span>
                        </span>
                        <span className="font-mono">{formatINR(currentSplitSum)}</span>
                      </div>
                    ) : isSplitUnder ? (
                      <div
                        className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-between ${
                          customerMeta.isMember
                            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                            : 'bg-red-500/10 border border-red-500/30 text-red-400'
                        }`}
                      >
                        <span>
                          {customerMeta.isMember ? 'Remaining to QKhata:' : 'Unpaid (Walk-in full pay required):'}
                        </span>
                        <span className="font-mono font-bold">{formatINR(splitDifference)}</span>
                      </div>
                    ) : (
                      <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-semibold flex items-center justify-between">
                        <span>Exceeds Total Bill by:</span>
                        <span className="font-mono font-bold">{formatINR(Math.abs(splitDifference))}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 4. Payment Mode: PLAY ON CREDIT (QKHATA) */
            <div className="p-4 border border-amber-500/30 bg-amber-500/5 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <BookOpen className="w-4 h-4" />
                <span>{t('qkhata_credit_agreement', 'QKhata Credit Agreement')}</span>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Full bill of <strong>{formatINR(totalCost)}</strong> will be charged to{' '}
                <strong>{customerMeta.displayName}</strong>&apos;s ledger.
              </p>

              <div>
                <label className="block text-[11px] font-bold tracking-wider uppercase text-amber-400 mb-1.5">
                  {t('due_date', 'Expected Due Date')}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-bg-card border border-amber-500/30 rounded-xl outline-none text-xs text-text-primary focus:border-amber-400"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextCycle = new Date();
                  nextCycle.setMonth(nextCycle.getMonth() + 1);
                  setDueDate(nextCycle.toISOString().split('T')[0]);
                }}
                className="text-xs text-amber-400 hover:underline font-semibold block"
              >
                + Set 30 Days Cycle ({dueDate})
              </button>
            </div>
          )}
        </div>

        {/* Modal Sticky Footer */}
        <div className="px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-3.5 bg-bg-surface border-t border-border-theme flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 min-h-[44px] py-2.5 px-4 bg-bg-card hover:bg-bg-card-hover text-text-secondary hover:text-text-primary text-xs font-bold uppercase tracking-wider rounded-xl border border-border-theme transition-colors disabled:opacity-50 touch-target flex items-center justify-center"
          >
            {t('cancel', 'Cancel')}
          </button>

          <button
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={handleSubmit}
            className={`flex-[2] min-h-[44px] py-2.5 px-4 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 touch-target disabled:opacity-40 disabled:cursor-not-allowed ${
              paymentMode === 'credit'
                ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-amber-500/20'
                : 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-emerald-500/20 font-black'
            }`}
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>{t('finalizing', 'Finalizing...')}</span>
              </>
            ) : paymentMode === 'credit' ? (
              <span>{t('confirm_qkhata', 'Confirm QKhata Credit')}</span>
            ) : isSplitPayment ? (
              <span>
                {t('collect_split', 'Collect')} {formatINR(currentSplitSum)} & End
              </span>
            ) : (
              <span>
                {t('collect_and_end', 'Collect')} {formatINR(numericAmountReceived || totalCost)} & End
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
