'use client';

import React, { useState } from 'react';
import { Globe, Copy, Check, AlertTriangle, Gift } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { CustomSelect, Tooltip } from './components';
import { parseDateString, applySessionDiscounts } from '@/lib/billing';
import FancyLanguageToggle from '@/components/FancyLanguageToggle';
import { useLanguage } from '@/context/LanguageContext';
import VenuePhotosSection from '@/components/dashboard/VenuePhotosSection';

const IconEye = () => <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>;
const IconEyeOff = () => <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>;

interface SettingsTabProps {
  data: any;
  setData: React.Dispatch<React.SetStateAction<any>>;
  businessId: string;
  preferences: any;
  handleUpdatePreference: (key: string, value: any) => Promise<void>;
  isUpdatingPreferences: boolean;
  membershipPlans: any[];
  fetchMembershipPlans: () => void | Promise<void>;
  isPlansLoading: boolean;
  isAuthorized: boolean;
  handleSaveConfig: (newRules?: any, newTables?: any[], googleSheetId?: string, businessProfile?: any) => Promise<void>;
}

export default function SettingsTab({
  data,
  setData,
  businessId,
  preferences,
  handleUpdatePreference,
  isUpdatingPreferences,
  membershipPlans,
  fetchMembershipPlans,
  isPlansLoading,
  isAuthorized,
  handleSaveConfig
}: SettingsTabProps) {
  const { t, language, setLanguage } = useLanguage();

  const [isUpdatingConfig, setIsUpdatingConfig] = useState(false);
  const now = new Date();

  // Helper for dates
  const getLocalTodayString = () => {
    const d = new Date();
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const local = new Date(d.getTime() + tzOffset);
    return local.toISOString().split('T')[0];
  };
  const getLocalTimeString = () => {
    const d = new Date();
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const local = new Date(d.getTime() + tzOffset);
    return local.toISOString().split('T')[1].substring(0, 5);
  };

  // Station State
  const [newStationId, setNewStationId] = useState('');
  const [newStationName, setNewStationName] = useState('');
  const [newStationType, setNewStationType] = useState('ps5');
  const [newStationMaxPlayers, setNewStationMaxPlayers] = useState('4');
  const [selectedGameRule, setSelectedGameRule] = useState('ps5');
  const [stationToDelete, setStationToDelete] = useState<{ id: string; name: string } | null>(null);

  // Promo State
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDescription, setPromoDescription] = useState('');
  const [promoType, setPromoType] = useState('percentage');
  const [promoDiscount, setPromoDiscount] = useState('40');
  const [promoFixedPrice, setPromoFixedPrice] = useState('');
  const [promoFixedAmount, setPromoFixedAmount] = useState('');
  const [promoGames, setPromoGames] = useState<string[]>([]);
  const [promoTables, setPromoTables] = useState<string[]>([]);
  const [promoTimeSlotEnabled, setPromoTimeSlotEnabled] = useState(false);
  const [promoTimeSlotStart, setPromoTimeSlotStart] = useState('14:00');
  const [promoTimeSlotEnd, setPromoTimeSlotEnd] = useState('17:00');
  const [promoStartDate, setPromoStartDate] = useState(getLocalTodayString());
  const [promoStartTime, setPromoStartTime] = useState(getLocalTimeString());
  const [promoEndDate, setPromoEndDate] = useState(getLocalTodayString());
  const [promoEndTime, setPromoEndTime] = useState('23:59');
  const [isUpdatingPromo, setIsUpdatingPromo] = useState(false);

  // Discount State
  const [selectedTable, setSelectedTable] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountPercent, setDiscountPercent] = useState('20');
  const [discountFixedAmount, setDiscountFixedAmount] = useState('50');
  const [maxDiscountCap, setMaxDiscountCap] = useState('');
  const [minBillAmount, setMinBillAmount] = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [applyToFood, setApplyToFood] = useState(false);
  const [isUpdatingDiscount, setIsUpdatingDiscount] = useState(false);

  // Plan State
  const [newPlan, setNewPlan] = useState({
    name: '',
    price: 0,
    duration_months: 1,
    benefits: '',
    discount_type: 'percentage' as 'percentage' | 'fixed' | 'flat_rate',
    discount_percent: 0,
    discount_amount: 0,
    flat_hourly_rate: 0
  });
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  // Password / PIN State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  // Station Handlers
  const handleEnablePS5 = async () => {
    if (!data) return;
    const existingRules = data.pricingRules?.rules || {};
    if (existingRules['ps5']) {
      toast.success('PS5 support is already enabled!');
      return;
    }
    const updatedRules = {
      ...existingRules,
      ps5: {
        type: 'fixed',
        rate: 250,
        multiplayer_mode: 'base_plus_extra',
        extra_per_player: 50
      }
    };
    const fullPricing = { ...data.pricingRules, rules: updatedRules };
    await handleSaveConfig(fullPricing, undefined);
  };

  const handleAddStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStationId || !newStationName || !data) return;
    const existing = data.tables || [];
    if (existing.some((t: any) => t.id.toLowerCase() === newStationId.toLowerCase())) {
      toast.error(`Station ID "${newStationId}" already exists.`);
      return;
    }
    const maxPlayersNum = parseInt(newStationMaxPlayers, 10) || 4;
    const updatedTables = [...existing, { id: newStationId, name: newStationName, type: newStationType, max_players: newStationType === 'ps5' ? maxPlayersNum : undefined }];
    await handleSaveConfig(undefined, updatedTables);
    setNewStationId('');
    setNewStationName('');
    setNewStationMaxPlayers('4');
  };

  const confirmDeleteStation = (t: any) => {
    if (!data) return;
    const hasActiveSession = data.activeSessions?.some((s: any) => String(s.table_id || '').trim().toLowerCase() === String(t.id || '').trim().toLowerCase() && s.status === 'ACTIVE');
    if (hasActiveSession) {
      toast.error(`Cannot delete "${t.name}": Active session in progress.`);
      return;
    }
    const hasActiveBooking = data.bookings?.some((b: any) => b.table_id === t.id && b.status === 'confirmed');
    if (hasActiveBooking) {
      toast.error(`Cannot delete "${t.name}": Has confirmed booking.`);
      return;
    }
    setStationToDelete({ id: t.id, name: t.name });
  };

  const handleDeleteStation = async () => {
    if (!stationToDelete || !data) return;
    const existing = data.tables || [];
    const updatedTables = existing.filter((t: any) => t.id !== stationToDelete.id);
    await handleSaveConfig(undefined, updatedTables);
    toast.success(`Station "${stationToDelete.name}" deleted successfully.`);
    setStationToDelete(null);
  };

  // Discount Handlers
  const handleApplyDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !businessId) return;

    if (discountType === 'percentage') {
      const pct = Number(discountPercent);
      if (isNaN(pct) || pct < 1 || pct > 100) {
        toast.error('Discount percentage must be between 1% and 100%');
        return;
      }
    } else {
      const amt = Number(discountFixedAmount);
      if (isNaN(amt) || amt < 1) {
        toast.error('Fixed discount amount must be at least ₹1');
        return;
      }
    }

    setIsUpdatingDiscount(true);
    try {
      const payload = {
        business_id: businessId,
        table_id: selectedTable,
        type: discountType,
        percent: discountType === 'percentage' ? Number(discountPercent) : undefined,
        amount: discountType === 'fixed' ? Number(discountFixedAmount) : undefined,
        maxDiscount: maxDiscountCap ? Number(maxDiscountCap) : undefined,
        minBillAmount: minBillAmount ? Number(minBillAmount) : undefined,
        applyToFood,
        label: discountLabel.trim() || undefined,
        isActive: true,
      };

      const res = await fetch('/api/update-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (data) {
          setData({ ...data, activeDiscounts: json.active_discounts });
        }
        const targetLabel = selectedTable === 'all' ? 'All Tables' : (data?.tables?.find((t: any) => t.id === selectedTable)?.name || selectedTable);
        const valLabel = discountType === 'percentage' ? `${discountPercent}%` : `₹${discountFixedAmount}`;
        toast.success(`${valLabel} discount applied to ${targetLabel}`);
        setSelectedTable('');
        setMaxDiscountCap('');
        setMinBillAmount('');
        setDiscountLabel('');
      } else {
        toast.error(json.error || 'Could not apply discount.');
      }
    } catch {
      toast.error('Network error. Could not apply discount.');
    } finally {
      setIsUpdatingDiscount(false);
    }
  };

  const handleRemoveDiscount = async (tableId: string) => {
    if (!businessId) return;
    setIsUpdatingDiscount(true);
    try {
      const res = await fetch('/api/update-discount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: businessId, table_id: tableId, remove: true })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        if (data) {
          setData({ ...data, activeDiscounts: json.active_discounts });
        }
        const targetLabel = tableId === 'all' ? 'All Tables' : (data?.tables?.find((t: any) => t.id === tableId)?.name || tableId);
        toast.success(`Removed discount for ${targetLabel}`);
      } else {
        toast.error(json.error || 'Could not remove discount.');
      }
    } catch {
      toast.error('Network error. Could not remove discount.');
    } finally {
      setIsUpdatingDiscount(false);
    }
  };

  // Promo Handlers
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingPromo(true);
    
    try {
      const res = await fetch('/api/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: promoTitle, 
          description: promoDescription,
          promo_type: promoType,
          discount_percent: Number(promoDiscount) || 0,
          fixed_price: Number(promoFixedPrice) || null,
          fixed_amount_discount: Number(promoFixedAmount) || null,
          applicable_game_types: promoGames.length > 0 ? promoGames : null,
          applicable_tables: promoTables.length > 0 ? promoTables : null,
          start_date: promoStartDate,
          start_time: promoStartTime,
          end_date: promoEndDate,
          end_time: promoEndTime,
          time_slot_start: promoTimeSlotEnabled ? promoTimeSlotStart : null,
          time_slot_end: promoTimeSlotEnabled ? promoTimeSlotEnd : null
        })
      });
      if (res.ok) {
        setIsUpdatingDiscount(false);
        const resData = await res.json();
        setData((prev: any) => prev ? {
          ...prev,
          activePromotions: [resData.promotion, ...(prev.activePromotions || [])]
        } : prev);
        toast.success('Promotion scheduled/launched successfully.');
        setPromoTitle('');
        setPromoDiscount('40');
        setPromoTimeSlotEnabled(false);
      } else {
        const err = await res.json();
        toast.error(err.error || "We couldn't update your promotion. Please try again.");
      }
    } finally {
      setIsUpdatingPromo(false);
    }
  };

  const handleUpdatePromoStatus = async (promoId: string, status: string) => {
    setIsUpdatingPromo(true);
    try {
      const res = await fetch('/api/promotions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promoId, status })
      });
      if (res.ok) {
        setData((prev: any) => prev ? { 
          ...prev, 
          activePromotions: prev.activePromotions?.map((p: any) => p.id === promoId ? { ...p, status } : p)
        } : prev);
        toast.success(`Promotion marked as ${status}`);
      } else {
        const err = await res.json();
        toast.error(err.error || `Failed to mark promotion as ${status}.`);
      }
    } finally {
      setIsUpdatingPromo(false);
    }
  };

  // Plan Handlers
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingPlan(true);
    try {
      if (newPlan.discount_type === 'percentage') {
        const pct = Number(newPlan.discount_percent);
        if (isNaN(pct) || pct < 0 || pct > 100) {
          toast.error('Percentage discount must be between 0% and 100%');
          setIsCreatingPlan(false);
          return;
        }
      } else if (newPlan.discount_type === 'fixed') {
        const amt = Number(newPlan.discount_amount);
        if (isNaN(amt) || amt < 0) {
          toast.error('Fixed discount amount cannot be negative');
          setIsCreatingPlan(false);
          return;
        }
      } else if (newPlan.discount_type === 'flat_rate') {
        const rate = Number(newPlan.flat_hourly_rate);
        if (isNaN(rate) || rate <= 0) {
          toast.error('Flat hourly rate must be greater than ₹0/hr');
          setIsCreatingPlan(false);
          return;
        }
      }

      const res = await fetch('/api/membership-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlan.name.trim(),
          price: Number(newPlan.price) || 0,
          duration_months: Number(newPlan.duration_months) || 1,
          discount_type: newPlan.discount_type,
          discount_percent: newPlan.discount_type === 'percentage' ? Number(newPlan.discount_percent) || 0 : 0,
          discount_amount: newPlan.discount_type === 'fixed' ? Number(newPlan.discount_amount) || 0 : 0,
          flat_hourly_rate: newPlan.discount_type === 'flat_rate' ? Number(newPlan.flat_hourly_rate) || 0 : 0,
          benefits: newPlan.benefits.split(',').map(b => b.trim()).filter(Boolean)
        })
      });
      if (res.ok) {
        fetchMembershipPlans();
        setNewPlan({ name: '', price: 0, duration_months: 1, benefits: '', discount_type: 'percentage', discount_percent: 0, discount_amount: 0, flat_hourly_rate: 0 });
        toast.success('Membership plan created successfully');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to create plan');
      }
    } catch {
      toast.error('Error creating plan');
    } finally {
      setIsCreatingPlan(false);
    }
  };

  const handleLoadDummyPlans = async () => {
    try {
      const dummies = [
        { name: 'Bronze Monthly', price: 999, duration_months: 1, discount_type: 'percentage', discount_percent: 5, discount_amount: 0, benefits: ['5% off F&B', 'Basic Access'] },
        { name: 'Silver Quarterly', price: 2499, duration_months: 3, discount_type: 'percentage', discount_percent: 10, discount_amount: 0, benefits: ['10% off F&B', 'Free Locker'] },
        { name: 'Gold Annual', price: 7999, duration_months: 12, discount_type: 'fixed', discount_percent: 0, discount_amount: 100, benefits: ['Flat ₹100 off sessions', 'Priority Booking', 'Free Locker'] }
      ];
      
      for (const plan of dummies) {
        await fetch('/api/membership-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(plan)
        });
      }
      await fetchMembershipPlans();
      toast.success('Template plans generated!');
    } catch {
      toast.error('Failed to load templates');
    }
  };

  const handleTogglePlanStatus = async (plan: any) => {
    try {
      const res = await fetch('/api/membership-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...plan, status: plan.status === 'Active' ? 'Archived' : 'Active' })
      });
      if (res.ok) {
        fetchMembershipPlans();
        toast.success('Plan updated');
      }
    } catch {
      toast.error('Error');
    }
  };

  // Password / PIN Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New PINs do not match.');
      return;
    }
    if (newPassword.length !== 4) {
      setPasswordError('PIN must be exactly 4 digits.');
      return;
    }
    setIsChangingPassword(true);
    setPasswordError('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, currentPassword, newPassword })
      });
      if (res.ok) {
        toast.success('PIN changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const err = await res.json();
        setPasswordError(err.error || 'Failed to change PIN.');
      }
    } catch {
      setPasswordError('Network error.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <>
      <div className="w-full flex flex-col gap-8 pb-20">
      <div className="mb-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">{t('settings', 'Settings')}</h1>
        <p className="text-text-secondary text-xs sm:text-sm">Configure your business profile, language preferences, pricing rules, and security preferences.</p>
      </div>

      {/* Language & Regional Preferences */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
              <Globe className="w-5 h-5 text-accent" />
              <span>{t('language', 'Language')} & Regional Preferences</span>
            </h2>
            <p className="text-text-secondary text-xs sm:text-sm mt-1">
              Choose your preferred interface language. Changes reflect across the dashboard and bot immediately.
            </p>
          </div>
          <FancyLanguageToggle />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[44px] touch-target ${
              language === 'en'
                ? 'border-accent bg-accent/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-2 ring-accent'
                : 'border-border-theme bg-bg-surface hover:border-border-light hover:bg-bg-surface/80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-text-primary">English</span>
              {language === 'en' && <span className="text-accent text-xs font-bold bg-accent/20 px-2 py-0.5 rounded-full">Active</span>}
            </div>
            <p className="text-xs text-text-secondary">Standard English interface across all tabs, reports, and controls.</p>
            <span className="text-xs font-mono font-bold text-accent mt-3">EN</span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage('hi')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[44px] touch-target ${
              language === 'hi'
                ? 'border-accent bg-accent/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-2 ring-accent'
                : 'border-border-theme bg-bg-surface hover:border-border-light hover:bg-bg-surface/80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-text-primary">हिंदी</span>
              {language === 'hi' && <span className="text-accent text-xs font-bold bg-accent/20 px-2 py-0.5 rounded-full">सक्रिय</span>}
            </div>
            <p className="text-xs text-text-secondary">हिंदी इंटरफ़ेस — बिलिंग, टेबल, बुकिंग और खाता प्रबंधन।</p>
            <span className="text-xs font-mono font-bold text-accent mt-3">हिं (Hindi)</span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage('mr')}
            className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[44px] touch-target ${
              language === 'mr'
                ? 'border-accent bg-accent/10 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-2 ring-accent'
                : 'border-border-theme bg-bg-surface hover:border-border-light hover:bg-bg-surface/80'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-lg font-bold text-text-primary">मराठी</span>
              {language === 'mr' && <span className="text-accent text-xs font-bold bg-accent/20 px-2 py-0.5 rounded-full">सक्रिय</span>}
            </div>
            <p className="text-xs text-text-secondary">मराठी इंटरफेस — टेबल्स, सेशन्स, क्यू-खाते व बिलिंग नियंत्रण।</p>
            <span className="text-xs font-mono font-bold text-accent mt-3">मरा (Marathi)</span>
          </button>
        </div>
      </div>

      {/* Business Profile Configuration */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">Business Profile</h2>
            <p className="text-text-secondary text-xs sm:text-sm mt-1">Update your basic business information.</p>
          </div>
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget as HTMLFormElement);
          const profile = {
            business_name: formData.get('business_name'),
            owner_name: formData.get('owner_name'),
            contact_number: formData.get('contact_number'),
            public_contact_number: formData.get('public_contact_number'),
            address: formData.get('address'),
            business_type: formData.get('business_type'),
            latitude: formData.get('latitude') ? Number(formData.get('latitude')) : null,
            longitude: formData.get('longitude') ? Number(formData.get('longitude')) : null,
            google_place_id: formData.get('google_place_id') ? String(formData.get('google_place_id')).trim() : null
          };
          await handleSaveConfig(undefined, undefined, undefined, profile);
          setData((prev: any) => prev ? { 
            ...prev, 
            businessName: profile.business_name as string, 
            ownerName: profile.owner_name as string, 
            contact_number: profile.contact_number as string, 
            public_contact_number: profile.public_contact_number as string,
            address: profile.address as string, 
            business_type: profile.business_type as string,
            latitude: profile.latitude,
            longitude: profile.longitude,
            google_place_id: profile.google_place_id
          } : prev);
        }} className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Club Name</label>
            <input type="text" name="business_name" defaultValue={data?.businessName || ''} required className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Owner Name</label>
            <input type="text" name="owner_name" defaultValue={data?.ownerName || ''} required className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">Owner Login Phone</label>
              <span className="text-[10px] text-text-secondary font-mono">Private • OTP Login</span>
            </div>
            <input type="text" name="contact_number" defaultValue={(data as any)?.contact_number || ''} required placeholder="9876543210" className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">Public Contact Phone</label>
              <span className="text-[10px] text-text-secondary font-mono">Customer Support</span>
            </div>
            <input type="text" name="public_contact_number" defaultValue={(data as any)?.public_contact_number || ''} placeholder="Displayed on WhatsApp & Directions" className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Business Type</label>
            <select name="business_type" defaultValue={(data as any)?.business_type || 'Pool/Snooker Club'} className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]">
              <option value="Pool/Snooker Club">Pool / Snooker Club</option>
              <option value="Gaming Cafe / PS5">Gaming Cafe / PS5</option>
              <option value="Turf / Sports Arena">Turf / Sports Arena</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Club Deep-Link Slug</label>
            <input type="text" disabled value={(data as any)?.slug || (data?.businessName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')} className="w-full px-4 py-3 bg-bg-primary/50 border border-border-light/60 rounded-lg text-base sm:text-sm text-text-secondary min-h-[44px] cursor-not-allowed font-mono" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Latitude (GPS)</label>
            <input type="number" step="any" name="latitude" defaultValue={(data as any)?.latitude || ''} placeholder="e.g. 18.5074" className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Longitude (GPS)</label>
            <input type="number" step="any" name="longitude" defaultValue={(data as any)?.longitude || ''} placeholder="e.g. 73.8077" className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]" />
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">Google Place ID (Optional)</label>
              <span className="text-[10px] text-text-secondary font-mono">For Google Reviews & Rating Sync</span>
            </div>
            <input type="text" name="google_place_id" defaultValue={(data as any)?.google_place_id || ''} placeholder="ChIJ... (found via Google Maps Place ID finder)" className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px] font-mono" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Address</label>
            <textarea name="address" defaultValue={(data as any)?.address || ''} rows={2} className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary"></textarea>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={isUpdatingConfig} className="w-full sm:w-auto px-8 bg-accent text-black font-extrabold py-3.5 rounded-lg hover-lift smooth-transition hover:bg-accent/90 transition-colors disabled:opacity-50 min-h-[44px] touch-target shadow-sm">
              {isUpdatingConfig ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        {/* Central WhatsApp Booking Deep-Link Card */}
        {(() => {
          const clubSlug = (data as any)?.slug || (data?.businessName || '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
          const deepLinkText = `Book at ${data?.businessName || 'Club'} (Code: QC_${clubSlug})`;
          const deepLinkUrl = `https://wa.me/${process.env.NEXT_PUBLIC_CENTRAL_WHATSAPP_NUMBER || '919876543210'}?text=${encodeURIComponent(deepLinkText)}`;

          return (
            <div className="mt-6 pt-6 border-t border-border-theme bg-bg-primary/40 rounded-xl p-4 sm:p-5 border border-border-theme/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div>
                  <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    Central WhatsApp Booking Deep-Link
                  </h3>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Share this link on Instagram, Google Maps, or print it as a QR code for your reception counter.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(deepLinkUrl);
                    toast.success('Copied WhatsApp booking link!');
                  }}
                  className="px-4 py-2 bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 rounded-lg text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 self-start sm:self-center"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </button>
              </div>

              <div className="flex items-center gap-2 bg-bg-surface border border-border-theme rounded-lg p-2.5 font-mono text-xs text-text-secondary overflow-x-auto select-all">
                <span className="text-accent font-bold">URL:</span>
                <span className="truncate">{deepLinkUrl}</span>
              </div>
              <div className="mt-2 text-[11px] text-text-secondary flex flex-wrap items-center gap-2">
                <span className="font-bold text-text-primary">Ingress Code:</span>
                <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 font-mono text-accent font-bold">
                  QC_{clubSlug}
                </span>
                <span>• Automatically detects and routes customers to {data?.businessName || 'your club'}.</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Venue Photos & Ambience Gallery */}
      <VenuePhotosSection businessId={businessId} businessData={data} />

      {/* Google Sheets Integration */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
              Google Sheets Database
            </h2>
            <p className="text-text-secondary text-xs sm:text-sm mt-1">
              Connect a Google Sheet to sync all your operational sessions, member records, bookings, and F&B orders in real-time.
            </p>
          </div>
          {data?.google_sheet_id && (
            <a href={`https://docs.google.com/spreadsheets/d/${data.google_sheet_id}/edit`} target="_blank" rel="noreferrer" className="px-4 py-2.5 bg-green-500/10 text-green-500 font-bold text-xs sm:text-sm rounded-lg border border-green-500/20 hover:bg-green-500/20 transition-colors min-h-[44px] touch-target inline-flex items-center">
              Open Live Sheet ↗
            </a>
          )}
        </div>

        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!businessId) return;
          const formData = new FormData(e.currentTarget as HTMLFormElement);
          let sheetId = (formData.get('google_sheet_id') as string).trim();
          if (sheetId.includes('/d/')) {
            const match = sheetId.match(/\/d\/([a-zA-Z0-9-_]+)/);
            if (match && match[1]) sheetId = match[1];
          }
          await handleSaveConfig(undefined, undefined, sheetId);
        }} className="max-w-md flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Google Sheet ID or URL</label>
            <input type="text" name="google_sheet_id" defaultValue={data?.google_sheet_id || ''} placeholder="e.g. 1Fyz4aSQyzjvY..." className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]" />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <button type="submit" disabled={isUpdatingConfig} className="flex-1 bg-accent text-black font-extrabold py-3.5 rounded-lg hover-lift smooth-transition hover:bg-accent/90 transition-colors disabled:opacity-50 min-h-[44px] touch-target shadow-sm">
              {isUpdatingConfig ? 'Saving...' : 'Connect Sheet'}
            </button>
            {data?.google_sheet_id && (
              <>
                <button 
                  type="button"
                  disabled={isUpdatingConfig}
                  onClick={async () => {
                    if(!businessId || !data?.google_sheet_id) return;
                    const toastId = toast.loading('Refreshing sheet structure without overwriting data...');
                    try {
                      const res = await fetch('/api/update-business-config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ business_id: businessId, action: 'refresh_sheet_structure', google_sheet_id: data.google_sheet_id })
                      });
                      if(!res.ok) throw new Error('Failed to refresh structure');
                      toast.success('Sheet structure restored successfully!', { id: toastId });
                    } catch(e) {
                      toast.error('Error refreshing structure.', { id: toastId });
                    }
                  }}
                  className="flex-1 bg-bg-primary text-text-primary border border-border-light font-bold py-3.5 rounded-lg hover-lift smooth-transition hover:border-accent transition-colors disabled:opacity-50 text-xs min-h-[44px] touch-target"
                >
                  Refresh Structure
                </button>
                <button 
                  type="button"
                  disabled={isUpdatingConfig}
                  onClick={async () => {
                    if(!businessId || !data?.google_sheet_id) return;
                    const defaultMonth = new Date().toISOString().substring(0, 7);
                    const promptMonth = window.prompt("Enter month to reconcile (YYYY-MM):", defaultMonth);
                    if (!promptMonth) return;
                    const toastId = toast.loading(`Reconciling ${promptMonth} with Google Sheets...`);
                    try {
                      const res = await fetch('/api/sheets/reconcile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ business_id: businessId, month: promptMonth.trim() })
                      });
                      const json = await res.json();
                      if(!res.ok || !json.success) throw new Error(json.error || 'Reconciliation failed');
                      const r = json.report;
                      toast.success(`Reconciled: ${r.totalDbSessions} sessions (${r.createdInSheet} added, ${r.updatedInSheet} updated, ${r.ordersSynced} F&B orders synced)`, { id: toastId, duration: 6000 });
                    } catch(e: any) {
                      toast.error(`Reconciliation error: ${e.message}`, { id: toastId });
                    }
                  }}
                  className="flex-1 bg-accent/10 text-accent border border-accent/20 font-bold py-3.5 rounded-lg hover-lift smooth-transition hover:bg-accent/20 transition-colors disabled:opacity-50 text-xs min-h-[44px] touch-target"
                >
                  Reconcile Month
                </button>
              </>
            )}
          </div>
          <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-xs text-blue-400 font-bold mb-1">Important:</p>
            <p className="text-xs text-text-secondary">You must share your Google Sheet with <span className="font-mono text-accent">{data?.google_service_account_email || 'sheet-access@invom-499909.iam.gserviceaccount.com'}</span> and grant it <b>Editor</b> access.</p>
          </div>
        </form>
      </div>

      {/* UPI Payment Configuration */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8 shadow-sm">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">UPI Payment</h2>
        <p className="text-text-secondary text-xs sm:text-sm mb-6">Configure your business UPI ID to dynamically generate payment QR codes when sessions end.</p>
        
        <div className="max-w-md flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Business UPI ID</label>
            <div className="relative">
              <input 
                type="text" 
                defaultValue={data?.pricingRules?.globalSettings?.preferences?.business_upi_id || ''}
                placeholder="yourbusiness@upi"
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val && !val.includes('@')) {
                    toast.error('Please enter a valid UPI ID (e.g. name@upi)');
                    return;
                  }
                  if (val !== (data?.pricingRules?.globalSettings?.preferences?.business_upi_id || '')) {
                    handleUpdatePreference('business_upi_id', val);
                  }
                }}
                className="w-full pl-10 pr-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]" 
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50 text-base">₹</span>
            </div>
          </div>
          {data?.pricingRules?.globalSettings?.preferences?.business_upi_id ? (
            <p className="text-xs text-accent font-bold mt-1 inline-flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> UPI payments active</p>
          ) : (
            <p className="text-xs text-warning font-bold mt-1 inline-flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Please configure your UPI ID</p>
          )}
        </div>
      </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8 shadow-sm">
        <h2 className="text-xl sm:text-2xl font-bold mb-6">Business Goals</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!businessId) return;
          const formData = new FormData(e.currentTarget as HTMLFormElement);
          const goals = {
            daily_revenue: Number(formData.get('daily_revenue')),
            daily_sessions: Number(formData.get('daily_sessions'))
          };
          try {
            const res = await fetch('/api/update-goals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ business_id: businessId, goals })
            });
            if (res.ok) {
              toast.success('Settings updated.');
            } else {
              const errJson = await res.json().catch(() => ({}));
              toast.error(errJson.error || "Failed to save goals.");
            }
          } catch(err: any) { toast.error(err?.message || "Failed to save goals."); }
        }} className="max-w-md flex flex-col gap-4">
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Daily Revenue Target (₹)</label>
            <input type="number" name="daily_revenue" defaultValue={data.goals?.daily_revenue || 0} className="w-full px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]" />
          </div>
          <button type="submit" className="w-full mt-2 bg-accent text-black font-extrabold py-3.5 rounded-lg hover-lift smooth-transition hover:bg-accent/90 transition-colors min-h-[44px] touch-target shadow-sm">
            Save Goals
          </button>
        </form>
      </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-border-theme pb-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5">
                      Game Categories &amp; PS5 Support
                    </h2>
                    <p className="text-text-secondary text-xs sm:text-sm mt-1">
                      Configure dynamic pricing, time slots, schedules, and multiplayer rules for all sports including PS5.
                    </p>
                  </div>
                  {!data?.pricingRules?.rules?.['ps5'] ? (
                    <button
                      onClick={handleEnablePS5}
                      disabled={isUpdatingConfig}
                      className="px-5 py-3 bg-accent text-black font-extrabold text-xs sm:text-sm uppercase rounded-lg hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 shrink-0 min-h-[44px] touch-target"
                    >
                      + Enable PS5 Support
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold font-mono tracking-widest border border-accent/50 text-accent bg-accent/10 uppercase shadow-sm">
                      <Check className="w-3.5 h-3.5" />
                      <span>PS5 Natively Active</span>
                    </span>
                  )}
                </div>
        
                
        <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Configure Pricing Schedules &amp; Rates</h3>
                    <div className="flex w-full overflow-x-auto custom-scrollbar p-1 bg-bg-surface border border-border-theme rounded-xl mb-4 gap-1 shadow-inner" role="tablist">
                      {Object.keys(data?.pricingRules?.rules || {}).map(game => {
                        const isActive = selectedGameRule === game;
                        return (
                          <button
                            key={game}
                            onClick={() => setSelectedGameRule(game)}
                            className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold capitalize transition-all duration-200 outline-none whitespace-nowrap focus-visible:ring-2 focus-visible:ring-accent min-h-[44px] touch-target ${
                              isActive 
                                ? 'bg-accent/10 text-accent border border-accent/30 ring-1 ring-accent/50 shadow-sm' 
                                : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/50 border border-transparent'
                            }`}
                            aria-selected={isActive}
                            role="tab"
                          >
                            {isActive && <svg className="w-3.5 h-3.5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                            {!isActive && <span className="text-[14px] opacity-70"></span>}
                            <span>{game === 'ps5' ? 'PS5' : game}</span>
                          </button>
                        );
                      })}
                    </div>
        
                    {(() => {
                      const currentRule = data?.pricingRules?.rules?.[selectedGameRule] || { type: 'fixed', rate: 200, multiplayer_mode: 'none' };
                      return (
                        <div className="p-4 sm:p-5 rounded-xl border border-border-theme bg-bg-primary flex flex-col gap-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold capitalize font-mono text-accent">{selectedGameRule} Rule Configuration</span>
                            <span className="text-[10px] uppercase tracking-widest font-bold text-text-secondary bg-bg-surface px-2 py-0.5 rounded border border-border-theme">Dynamic Engine</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Pricing Model</label>
                              <CustomSelect
                                value={currentRule.type || 'fixed'}
                                onChange={v => {
                                  const updated = { ...currentRule, type: v };
                                  const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                                  handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                                }}
                                options={[
                                  {value: "fixed", label: "Flat Rate (Fixed ₹/hr)"},
                                  {value: "time_based", label: "Schedule / Time Slots (Day & Evening)"}
                                ]}
                                className="py-2.5 min-h-[44px] text-xs font-bold"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Multiplayer Mode</label>
                              <CustomSelect
                                value={currentRule.multiplayer_mode || 'none'}
                                onChange={v => {
                                  const updated = { ...currentRule, multiplayer_mode: v };
                                  const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                                  handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                                }}
                                options={[
                                  {value: "none", label: "Disabled (Single rate)"},
                                  {value: "multiply", label: "Multiply Rate by Players"},
                                  {value: "base_plus_extra", label: "Base Rate + Extra per Additional Player"}
                                ]}
                                className="py-2.5 min-h-[44px] text-xs font-bold"
                              />
                            </div>
                            {currentRule.type === 'fixed' ? (
                              <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Flat Rate (₹ / hr)</label>
                                <input
                                  type="number"
                                  defaultValue={currentRule.rate || 0}
                                  onBlur={e => {
                                    const val = Number(e.target.value) || 0;
                                    if (val === currentRule.rate) return;
                                    const updated = { ...currentRule, rate: val };
                                    const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                                    handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                                  }}
                                  className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-base sm:text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[44px]"
                                />
                              </div>
                            ) : (
                              <>
                                <div>
                                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Day Rate (₹ / hr)</label>
                                  <input
                                    type="number"
                                    defaultValue={currentRule.day_rate || currentRule.am_rate || 0}
                                    onBlur={e => {
                                      const val = Number(e.target.value) || 0;
                                      const updated = { ...currentRule, day_rate: val, am_rate: val };
                                      const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                                      handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                                    }}
                                    className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-base sm:text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[44px]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Evening/Peak Rate (₹ / hr)</label>
                                  <input
                                    type="number"
                                    defaultValue={currentRule.evening_rate || currentRule.pm_rate || 0}
                                    onBlur={e => {
                                      const val = Number(e.target.value) || 0;
                                      const updated = { ...currentRule, evening_rate: val, pm_rate: val };
                                      const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                                      handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                                    }}
                                    className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-base sm:text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[44px]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Opening Hour (24h format)</label>
                                  <input
                                    type="number" min="0" max="23"
                                    defaultValue={currentRule.opening_hour ?? 6}
                                    onBlur={e => {
                                      const val = Number(e.target.value) || 0;
                                      const updated = { ...currentRule, opening_hour: val };
                                      const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                                      handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                                    }}
                                    className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-base sm:text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[44px]"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Cutoff Hour (Evening start, e.g. 16)</label>
                                  <input
                                    type="number" min="0" max="23"
                                    defaultValue={currentRule.cutoff_hour ?? 16}
                                    onBlur={e => {
                                      const val = Number(e.target.value) || 0;
                                      const updated = { ...currentRule, cutoff_hour: val };
                                      const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                                      handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                                    }}
                                    className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-base sm:text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[44px]"
                                  />
                                </div>
                              </>
                            )}
                            {currentRule.multiplayer_mode === 'base_plus_extra' && (
                              <div>
                                <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Extra Charge / Player (₹)</label>
                                <input
                                  type="number"
                                  defaultValue={currentRule.extra_per_player || 50}
                                  onBlur={e => {
                                    const val = Number(e.target.value) || 0;
                                    const updated = { ...currentRule, extra_per_player: val };
                                    const newRules = { ...data?.pricingRules?.rules, [selectedGameRule]: updated };
                                    handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                                  }}
                                  className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-base sm:text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[44px]"
                                />
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] text-text-secondary italic mt-1">ℹ️ Changes save automatically when you click outside the input box.</p>
                          <button onClick={() => {
                            if (!confirm(`Are you sure you want to delete the ${selectedGameRule} category? This will break any tables mapped to it.`)) return;
                            const newRules = { ...data?.pricingRules?.rules };
                            delete newRules[selectedGameRule];
                            const keys = Object.keys(newRules);
                            if (keys.length > 0) setSelectedGameRule(keys[0]);
                            handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                          }} className="mt-2 w-fit px-4 py-2.5 bg-error/10 text-error rounded hover:bg-error/20 transition-colors text-xs font-bold tracking-widest uppercase min-h-[44px] touch-target flex items-center">
                            Delete Category
                          </button>
                        </div>
                      );
                    })()}

                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget as HTMLFormElement);
                      const newCat = (formData.get('new_category') as string).trim().toLowerCase();
                      if (!newCat) return;
                      if (data?.pricingRules?.rules?.[newCat]) {
                        toast.error('Category already exists!');
                        return;
                      }
                      const newRules = { ...data?.pricingRules?.rules, [newCat]: { type: 'fixed', rate: 200, multiplayer_mode: 'none' } };
                      handleSaveConfig({ ...data?.pricingRules, rules: newRules }, undefined);
                      setSelectedGameRule(newCat);
                      (e.target as HTMLFormElement).reset();
                    }} className="flex flex-col sm:flex-row gap-2">
                      <input type="text" name="new_category" placeholder="Add new game category (e.g. Snooker)" className="flex-1 px-4 py-3 bg-bg-primary border border-border-light rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]" />
                      <button type="submit" disabled={isUpdatingConfig} className="px-6 py-3 bg-accent text-black font-extrabold rounded-lg hover:bg-accent/90 transition-colors min-h-[44px] touch-target shadow-sm">Add Category</button>
                    </form>
                  </div>
      </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-visible p-4 sm:p-6 md:p-8">
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 mb-6 border-b border-border-theme pb-4">
          Stations &amp; Tables Configuration
        </h2>
        {/* Station Management */}
                  <div className="flex flex-col gap-4 pt-2">
                    <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Stations &amp; Tables</h3>
                    <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-2">
                      {data?.tables?.map((t: any) => (
                        <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-bg-primary border border-border-theme text-xs">
                          <div>
                            <span className="font-mono font-bold text-accent">{t.id}</span>
                            <span className="mx-2 text-text-secondary">•</span>
                            <span className="font-bold text-text-primary">{t.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase bg-bg-surface border border-border-theme text-primary">
                              {t.type}
                            </span>
                            <Tooltip text="Delete Station">
                              <button
                                type="button"
                                onClick={() => confirmDeleteStation(t)}
                                className="p-2 text-text-secondary hover:text-red-500 transition-colors bg-bg-surface border border-border-theme hover:border-red-500 rounded min-h-[36px] min-w-[36px] flex items-center justify-center touch-target"
                                aria-label="Delete Station"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </div>
        
                    <form onSubmit={handleAddStation} className="p-4 rounded-xl border border-border-theme bg-bg-primary/60 flex flex-col gap-3 mt-auto">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Add New Station / Table</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="ID (e.g. PS5-1)"
                          required
                          value={newStationId}
                          onChange={e => setNewStationId(e.target.value.toUpperCase())}
                          className="px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-base sm:text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[44px]"
                        />
                        <input
                          type="text"
                          placeholder="Name (PS5 Lounge)"
                          required
                          value={newStationName}
                          onChange={e => setNewStationName(e.target.value)}
                          className="px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-base sm:text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[44px]"
                        />
                      </div>
                      <CustomSelect
                        value={newStationType}
                        onChange={v => setNewStationType(v)}
                        options={Object.keys(data?.pricingRules?.rules || { snooker: {}, pool: {}, ps5: {} }).map(type => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) }))}
                        className="py-2.5 min-h-[44px] text-xs font-bold capitalize"
                      />
                      {newStationType === 'ps5' && (
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1.5 ml-1">Max Players</label>
                          <input
                            type="number"
                            min="1"
                            max="8"
                            required
                            value={newStationMaxPlayers}
                            onChange={e => setNewStationMaxPlayers(e.target.value)}
                            className="w-full px-3 py-2 bg-bg-card border border-border-theme rounded-lg text-base sm:text-xs font-bold text-text-primary outline-none focus:border-accent min-h-[44px]"
                            placeholder="e.g. 4"
                          />
                        </div>
                      )}
                      <button type="submit" disabled={isUpdatingConfig || !newStationId} className="w-full bg-accent text-black font-extrabold py-3 rounded-lg hover:bg-accent/90 transition-colors text-xs uppercase shadow-md shadow-accent/10 min-h-[44px] touch-target">
                        {isUpdatingConfig ? 'Adding...' : '+ Create Station'}
                      </button>
                    </form>
                  </div>
      </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 border-b border-border-theme pb-4">Launch Promotion</h2>
              <form onSubmit={handleSavePromo} className="max-w-2xl flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Promotion Title <span className="text-danger">*</span></label>
                  <input 
                    type="text" 
                    required
                    value={promoTitle}
                    onChange={e => setPromoTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                    placeholder="e.g. Afternoon Elite"
                    list="promo-suggestions"
                  />
                  <datalist id="promo-suggestions">
                    <option value="Weekend Special" />
                    <option value="Happy Hours" />
                    <option value="Game Night" />
                    <option value="Weekend Gaming Deal" />
                    <option value="Early Bird Offer" />
                    <option value="Student Special" />
                    <option value="Festive Offer" />
                    <option value="Loyalty Reward" />
                    <option value="Evening Special" />
                    <option value="Monthly Membership Offer" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Description</label>
                  <input 
                    type="text" 
                    value={promoDescription}
                    onChange={e => setPromoDescription(e.target.value)}
                    className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                    placeholder="e.g. valid only for members"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Promotion Type <span className="text-danger">*</span></label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button type="button" onClick={() => setPromoType('percentage')} className={`py-3 px-3 rounded-lg text-xs font-bold border transition-colors min-h-[44px] touch-target flex items-center justify-center ${promoType === 'percentage' ? 'bg-accent/20 border-accent text-accent' : 'bg-bg-primary border-border-theme text-text-secondary hover:border-accent/50'}`}>Percentage (%)</button>
                    <button type="button" onClick={() => setPromoType('fixed_price')} className={`py-3 px-3 rounded-lg text-xs font-bold border transition-colors min-h-[44px] touch-target flex items-center justify-center ${promoType === 'fixed_price' ? 'bg-accent/20 border-accent text-accent' : 'bg-bg-primary border-border-theme text-text-secondary hover:border-accent/50'}`}>Fixed Rate (₹)</button>
                    <button type="button" onClick={() => setPromoType('fixed_amount')} className={`py-3 px-3 rounded-lg text-xs font-bold border transition-colors min-h-[44px] touch-target flex items-center justify-center ${promoType === 'fixed_amount' ? 'bg-accent/20 border-accent text-accent' : 'bg-bg-primary border-border-theme text-text-secondary hover:border-accent/50'}`}>Discount (₹)</button>
                  </div>
                </div>

                {promoType === 'percentage' && (
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Discount Percent (%) <span className="text-danger">*</span></label>
                    <input 
                    type="number" 
                    required min="1" max="100"
                    value={promoDiscount}
                    onChange={e => setPromoDiscount(e.target.value)}
                    className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                  />
                  </div>
                )}

                {promoType === 'fixed_price' && (
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Fixed Promotional Rate (₹/hr) <span className="text-danger">*</span></label>
                    <input 
                      type="number" 
                      required min="1"
                      value={promoFixedPrice}
                      onChange={e => setPromoFixedPrice(e.target.value)}
                      className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                      placeholder="e.g. 150"
                    />
                  </div>
                )}

                {promoType === 'fixed_amount' && (
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Flat Amount Discount (₹) <span className="text-danger">*</span></label>
                    <input 
                      type="number" 
                      required min="1"
                      value={promoFixedAmount}
                      onChange={e => setPromoFixedAmount(e.target.value)}
                      className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                      placeholder="e.g. 50"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Applicable Games (Leave empty for all)</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(data?.pricingRules?.rules || { snooker: {}, pool: {}, ps5: {} }).map(game => (
                      <button 
                        key={game} type="button"
                        onClick={() => setPromoGames(prev => prev.includes(game) ? prev.filter(g => g !== game) : [...prev, game])}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors capitalize min-h-[40px] touch-target ${promoGames.includes(game) ? 'bg-accent/20 border-accent text-accent' : 'bg-bg-primary border-border-theme text-text-secondary hover:border-accent/50'}`}
                      >
                        {game}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Start Date <span className="text-danger">*</span></label>
                    <input 
                      type="date" 
                      required
                      value={promoStartDate}
                      onChange={e => setPromoStartDate(e.target.value)}
                      className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Start Time <span className="text-danger">*</span></label>
                    <input 
                      type="time" 
                      required
                      value={promoStartTime}
                      onChange={e => setPromoStartTime(e.target.value)}
                      className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">End Date <span className="text-danger">*</span></label>
                    <input 
                      type="date" 
                      required
                      value={promoEndDate}
                      onChange={e => setPromoEndDate(e.target.value)}
                      className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">End Time <span className="text-danger">*</span></label>
                    <input 
                      type="time" 
                      required
                      value={promoEndTime}
                      onChange={e => setPromoEndTime(e.target.value)}
                      className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                    />
                  </div>
                </div>
                
                {/* Specific Time Slot Toggle */}
                <div className="bg-bg-surface border border-border-theme p-4 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer mb-2 min-h-[40px]">
                    <input 
                      type="checkbox" 
                      checked={promoTimeSlotEnabled}
                      onChange={e => setPromoTimeSlotEnabled(e.target.checked)}
                      className="w-4 h-4 text-accent bg-bg-primary border-border-theme rounded focus:ring-accent"
                    />
                    <span className="text-sm font-bold text-text-primary">Limit to specific daily hours (Happy Hour)</span>
                  </label>
                  
                  {promoTimeSlotEnabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Daily Start Time</label>
                        <input 
                          type="time" 
                          required
                          value={promoTimeSlotStart}
                          onChange={e => setPromoTimeSlotStart(e.target.value)}
                          className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Daily End Time</label>
                        <input 
                          type="time" 
                          required
                          value={promoTimeSlotEnd}
                          onChange={e => setPromoTimeSlotEnd(e.target.value)}
                          className="w-full px-4 py-3 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Live Preview */}
                <div className="bg-bg-surface border border-border-theme p-4 rounded-lg text-sm flex flex-col gap-1">
                  {(() => {
                    if (!promoStartDate || !promoStartTime || !promoEndDate || !promoEndTime) return <span className="text-text-secondary">Fill all fields to see preview</span>;
                    try {
                      const istOffset = 5.5 * 60 * 60 * 1000;
                      
                      const [year, month, day] = promoStartDate.split('-').map(Number);
                      const [hour, min] = promoStartTime.split(':').map(Number);
                      const localTimeUtc = new Date(Date.UTC(year, month - 1, day, hour, min, 0));
                      const startDateTime = new Date(localTimeUtc.getTime() - istOffset);
                      
                      const [endYear, endMonth, endDay] = promoEndDate.split('-').map(Number);
                      const [endHour, endMin] = promoEndTime.split(':').map(Number);
                      const endLocalTimeUtc = new Date(Date.UTC(endYear, endMonth - 1, endDay, endHour, endMin, 0));
                      const endDateTime = new Date(endLocalTimeUtc.getTime() - istOffset);
                      
                      const isPastEnd = endDateTime <= new Date();
                      const initialStatus = startDateTime > new Date() ? 'Scheduled' : 'Active';
                      return (
                        <>
                          <div className="flex justify-between items-center"><span className="text-text-secondary">Starts:</span> <span className="font-bold">{startDateTime.toLocaleString()}</span></div>
                          <div className="flex justify-between items-center"><span className="text-text-secondary">Ends:</span> <span className="font-bold">{endDateTime.toLocaleString()}</span></div>
                          <div className="flex justify-between items-center mt-2 border-t border-border-light pt-2">
                            <span className="text-text-secondary">Initial Status:</span>
                            <span className={`font-bold px-2 py-0.5 rounded text-xs ${isPastEnd ? 'bg-danger/20 text-danger' : (initialStatus === 'Active' ? 'bg-success/20 text-success' : 'bg-accent/20 text-accent')}`}>
                              {isPastEnd ? 'Invalid (Past End Date)' : initialStatus}
                            </span>
                          </div>
                          {promoTimeSlotEnabled && promoTimeSlotStart && promoTimeSlotEnd && (
                            <div className="flex justify-between items-center mt-1 border-t border-border-light/50 pt-1">
                              <span className="text-text-secondary">Daily Window:</span>
                              <span className="font-bold text-accent">{promoTimeSlotStart} - {promoTimeSlotEnd}</span>
                            </div>
                          )}
                        </>
                      );
                    } catch (e) {
                      return <span className="text-danger text-sm">Invalid date format</span>;
                    }
                  })()}
                </div>
                <div className="flex gap-4 mt-2">
                  <button type="submit" disabled={isUpdatingPromo} className="flex-1 bg-accent text-black font-extrabold py-3.5 rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 min-h-[44px] touch-target shadow-sm">
                    {isUpdatingPromo ? 'Saving...' : 'Launch Promo'}
                  </button>
                </div>
              </form>
              
              {/* Active / Scheduled Promotions List */}
              {data?.activePromotions && data.activePromotions.length > 0 && (
                <div className="mt-8 border-t border-border-theme pt-6">
                  <h3 className="text-lg font-bold mb-4">Current &amp; Past Promotions</h3>
                  <div className="flex flex-col gap-3">
                    {data.activePromotions.map((promo: any) => {
                      let displayStatus = promo.status;
                      const sTime = parseDateString((promo as any).start_time);
                      const eTime = parseDateString((promo as any).end_time);
                      const currTime = now.getTime();
                      if (displayStatus === 'Active' || displayStatus === 'Scheduled') {
                        if (eTime <= currTime) displayStatus = 'Expired';
                        else if (sTime <= currTime) displayStatus = 'Active';
                        else displayStatus = 'Scheduled';
                      }
                      const statusColor = displayStatus === 'Active' ? 'bg-success/20 text-success' : 
                                          displayStatus === 'Scheduled' ? 'bg-accent/20 text-accent' : 
                                          displayStatus === 'Paused' ? 'bg-warning/20 text-warning' : 
                                          'bg-bg-surface text-text-secondary';
                      return (
                        <div key={promo.id} className="border border-border-theme bg-bg-surface rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-text-primary">{(promo as any).name}</span>
                              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold ${statusColor}`}>{displayStatus}</span>
                            </div>
                            <div className="text-xs text-text-secondary flex gap-2">
                              <span><strong className="text-text-primary">{promo.discount_percent}%</strong> off</span>
                              <span>•</span>
                              <span>{new Date((promo as any).start_time).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})} - {new Date((promo as any).end_time).toLocaleString(undefined, {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</span>
                            </div>
                          </div>
                          {promo.time_slot_start && promo.time_slot_end && (
                            <div className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-lg ml-auto mr-4 text-xs font-bold text-accent">
                              Happy Hour: {promo.time_slot_start} - {promo.time_slot_end}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {displayStatus === 'Scheduled' && (
                              <button onClick={() => handleUpdatePromoStatus(promo.id, 'Cancelled')} disabled={isUpdatingPromo} className="text-xs bg-danger/10 text-danger border border-danger/30 px-3.5 py-2 rounded hover:bg-danger/20 font-bold transition-colors min-h-[36px] touch-target flex items-center justify-center">Cancel</button>
                            )}
                            {displayStatus === 'Active' && (
                              <>
                                <button onClick={() => handleUpdatePromoStatus(promo.id, 'Paused')} disabled={isUpdatingPromo} className="text-xs bg-warning/10 text-warning border border-warning/30 px-3.5 py-2 rounded hover:bg-warning/20 font-bold transition-colors min-h-[36px] touch-target flex items-center justify-center">Pause</button>
                                <button onClick={() => handleUpdatePromoStatus(promo.id, 'Expired')} disabled={isUpdatingPromo} className="text-xs bg-danger/10 text-danger border border-danger/30 px-3.5 py-2 rounded hover:bg-danger/20 font-bold transition-colors min-h-[36px] touch-target flex items-center justify-center">End Early</button>
                              </>
                            )}
                            {displayStatus === 'Paused' && (
                              <>
                                <button onClick={() => handleUpdatePromoStatus(promo.id, 'Active')} disabled={isUpdatingPromo} className="text-xs bg-success/10 text-success border border-success/30 px-3.5 py-2 rounded hover:bg-success/20 font-bold transition-colors min-h-[36px] touch-target flex items-center justify-center">Resume</button>
                                <button onClick={() => handleUpdatePromoStatus(promo.id, 'Expired')} disabled={isUpdatingPromo} className="text-xs bg-danger/10 text-danger border border-danger/30 px-3.5 py-2 rounded hover:bg-danger/20 font-bold transition-colors min-h-[36px] touch-target flex items-center justify-center">End</button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-border-theme">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-accent/10 text-accent">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                    </span>
                    <h2 className="text-xl md:text-2xl font-bold text-text-primary">Discounts &amp; Table Concessions</h2>
                  </div>
                  <p className="text-xs md:text-sm text-text-secondary mt-1">Configure percentage or flat rupee discounts per table or club-wide. Automatically calculated by the server billing engine.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form Column */}
                <form onSubmit={handleApplyDiscount} className="lg:col-span-7 flex flex-col gap-4">
                  {/* Table Selection */}
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Eligible Table <span className="text-danger">*</span></label>
                    <CustomSelect 
                      value={selectedTable}
                      onChange={v => setSelectedTable(v)}
                      placeholder="-- Select Table or All Tables --"
                      options={[
                        { value: 'all', label: 'All Tables (Global Concession)' },
                        ...(data.tables?.map((t: any) => ({ value: t.id, label: `${t.name} (${t.type.toUpperCase()})` })) || [])
                      ]}
                      className="font-semibold min-h-[44px]"
                    />
                  </div>

                  {/* Discount Type Selector */}
                  <div>
                    <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Discount Type <span className="text-danger">*</span></label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDiscountType('percentage')}
                        className={`py-3 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition-all min-h-[44px] touch-target ${
                          discountType === 'percentage' 
                            ? 'bg-accent/20 border-accent text-accent shadow-sm' 
                            : 'bg-bg-primary border-border-theme text-text-secondary hover:border-accent/50'
                        }`}
                      >
                        <span>%</span> Percentage Discount
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('fixed')}
                        className={`py-3 px-3 rounded-lg text-xs font-bold border flex items-center justify-center gap-2 transition-all min-h-[44px] touch-target ${
                          discountType === 'fixed' 
                            ? 'bg-accent/20 border-accent text-accent shadow-sm' 
                            : 'bg-bg-primary border-border-theme text-text-secondary hover:border-accent/50'
                        }`}
                      >
                        <span>₹</span> Fixed Rupee Amount
                      </button>
                    </div>
                  </div>

                  {/* Value Inputs */}
                  {discountType === 'percentage' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Discount Percent (%) <span className="text-danger">*</span></label>
                        <div className="relative">
                          <input 
                            type="number" 
                            min="1" max="100"
                            value={discountPercent}
                            onChange={e => setDiscountPercent(e.target.value)}
                            className="w-full pl-4 pr-8 py-2.5 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary font-mono font-bold min-h-[44px]"
                            placeholder="e.g. 20"
                            required
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary text-xs font-bold">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Max Discount Cap (₹) <span className="text-text-disabled font-normal text-[10px]">(Optional)</span></label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-xs font-bold">₹</span>
                          <input 
                            type="number" 
                            min="1"
                            value={maxDiscountCap}
                            onChange={e => setMaxDiscountCap(e.target.value)}
                            className="w-full pl-8 pr-3 py-2.5 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary font-mono min-h-[44px]"
                            placeholder="e.g. 100"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Flat Discount Amount (₹) <span className="text-danger">*</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-xs font-bold">₹</span>
                        <input 
                          type="number" 
                          min="1"
                          value={discountFixedAmount}
                          onChange={e => setDiscountFixedAmount(e.target.value)}
                          className="w-full pl-8 pr-3 py-2.5 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary font-mono font-bold min-h-[44px]"
                          placeholder="e.g. 50"
                          required
                        />
                      </div>
                      <p className="text-[11px] text-text-secondary mt-1">Discount automatically caps at bill amount to prevent negative totals.</p>
                    </div>
                  )}

                  {/* Rules: Min Bill & Scope */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Min Bill Required (₹) <span className="text-text-disabled font-normal text-[10px]">(Optional)</span></label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-xs font-bold">₹</span>
                        <input 
                          type="number" 
                          min="0"
                          value={minBillAmount}
                          onChange={e => setMinBillAmount(e.target.value)}
                          className="w-full pl-8 pr-3 py-2.5 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary font-mono min-h-[44px]"
                          placeholder="e.g. 200"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-1.5">Discount Label / Reason <span className="text-text-disabled font-normal text-[10px]">(Optional)</span></label>
                      <input 
                        type="text" 
                        value={discountLabel}
                        onChange={e => setDiscountLabel(e.target.value)}
                        className="w-full px-3 py-2.5 bg-bg-primary border border-border-theme rounded-lg focus:border-accent outline-none text-base sm:text-sm text-text-primary min-h-[44px]"
                        placeholder="e.g. Happy Hour / VIP"
                      />
                    </div>
                  </div>

                  {/* Apply to Food Checkbox */}
                  <div className="p-3 bg-bg-surface rounded-lg border border-border-theme">
                    <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-text-primary select-none min-h-[40px]">
                      <input 
                        type="checkbox" 
                        checked={applyToFood} 
                        onChange={e => setApplyToFood(e.target.checked)} 
                        className="w-4 h-4 rounded accent-accent cursor-pointer"
                      />
                      <span>Apply discount to Food &amp; Beverages orders as well</span>
                    </label>
                  </div>

                  <button 
                    type="submit" 
                    disabled={!selectedTable || isUpdatingDiscount} 
                    className="w-full bg-accent text-black font-extrabold py-3.5 rounded-xl hover:opacity-95 transition-opacity shadow-lg shadow-accent/10 disabled:opacity-50 text-sm mt-1 min-h-[44px] touch-target"
                  >
                    {isUpdatingDiscount ? 'Applying Concession...' : 'Apply Table Discount'}
                  </button>
                </form>

                {/* Live Preview Column */}
                <div className="lg:col-span-5 flex flex-col">
                  {(() => {
                    const sampleTableCost = 200;
                    const sampleFoodCost = applyToFood ? 100 : 0;
                    const previewConfig = {
                      type: discountType,
                      percent: discountType === 'percentage' ? Number(discountPercent) || 0 : undefined,
                      amount: discountType === 'fixed' ? Number(discountFixedAmount) || 0 : undefined,
                      maxDiscount: maxDiscountCap ? Number(maxDiscountCap) : undefined,
                      minBillAmount: minBillAmount ? Number(minBillAmount) : undefined,
                      applyToFood,
                      isActive: true,
                    };
                    const previewRes = applySessionDiscounts(sampleTableCost, sampleFoodCost, previewConfig);
                    const sampleTotalBase = sampleTableCost + sampleFoodCost;
                    return (
                      <div className="h-full bg-bg-primary rounded-xl border border-border-theme p-5 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between pb-3 border-b border-border-theme">
                            <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                              Live Calculation Preview
                            </span>
                            <span className="text-[10px] text-text-secondary bg-bg-surface px-2 py-0.5 rounded border border-border-theme font-mono">Sample Bill</span>
                          </div>

                          <div className="mt-4 space-y-2 text-xs">
                            <div className="flex justify-between text-text-secondary">
                              <span>Base Table Fee:</span>
                              <span className="font-mono text-text-primary">₹{sampleTableCost}</span>
                            </div>
                            {applyToFood && (
                              <div className="flex justify-between text-text-secondary">
                                <span>F&amp;B Orders:</span>
                                <span className="font-mono text-text-primary">₹{sampleFoodCost}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-text-secondary">
                              <span>Total Eligible Bill:</span>
                              <span className="font-mono font-bold text-text-primary">₹{sampleTotalBase}</span>
                            </div>
                            
                            <div className="border-t border-border-theme/60 my-2"></div>

                            <div className="flex justify-between text-success font-bold">
                              <span>Discount Applied:</span>
                              <span className="font-mono">- ₹{previewRes.totalDiscountAmount}</span>
                            </div>
                            {previewRes.totalDiscountAmount > 0 && (
                              <p className="text-[10px] text-text-secondary text-right italic font-mono">{previewRes.discountAppliedLabel}</p>
                            )}

                            {previewRes.minBillShortfall && previewRes.minBillShortfall > 0 ? (
                              <div className="mt-2 p-2 rounded bg-warning/10 border border-warning/30 text-[11px] text-warning leading-snug flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>Sample bill (₹{sampleTotalBase}) is below the ₹{minBillAmount} minimum threshold. Concession will not trigger until threshold is reached.</span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border-theme flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Final Payable</span>
                          <span className="text-2xl font-black font-mono text-accent">₹{previewRes.finalTotalCost}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Active Discounts List */}
              <div className="mt-8 pt-6 border-t border-border-theme">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
                    Active Table Discounts ({Object.keys(data.activeDiscounts || {}).length})
                  </h3>
                  {Object.keys(data.activeDiscounts || {}).length > 1 && (
                    <button 
                      type="button"
                      onClick={() => {
                        if (confirm('Are you sure you want to remove all active discounts?')) {
                          handleRemoveDiscount('all');
                        }
                      }}
                      className="text-xs font-bold text-danger hover:underline min-h-[36px] flex items-center touch-target"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {Object.keys(data.activeDiscounts || {}).length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-border-theme rounded-xl text-text-disabled text-xs">
                    No discounts currently active. Select a table above to apply an instant concession.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(data.activeDiscounts || {}).map(([tableId, discount]: [string, any]) => {
                      const isFixed = discount.type === 'fixed' || (discount.amount && !discount.percent);
                      const tableName = tableId === 'all' ? 'All Tables' : (data.tables?.find((t: any) => t.id === tableId)?.name || tableId);
                      return (
                        <div key={tableId} className="flex items-center justify-between bg-bg-surface p-3 rounded-xl border border-border-theme text-xs shadow-sm group hover:border-accent/40 transition-colors">
                          <div className="flex flex-col gap-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-text-primary truncate">{tableName}</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-accent/10 text-accent border border-accent/20">
                                {isFixed ? `Flat ₹${discount.amount}` : `${discount.percent}% OFF`}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 text-[10px] text-text-secondary">
                              <span>{discount.applyToFood ? 'Table + F&B' : 'Table Only'}</span>
                              {discount.maxDiscount ? <span>• Max ₹{discount.maxDiscount}</span> : null}
                              {discount.minBillAmount ? <span>• Min ₹{discount.minBillAmount}</span> : null}
                              {discount.label ? <span className="text-accent truncate">• {discount.label}</span> : null}
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleRemoveDiscount(tableId)} 
                            title={`Remove discount for ${tableName}`}
                            className="p-2 text-text-disabled hover:text-danger hover:bg-danger/10 rounded-lg transition-colors shrink-0 ml-2 min-h-[36px] min-w-[36px] flex items-center justify-center touch-target"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 border-b border-border-theme pb-4">Payment Collection</h2>
              <div className="border border-border-theme rounded-xl p-4 sm:p-6 bg-bg-surface max-w-xl">
                <h3 className="text-lg font-bold mb-2">Business Payment QR</h3>
                <p className="text-xs sm:text-sm text-text-secondary mb-4">Customers can scan this QR to pay your business directly via UPI. (Requires manual confirmation of payment)</p>
                
                {((data as any)?.payment_qr_config)?.enabled && ((data as any)?.payment_qr_config)?.qr_url ? (
                  <div className="mb-6 flex flex-col items-center">
                    <div className="w-48 h-48 bg-white rounded-xl p-2 mb-4 border border-border-theme shadow-sm relative group overflow-hidden">
                      <img src={((data as any)?.payment_qr_config).qr_url} alt="Business QR" className="w-full h-full object-contain rounded-lg" />
                    </div>
                    <div className="flex gap-4">
                      <label className="px-4 py-2 bg-accent/10 text-accent font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-accent/20 transition-colors cursor-pointer border border-accent/20 min-h-[44px] touch-target inline-flex items-center justify-center">
                        Replace QR
                        <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !businessId) return;
                          const formData = new FormData();
                          formData.append('business_id', businessId);
                          formData.append('file', file);
                          formData.append('action', 'upload');
                          try {
                            toast.loading('Uploading...');
                            const res = await fetch('/api/upload-qr', { method: 'POST', body: formData });
                            toast.dismiss();
                            if (res.ok) { toast.success('QR replaced successfully.'); /* fetchData removed for instant UI */ }
                            else { toast.error('Failed to replace QR.'); }
                          } catch { toast.error('Error uploading QR.'); }
                        }} />
                      </label>
                      <button onClick={async () => {
                        if (!businessId) return;
                        if (!confirm('Are you sure you want to remove this QR code?')) return;
                        const formData = new FormData();
                        formData.append('business_id', businessId);
                        formData.append('action', 'remove');
                        try {
                          const res = await fetch('/api/upload-qr', { method: 'POST', body: formData });
                          if (res.ok) { toast.success('QR removed successfully.'); /* fetchData removed for instant UI */ }
                          else { toast.error('Failed to remove QR.'); }
                        } catch { toast.error('Error removing QR.'); }
                      }} className="px-4 py-2 bg-danger/10 text-danger font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-danger/20 transition-colors border border-danger/20 min-h-[44px] touch-target inline-flex items-center justify-center">
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-border-theme rounded-xl p-6 sm:p-8 text-center bg-bg-primary/50 hover:bg-bg-primary transition-colors">
                    <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    </div>
                    <h4 className="text-sm font-bold text-text-primary mb-1">Upload QR Code</h4>
                    <p className="text-xs text-text-secondary mb-4">PNG, JPG up to 5MB</p>
                    <label className="px-6 py-3 bg-accent text-black font-extrabold text-sm rounded-lg hover-lift smooth-transition hover:bg-accent/90 transition-colors shadow-lg cursor-pointer inline-flex items-center justify-center min-h-[44px] touch-target">
                      Select File
                      <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !businessId) return;
                        const formData = new FormData();
                        formData.append('business_id', businessId);
                        formData.append('file', file);
                        formData.append('action', 'upload');
                        try {
                          toast.loading('Uploading...', { id: 'upload' });
                          const res = await fetch('/api/upload-qr', { method: 'POST', body: formData });
                          if (res.ok) { toast.success('QR uploaded successfully.', { id: 'upload' }); /* fetchData removed for instant UI */ }
                          else { toast.error('Failed to upload QR.', { id: 'upload' }); }
                        } catch { toast.error('Error uploading QR.', { id: 'upload' }); }
                      }} />
                    </label>
                  </div>
                )}
              </div>
            </div>

      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl font-bold mb-6 border-b border-border-theme pb-4">Integrations &amp; Insights</h2>
              <div className="border border-border-theme rounded-xl p-4 sm:p-6 bg-bg-surface max-w-xl mb-6">
                <h3 className="text-lg font-bold mb-2">Qpulse Insights</h3>
                <p className="text-xs sm:text-sm text-text-secondary mb-4">Receive motivational and business insights to stay on top of your game.</p>
                <div className="bg-bg-primary/50 p-4 rounded-xl border border-border-theme">
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const enabled = fd.get('enabled') === 'true';
                    const frequency = fd.get('frequency') as string;
                    try {
                      toast.loading('Saving Qpulse settings...', { id: 'qpulse-save' });
                      const res = await fetch('/api/update-business-config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          business_id: businessId,
                          qpulse_config: { enabled, frequency, last_shown_date: ((data as any)?.qpulse_config)?.last_shown_date || null }
                        })
                      });
                      if (!res.ok) throw new Error();
                      toast.success('Qpulse settings updated!', { id: 'qpulse-save' });
                      // fetchData removed for instant UI
                    } catch {
                      toast.error('Failed to update Qpulse settings.', { id: 'qpulse-save' });
                    }
                  }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block mb-2">Qpulse Status</label>
                        <select name="enabled" defaultValue={((data as any)?.qpulse_config)?.enabled === false ? "false" : "true"} className="w-full bg-bg-surface border border-border-theme p-3 rounded-lg text-base sm:text-sm text-text-primary outline-none focus:border-accent transition-colors appearance-none font-medium min-h-[44px]">
                          <option value="true">Enabled</option>
                          <option value="false">Disabled</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block mb-2">Frequency</label>
                        <select name="frequency" defaultValue={((data as any)?.qpulse_config)?.frequency || 'Every 3 days'} className="w-full bg-bg-surface border border-border-theme p-3 rounded-lg text-base sm:text-sm text-text-primary outline-none focus:border-accent transition-colors appearance-none font-medium min-h-[44px]">
                          <option value="Daily">Daily</option>
                          <option value="Every 3 days">Every 3 days</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Off">Off</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="w-full mt-2 bg-accent text-black font-extrabold py-3.5 rounded-lg hover-lift smooth-transition hover:bg-accent/90 transition-colors min-h-[44px] touch-target shadow-sm">
                      Save Qpulse
                    </button>
                  </form>
                </div>
              </div>
            </div>

      
      
      {/* SIMPLE MODE / BUSINESS CUSTOMIZATION */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 border-b border-border-theme pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-3">
              QControl Customization
              {isUpdatingPreferences && <span className="text-xs font-normal text-text-secondary animate-pulse">Saving...</span>}
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-1">Configure how QControl looks and works for your business.</p>
          </div>
          <button 
            onClick={() => handleUpdatePreference('simple_mode', !preferences.simple_mode)}
            className={`px-6 py-3 rounded-xl font-black text-xs sm:text-sm uppercase tracking-widest transition-all min-h-[44px] touch-target flex items-center justify-center shrink-0 ${preferences.simple_mode ? 'bg-success text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'bg-bg-surface text-text-secondary border border-border-theme hover:border-accent'}`}
          >
            {preferences.simple_mode ? 'Simple Mode ON' : 'Simple Mode OFF'}
          </button>
        </div>

        {!preferences.simple_mode && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-bg-surface p-4 sm:p-6 rounded-xl border border-border-theme/50">
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-widest">Workflow Features</h3>
              <label className="flex items-center gap-3 mb-3 cursor-pointer min-h-[40px]">
                <input type="checkbox" checked={Boolean(preferences.require_customer_name)} onChange={(e) => handleUpdatePreference('require_customer_name', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <span className="text-sm font-semibold text-text-secondary">Require Customer Name for Sessions</span>
              </label>
              <label className="flex items-center gap-3 mb-3 cursor-pointer min-h-[40px]">
                <input type="checkbox" checked={Boolean(preferences.enable_memberships)} onChange={(e) => handleUpdatePreference('enable_memberships', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <span className="text-sm font-semibold text-text-secondary">Enable Memberships System</span>
              </label>
              <label className="flex items-center gap-3 mb-3 cursor-pointer min-h-[40px]">
                <input type="checkbox" checked={Boolean(preferences.enable_qkhata)} onChange={(e) => handleUpdatePreference('enable_qkhata', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <span className="text-sm font-semibold text-text-secondary">Enable QKhata (Credit) System</span>
              </label>
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-widest">Display Preferences</h3>
              <label className="flex items-center gap-3 mb-3 cursor-pointer min-h-[40px]">
                <input type="checkbox" checked={Boolean(preferences.show_pricing_on_dashboard)} onChange={(e) => handleUpdatePreference('show_pricing_on_dashboard', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <span className="text-sm font-semibold text-text-secondary">Show Live Pricing on Active Sessions</span>
              </label>
              <label className="flex items-center gap-3 mb-3 cursor-pointer min-h-[40px]">
                <input type="checkbox" checked={Boolean((preferences as any).auto_qr_billing !== false)} onChange={(e) => handleUpdatePreference('auto_qr_billing', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <span className="text-sm font-semibold text-text-secondary">Show QR Billing Popup automatically when session ends</span>
              </label>
              <label className="flex items-center gap-3 mb-3 cursor-pointer min-h-[40px]">
                <input type="checkbox" checked={Boolean(preferences.show_member_details)} onChange={(e) => handleUpdatePreference('show_member_details', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <span className="text-sm font-semibold text-text-secondary">Show Member Details in Tables</span>
              </label>
            </div>
            <div className="col-span-1 md:col-span-2 pt-4 border-t border-border-theme/50">
              <h3 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-widest">Table Experience</h3>
              <label className="flex items-center gap-3 mb-3 cursor-pointer min-h-[40px]">
                <input type="checkbox" checked={Boolean((preferences as any).enhanced_tables ?? false)} onChange={(e) => handleUpdatePreference('enhanced_tables', e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent bg-bg-primary border-border-theme" />
                <div>
                   <span className="text-sm font-bold text-text-primary">Enhanced Table View</span>
                   <p className="text-xs text-text-secondary">Use the new interactive 3D table interface.</p>
                </div>
              </label>
            </div>
            <div className="col-span-1 md:col-span-2 pt-4 border-t border-border-theme/50">
               <p className="text-xs text-text-secondary">Changes save automatically and apply immediately across the dashboard and Telegram bot.</p>
            </div>
          </div>
        )}
      </div>


      {/* Membership Plans Management */}
      <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8">
        <h2 className="text-xl sm:text-2xl font-bold mb-6 border-b border-border-theme pb-4">Membership Plans</h2>
        
        <form onSubmit={handleCreatePlan} className="max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-bg-surface p-6 rounded-xl border border-border-theme/50">
          <h3 className="col-span-1 md:col-span-2 text-sm font-black uppercase tracking-widest text-text-primary mb-1">Create New Plan</h3>
          
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Plan Name</label>
            <input required type="text" value={newPlan.name} onChange={e => setNewPlan({...newPlan, name: e.target.value})} className="w-full px-4 py-2.5 bg-bg-primary border border-border-theme rounded-lg text-sm focus:border-accent outline-none" placeholder="VIP Annual" />
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Price (₹)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary text-sm font-bold font-mono">₹</span>
              <input required type="number" min="0" value={newPlan.price || ''} onChange={e => setNewPlan({...newPlan, price: Number(e.target.value)})} className="w-full pl-8 pr-4 py-2.5 bg-bg-primary border border-border-theme rounded-lg text-sm font-mono focus:border-accent outline-none" placeholder="1000" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Duration (Months)</label>
            <input required type="number" min="1" value={newPlan.duration_months} onChange={e => setNewPlan({...newPlan, duration_months: Number(e.target.value)})} className="w-full px-4 py-2.5 bg-bg-primary border border-border-theme rounded-lg text-sm font-mono focus:border-accent outline-none" />
          </div>

          {/* Discount Type Selector */}
          <div>
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Discount Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setNewPlan({ ...newPlan, discount_type: 'percentage' })}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border text-center ${
                  newPlan.discount_type === 'percentage'
                    ? 'bg-accent/15 border-accent text-accent'
                    : 'bg-bg-primary border-border-theme text-text-secondary hover:text-text-primary'
                }`}
              >
                Percentage (%)
              </button>
              <button
                type="button"
                onClick={() => setNewPlan({ ...newPlan, discount_type: 'fixed' })}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border text-center ${
                  newPlan.discount_type === 'fixed'
                    ? 'bg-accent/15 border-accent text-accent'
                    : 'bg-bg-primary border-border-theme text-text-secondary hover:text-text-primary'
                }`}
              >
                Fixed Amount (₹)
              </button>
              <button
                type="button"
                onClick={() => setNewPlan({ ...newPlan, discount_type: 'flat_rate' })}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all border text-center ${
                  newPlan.discount_type === 'flat_rate'
                    ? 'bg-accent/15 border-accent text-accent'
                    : 'bg-bg-primary border-border-theme text-text-secondary hover:text-text-primary'
                }`}
              >
                Flat Rate (₹/hr)
              </button>
            </div>
          </div>

          {/* Dynamic Discount Value Input */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest">
                {newPlan.discount_type === 'percentage' ? 'Discount Value (%)' : (newPlan.discount_type === 'fixed' ? 'Discount Value (₹)' : 'Flat Hourly Rate (₹/hr)')}
              </label>
              <span className="text-[11px] text-text-secondary">
                {newPlan.discount_type === 'percentage' 
                  ? 'Example: 10% or 20% off all sessions' 
                  : (newPlan.discount_type === 'fixed' 
                      ? 'Example: ₹50 or ₹100 flat session deduction' 
                      : 'Example: ₹120/hr locked rate instead of regular hourly fee')}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-accent text-sm font-bold font-mono">
                {newPlan.discount_type === 'percentage' ? '%' : '₹'}
              </span>
              <input
                type="number"
                min="0"
                max={newPlan.discount_type === 'percentage' ? 100 : undefined}
                value={
                  newPlan.discount_type === 'percentage' 
                    ? newPlan.discount_percent 
                    : (newPlan.discount_type === 'fixed' ? (newPlan.discount_amount || '') : (newPlan.flat_hourly_rate || ''))
                }
                onChange={e => {
                  const val = Number(e.target.value);
                  if (newPlan.discount_type === 'percentage') {
                    setNewPlan({ ...newPlan, discount_percent: Math.min(100, Math.max(0, val)) });
                  } else if (newPlan.discount_type === 'fixed') {
                    setNewPlan({ ...newPlan, discount_amount: Math.max(0, val) });
                  } else {
                    setNewPlan({ ...newPlan, flat_hourly_rate: Math.max(0, val) });
                  }
                }}
                className="w-full pl-8 pr-4 py-2.5 bg-bg-primary border border-border-theme rounded-lg text-sm font-mono focus:border-accent outline-none"
                placeholder={newPlan.discount_type === 'percentage' ? '10' : (newPlan.discount_type === 'fixed' ? '50' : '120')}
              />
            </div>
          </div>

          <div className="col-span-1 md:col-span-2">
            <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Benefits (Comma separated)</label>
            <input type="text" value={newPlan.benefits} onChange={e => setNewPlan({...newPlan, benefits: e.target.value})} className="w-full px-4 py-2.5 bg-bg-primary border border-border-theme rounded-lg text-sm focus:border-accent outline-none" placeholder="Free Locker, 10% off F&B" />
          </div>

          <div className="col-span-1 md:col-span-2 mt-2">
             <button type="submit" disabled={isCreatingPlan} className="bg-accent text-black font-extrabold px-6 py-3 rounded-lg text-sm disabled:opacity-50 min-h-[44px] touch-target shadow-sm hover:opacity-90 transition-opacity">
               {isCreatingPlan ? 'Creating...' : '+ Create Plan'}
             </button>
          </div>
        </form>

        {isPlansLoading ? (
          <p className="text-sm text-text-secondary">Loading plans...</p>
        ) : membershipPlans.length === 0 ? (
          <div className="bg-bg-surface p-6 rounded-xl border border-border-theme flex flex-col items-center justify-center text-center">
             <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center mb-4">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
             </div>
             <h3 className="text-lg font-bold mb-2">No Membership Plans Yet</h3>
             <p className="text-sm text-text-secondary max-w-md mb-6">Create your own customized membership plans using the form above, or click below to generate a few industry-standard templates to get started quickly.</p>
             <button onClick={handleLoadDummyPlans} disabled={isPlansLoading} className="min-h-[44px] touch-target px-6 py-2.5 rounded-lg border border-accent/50 text-accent font-bold text-sm hover:bg-accent/10 transition-colors shadow-sm">
                Load Example Templates
             </button>
          </div>
        ) : (
          <>
            {/* Mobile Cards for Plans (screens < 768px) */}
            <div className="md:hidden divide-y divide-border-theme/50 rounded-xl border border-border-theme overflow-hidden bg-bg-card">
              {membershipPlans.map((plan: any) => {
                const isFlatRate = plan.discount_type === 'flat_rate' && Number(plan.flat_hourly_rate) > 0;
                const isFixed = plan.discount_type === 'fixed' && Number(plan.discount_amount) > 0;
                const hasDiscount = isFlatRate || isFixed || Number(plan.discount_percent) > 0;

                return (
                  <div key={plan.id} className="p-4 flex flex-col gap-2.5 hover:bg-bg-surface/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-text-primary text-base">{plan.name}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${plan.status === 'Active' ? 'bg-success/10 text-success' : 'bg-text-secondary/10 text-text-secondary'}`}>
                        {plan.status}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono font-bold text-accent text-lg">₹{plan.price}</span>
                        <span className="text-xs text-text-secondary font-medium">/ {plan.duration_months} Month{plan.duration_months > 1 ? 's' : ''}</span>
                      </div>
                      {hasDiscount && (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold font-mono border ${isFlatRate ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                          {isFlatRate ? `Flat ₹${plan.flat_hourly_rate}/hr` : (isFixed ? `Flat ₹${plan.discount_amount} Off` : `${plan.discount_percent}% Off`)}
                        </span>
                      )}
                    </div>
                    {plan.benefits && plan.benefits.length > 0 && (
                      <p className="text-xs text-text-secondary leading-relaxed bg-bg-surface p-2 rounded border border-border-theme/60 flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span>{(plan.benefits || []).join(', ')}</span>
                      </p>
                    )}
                    <div className="flex justify-end pt-1">
                      <button 
                        onClick={() => handleTogglePlanStatus(plan)} 
                        className="min-h-[44px] touch-target px-4 py-1.5 text-xs font-bold text-accent hover:underline flex items-center justify-center rounded-lg border border-border-theme"
                      >
                        {plan.status === 'Active' ? 'Archive Plan' : 'Activate Plan'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (screens >= 768px) */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-border-theme">
              <table className="w-full text-left text-sm">
                <thead className="bg-bg-surface border-b border-border-theme">
                  <tr>
                    <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary">Plan Name</th>
                    <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary">Price</th>
                    <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary">Duration</th>
                    <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary">Member Discount</th>
                    <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary">Benefits</th>
                    <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary">Status</th>
                    <th className="px-5 py-4 font-bold text-xs uppercase tracking-widest text-text-secondary text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-theme/50">
                  {membershipPlans.map((plan: any) => {
                    const isFlatRate = plan.discount_type === 'flat_rate' && Number(plan.flat_hourly_rate) > 0;
                    const isFixed = plan.discount_type === 'fixed' && Number(plan.discount_amount) > 0;
                    const hasDiscount = isFlatRate || isFixed || Number(plan.discount_percent) > 0;

                    return (
                      <tr key={plan.id} className="hover:bg-bg-surface/50 transition-colors">
                        <td className="px-5 py-4 font-bold text-text-primary">{plan.name}</td>
                        <td className="px-5 py-4 font-mono font-bold text-accent">₹{plan.price}</td>
                        <td className="px-5 py-4">{plan.duration_months} M</td>
                        <td className="px-5 py-4">
                          {hasDiscount ? (
                            <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono border ${isFlatRate ? 'bg-blue-500/10 text-blue-400 border-blue-500/25' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'}`}>
                              {isFlatRate ? `Flat ₹${plan.flat_hourly_rate}/hr` : (isFixed ? `Flat ₹${plan.discount_amount} Off` : `${plan.discount_percent}% Off`)}
                            </span>
                          ) : (
                            <span className="text-text-secondary text-xs">No Discount</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-text-secondary">{(plan.benefits || []).join(', ')}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${plan.status === 'Active' ? 'bg-success/10 text-success' : 'bg-text-secondary/10 text-text-secondary'}`}>
                            {plan.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button onClick={() => handleTogglePlanStatus(plan)} className="text-xs font-bold text-accent hover:underline min-h-[32px] inline-flex items-center">
                            {plan.status === 'Active' ? 'Archive' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>


      {/* Change PIN UI */}
            <div className="bg-bg-card border border-border-theme rounded-xl overflow-hidden p-4 sm:p-6 md:p-8">
              <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2.5 mb-6 border-b border-border-theme pb-4">
                Security Settings
              </h2>
              <form onSubmit={handleChangePassword} className="max-w-md flex flex-col gap-4">
                {passwordError && <div className="text-danger text-sm font-bold bg-danger/10 p-3 rounded-lg border border-danger/20">{passwordError}</div>}
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Current Admin PIN</label>
                  <div className="relative">
                    <input type={showCurrentPin ? "text" : "password"} maxLength={4} pattern="\d{4}" value={currentPassword} onChange={e => setCurrentPassword(e.target.value.replace(/\D/g, ''))} className="w-full pl-3 pr-12 py-3 bg-bg-surface border border-border-theme rounded-lg text-lg text-text-primary outline-none focus:border-accent font-mono tracking-[0.5em] placeholder-text-disabled placeholder:tracking-normal min-h-[44px]" placeholder="••••" required />
                    <button type="button" onClick={() => setShowCurrentPin(!showCurrentPin)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none min-h-[44px] min-w-[44px] touch-target justify-center" aria-label={showCurrentPin ? "Hide PIN" : "Show PIN"}>
                      {showCurrentPin ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">New Admin PIN</label>
                  <div className="relative">
                    <input type={showNewPin ? "text" : "password"} maxLength={4} pattern="\d{4}" value={newPassword} onChange={e => setNewPassword(e.target.value.replace(/\D/g, ''))} className="w-full pl-3 pr-12 py-3 bg-bg-surface border border-border-theme rounded-lg text-lg text-text-primary outline-none focus:border-accent font-mono tracking-[0.5em] placeholder-text-disabled placeholder:tracking-normal min-h-[44px]" placeholder="••••" required />
                    <button type="button" onClick={() => setShowNewPin(!showNewPin)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none min-h-[44px] min-w-[44px] touch-target justify-center" aria-label={showNewPin ? "Hide PIN" : "Show PIN"}>
                      {showNewPin ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                  <p className="text-[10px] text-text-secondary mt-1">Must be exactly 4 digits.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-1.5">Confirm New PIN</label>
                  <div className="relative">
                    <input type={showConfirmPin ? "text" : "password"} maxLength={4} pattern="\d{4}" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value.replace(/\D/g, ''))} className="w-full pl-3 pr-12 py-3 bg-bg-surface border border-border-theme rounded-lg text-lg text-text-primary outline-none focus:border-accent font-mono tracking-[0.5em] placeholder-text-disabled placeholder:tracking-normal min-h-[44px]" placeholder="••••" required />
                    <button type="button" onClick={() => setShowConfirmPin(!showConfirmPin)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-secondary hover:text-text-primary transition-colors focus:outline-none min-h-[44px] min-w-[44px] touch-target justify-center" aria-label={showConfirmPin ? "Hide PIN" : "Show PIN"}>
                      {showConfirmPin ? <IconEyeOff /> : <IconEye />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={isChangingPassword || newPassword.length !== 4} className="mt-2 px-5 py-3.5 bg-accent text-black font-extrabold text-sm uppercase rounded-lg hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 min-h-[44px] touch-target">
                  {isChangingPassword ? 'Updating...' : 'Change PIN'}
                </button>
              </form>
            </div>
    </div>

      {/* Delete Station Confirmation Modal */}
      {stationToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-bg-surface border border-border-theme rounded-xl p-6 w-full max-w-sm shadow-2xl animate-entrance">
            <h3 className="text-lg font-bold mb-2">Delete {stationToDelete.name}?</h3>
            <p className="text-text-secondary text-sm mb-6">
              Are you sure you want to delete this station? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={() => setStationToDelete(null)}
                className="flex-1 px-4 py-2 bg-bg-card border border-border-theme text-text-primary rounded-lg font-bold text-sm hover:bg-bg-primary transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteStation}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg shadow-[0_4px_15px_rgba(239,68,68,0.4)] btn-premium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
