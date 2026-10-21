'use client';

import React, { useState } from 'react';
import { Bot } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Tooltip } from './components';

interface SupportTabProps {
  data: any;
  businessId: string;
  fetchData: () => void;
  setSidebarTab: (tab: string) => void;
  telegramOwners: any[];
  handleUpdateTelegramSettings: (e: React.FormEvent) => Promise<void>;
  reminderInterval: string;
  setReminderInterval: (val: string) => void;
  isUpdatingTelegram: boolean;
  handleToggleTelegramOwnerAccess: (chatId: string, status: string) => Promise<void>;
  handlePermanentDeleteOwner: (chatId: string) => Promise<void>;
  handleGenerateTelegramLink: (role: any) => Promise<void>;
  generatingLinkRole: string | null;
  telegramInviteLink: string;
}

export default function SupportTab({
  data,
  businessId,
  fetchData,
  setSidebarTab,
  telegramOwners,
  handleUpdateTelegramSettings,
  reminderInterval,
  setReminderInterval,
  isUpdatingTelegram,
  handleToggleTelegramOwnerAccess,
  handlePermanentDeleteOwner,
  handleGenerateTelegramLink,
  generatingLinkRole,
  telegramInviteLink
}: SupportTabProps) {
  // Local state for WhatsApp integration
  const [waPhoneId, setWaPhoneId] = useState('');
  const [waToken, setWaToken] = useState('');
  const [isConnectingWa, setIsConnectingWa] = useState(false);

  // Local state for SMS integration
  const [smsProvider, setSmsProvider] = useState('msg91');
  const [smsAuthKey, setSmsAuthKey] = useState('');
  const [smsSenderId, setSmsSenderId] = useState('');
  const [isConnectingSms, setIsConnectingSms] = useState(false);

  return (
    <div className="w-full flex flex-col gap-8 pb-20">
      <div>
        <h1 className="text-4xl font-black tracking-tight mb-3">Support & Integrations</h1>
        <p className="text-text-secondary text-base max-w-3xl leading-relaxed">
          Manage your connectivity, communication channels, and get help when you need it. Ensure your automated reminders and billing integrations are correctly configured.
        </p>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bg-card border border-border-theme rounded-2xl p-6 flex items-center justify-between shadow-sm hover:border-accent/50 transition-colors">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-[#25D366]/10 flex items-center justify-center text-[#25D366] shadow-inner">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            </div>
            <div>
              <h3 className="font-extrabold text-text-primary text-lg">WhatsApp API</h3>
              <p className="text-sm text-text-secondary mt-0.5">Business Messaging</p>
            </div>
          </div>
          {data?.whatsapp_config?.enabled ? (
            <span className="text-success font-black text-[10px] uppercase tracking-wider bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">Active</span>
          ) : (
            <span className="text-text-disabled font-black text-[10px] uppercase tracking-wider bg-bg-surface px-3 py-1.5 rounded-full border border-border-theme">Inactive</span>
          )}
        </div>
        
        <div className="bg-bg-card border border-border-theme rounded-2xl p-6 flex items-center justify-between shadow-sm hover:border-accent/50 transition-colors">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent shadow-inner">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
            </div>
            <div>
              <h3 className="font-extrabold text-text-primary text-lg">SMS DLT</h3>
              <p className="text-sm text-text-secondary mt-0.5">Transactional SMS</p>
            </div>
          </div>
          {data?.sms_config?.enabled ? (
            <span className="text-success font-black text-[10px] uppercase tracking-wider bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">Active</span>
          ) : (
            <span className="text-text-disabled font-black text-[10px] uppercase tracking-wider bg-bg-surface px-3 py-1.5 rounded-full border border-border-theme">Inactive</span>
          )}
        </div>

        <div className="bg-bg-card border border-border-theme rounded-2xl p-6 flex items-center justify-between shadow-sm hover:border-accent/50 transition-colors">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner">
              <Bot className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-text-primary text-lg">Telegram Bot</h3>
              <p className="text-sm text-text-secondary mt-0.5">Smart Reminders</p>
            </div>
          </div>
          {telegramOwners.length > 0 ? (
            <span className="text-success font-black text-[10px] uppercase tracking-wider bg-success/10 border border-success/20 px-3 py-1.5 rounded-full">Active</span>
          ) : (
            <span className="text-text-disabled font-black text-[10px] uppercase tracking-wider bg-bg-surface px-3 py-1.5 rounded-full border border-border-theme">Inactive</span>
          )}
        </div>
      </div>

      {/* Horizontal Integration Section */}
      <div className="flex flex-col gap-6 mt-4">
        <h2 className="text-2xl font-black flex items-center gap-3">
          <svg className="w-6 h-6 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"></path></svg>
          Communication Channels
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          
          {/* WhatsApp Integration Setting */}
          <div className="bg-bg-card border border-border-theme rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all hover:shadow-md">
            <div className="p-8 pb-6 border-b border-border-theme/50 bg-bg-primary/30 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2.5">
                  <svg className="w-6 h-6 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                  WhatsApp Business
                </h3>
                <p className="text-xs text-text-secondary mt-1 max-w-sm">Connect official API to send reminders.</p>
              </div>
              {data?.whatsapp_config?.enabled ? (
                <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Connected
                </span>
              ) : (
                <span className="px-3 py-1 bg-bg-surface text-text-secondary border border-border-theme rounded-lg text-[10px] font-black uppercase tracking-widest">Not Connected</span>
              )}
            </div>
            
            <div className="p-8 flex-1 flex flex-col">
              {data?.whatsapp_config?.enabled ? (
                <div className="bg-bg-primary/50 border border-border-theme rounded-xl p-6 flex flex-col items-center text-center h-full justify-center">
                  <div className="w-16 h-16 bg-[#25D366]/10 text-[#25D366] rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <p className="text-sm font-bold text-text-primary mb-2">WhatsApp is active and running.</p>
                  <p className="text-xs text-text-secondary mb-6">Your customers are receiving updates successfully.</p>
                  <button 
                    onClick={async () => {
                      if (confirm('Are you sure you want to disconnect WhatsApp? You will not be able to send reminders.')) {
                        try {
                          const res = await fetch('/api/update-whatsapp-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) });
                          if (res.ok) {
                            toast.success('WhatsApp disconnected.');
                            fetchData();
                          }
                        } catch { toast.error('Failed to disconnect.'); }
                      }
                    }}
                    className="w-full bg-danger/10 text-danger hover:bg-danger/20 font-bold py-3.5 rounded-xl transition-colors text-sm"
                  >
                    Disconnect WhatsApp
                  </button>
                </div>
              ) : (
                <form className="flex flex-col gap-5 h-full" onSubmit={async (e) => {
                  e.preventDefault();
                  setIsConnectingWa(true);
                  try {
                    const res = await fetch('/api/update-whatsapp-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect', phoneId: waPhoneId, token: waToken }) });
                    if (res.ok) { 
                      toast.success('WhatsApp connected successfully!'); 
                      setWaPhoneId(''); 
                      setWaToken('');
                      fetchData();
                    } else { 
                      toast.error('Failed to connect. Please check credentials.'); 
                    }
                  } catch { toast.error('An error occurred.'); }
                  setIsConnectingWa(false);
                }}>
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Phone Number ID <span className="text-danger">*</span></label>
                    <input type="text" required value={waPhoneId} onChange={e => setWaPhoneId(e.target.value)} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-sm text-text-primary font-mono transition-all" placeholder="e.g. 102345678912345" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest">Permanent Access Token <span className="text-danger">*</span></label>
                      <a href="#" className="text-[10px] text-accent hover:underline font-bold">Setup Guide ↗</a>
                    </div>
                    <input type="password" required value={waToken} onChange={e => setWaToken(e.target.value)} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-sm text-text-primary font-mono transition-all" placeholder="EAAGm0..." />
                  </div>
                  <button type="submit" disabled={isConnectingWa} className="w-full mt-2 bg-text-primary text-bg-primary font-black py-4 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-black/10 flex justify-center items-center gap-2 text-sm uppercase tracking-wide">
                    {isConnectingWa ? 'Connecting...' : 'Connect WhatsApp'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* SMS Integration Setting */}
          <div className="bg-bg-card border border-border-theme rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all hover:shadow-md">
            <div className="p-8 pb-6 border-b border-border-theme/50 bg-bg-primary/30 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2.5">
                  <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                  SMS Integration
                </h3>
                <p className="text-xs text-text-secondary mt-1 max-w-sm">Connect a DLT-compliant SMS provider.</p>
              </div>
              {data?.sms_config?.enabled ? (
                <span className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Connected
                </span>
              ) : (
                <span className="px-3 py-1 bg-bg-surface text-text-secondary border border-border-theme rounded-lg text-[10px] font-black uppercase tracking-widest">Not Connected</span>
              )}
            </div>
            
            <div className="p-8 flex-1 flex flex-col">
              {data?.sms_config?.enabled ? (
                <div className="bg-bg-primary/50 border border-border-theme rounded-xl p-6 flex flex-col items-center text-center h-full justify-center">
                  <div className="w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                  </div>
                  <p className="text-sm font-bold text-text-primary mb-2">SMS Gateway is linked.</p>
                  <p className="text-xs text-text-secondary mb-6 font-mono bg-bg-surface px-3 py-1.5 rounded-lg border border-border-theme mt-2">{data.sms_config.provider.toUpperCase()} • {data.sms_config.senderId}</p>
                  <button 
                    onClick={async () => {
                      if (confirm('Are you sure you want to disconnect your SMS provider?')) {
                        try {
                          const res = await fetch('/api/update-sms-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'disconnect' }) });
                          if (res.ok) {
                            toast.success('SMS provider disconnected.');
                            fetchData();
                          }
                        } catch { toast.error('Failed to disconnect.'); }
                      }
                    }}
                    className="w-full bg-danger/10 text-danger hover:bg-danger/20 font-bold py-3.5 rounded-xl transition-colors text-sm"
                  >
                    Disconnect SMS
                  </button>
                </div>
              ) : (
                <form className="flex flex-col gap-5 h-full" onSubmit={async (e) => {
                  e.preventDefault();
                  setIsConnectingSms(true);
                  try {
                    const res = await fetch('/api/update-sms-config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect', provider: smsProvider, authKey: smsAuthKey, senderId: smsSenderId }) });
                    if (res.ok) { 
                      toast.success('SMS connected successfully!'); 
                      setSmsAuthKey(''); 
                      setSmsSenderId(''); 
                      fetchData();
                    } else { 
                      toast.error('Failed to connect. Please check credentials.'); 
                    }
                  } catch { toast.error('An error occurred.'); }
                  setIsConnectingSms(false);
                }}>
                  <div>
                    <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Provider <span className="text-danger">*</span></label>
                    <select value={smsProvider} onChange={e => setSmsProvider(e.target.value)} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-sm text-text-primary transition-all">
                      <option value="msg91">MSG91</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Auth Key <span className="text-danger">*</span></label>
                      <input type="password" required value={smsAuthKey} onChange={e => setSmsAuthKey(e.target.value)} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-sm text-text-primary font-mono transition-all" placeholder="e.g. 421376xxxxxx" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Sender ID <span className="text-danger">*</span></label>
                      <input type="text" required maxLength={6} value={smsSenderId} onChange={e => setSmsSenderId(e.target.value.toUpperCase())} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl focus:border-accent focus:ring-1 focus:ring-accent/50 outline-none text-sm text-text-primary font-mono uppercase transition-all" placeholder="e.g. QCONTL" />
                    </div>
                  </div>
                  <button type="submit" disabled={isConnectingSms} className="w-full mt-2 bg-text-primary text-bg-primary font-black py-4 rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-black/10 flex justify-center items-center gap-2 text-sm uppercase tracking-wide">
                    {isConnectingSms ? 'Connecting...' : 'Connect SMS'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Telegram Automation UI */}
      <div className="flex flex-col gap-6 mt-4">
        <h2 className="text-2xl font-black flex items-center gap-3">
          <Bot className="w-6 h-6 text-accent" />
          <span>Automation & Notifications</span>
        </h2>
        
        <div className="bg-bg-card border border-border-theme rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md">
          <div className="p-8 border-b border-border-theme/50 bg-bg-primary/30">
            <h3 className="text-xl font-bold">Telegram Smart Reminders</h3>
            <p className="text-sm text-text-secondary mt-1">Configure automated bot alerts and manage owner access securely.</p>
          </div>
          
          <div className="p-8 flex flex-col lg:flex-row gap-12">
            
            {/* Reminder Settings */}
            <form onSubmit={handleUpdateTelegramSettings} className="flex-1 flex flex-col gap-5">
              <h4 className="text-sm font-black uppercase tracking-widest text-text-primary mb-2 flex items-center gap-2 border-b border-border-theme/50 pb-3">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                Alert Configuration
              </h4>
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">Reminder Interval (Minutes)</label>
                <div className="relative">
                  <select value={reminderInterval} onChange={e => setReminderInterval(e.target.value)} className="w-full px-5 py-4 bg-bg-primary border border-border-theme rounded-xl text-sm text-text-primary outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 appearance-none transition-all cursor-pointer font-bold">
                    <option value="0">Disabled / No Reminders</option>
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">60 Minutes</option>
                    <option value="90">90 Minutes</option>
                    <option value="120">120 Minutes</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center px-5 pointer-events-none text-text-secondary">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
                <p className="text-xs text-text-secondary mt-3 leading-relaxed">How long before an active session is flagged as overdue and a notification is sent to Telegram.</p>
              </div>
              <button type="submit" disabled={isUpdatingTelegram} className="mt-auto px-6 py-4 bg-bg-surface border border-border-theme text-text-primary font-black uppercase tracking-wider text-sm rounded-xl hover:bg-bg-primary hover:border-text-secondary/30 transition-all shadow-sm flex items-center justify-center gap-2">
                {isUpdatingTelegram ? 'Saving Changes...' : 'Save Configuration'}
              </button>
            </form>

            <div className="w-px bg-border-theme/50 hidden lg:block"></div>

            {/* Manage Owners */}
            <div className="flex-[1.5] flex flex-col">
              <div className="flex justify-between items-center mb-6 border-b border-border-theme/50 pb-3">
                <h4 className="text-sm font-black uppercase tracking-widest text-text-primary flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                  Authorized Accounts
                </h4>
              </div>
              
              <div className="space-y-4 mb-8 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {telegramOwners.map((owner, idx) => {
                  const isRevoked = owner.status === 'revoked';
                  return (
                    <div key={idx} className={`flex justify-between items-center bg-bg-primary p-5 rounded-xl border transition-all hover:shadow-sm ${isRevoked ? 'border-error/20 bg-error/5' : 'border-border-theme hover:border-accent/30'}`}>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-bold flex items-center gap-2.5">
                          {owner.name} 
                          {owner.role === 'PRIMARY_OWNER' && <Tooltip text="Primary Owner"><span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-md font-black uppercase tracking-wider cursor-help">Primary</span></Tooltip>} 
                          {isRevoked ? (
                            <span className="text-[10px] bg-error/10 text-error px-2 py-0.5 rounded-md font-black uppercase tracking-wider">Revoked</span>
                          ) : (
                            <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-md font-black uppercase tracking-wider">Active</span>
                          )}
                        </span>
                        <div className="flex items-center gap-3 text-xs text-text-secondary font-mono">
                          <span>ID: {owner.chatId}</span>
                          {owner.addedAt && <span suppressHydrationWarning className="opacity-60">• Added {new Date(owner.addedAt).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isRevoked ? (
                          <button onClick={() => handleToggleTelegramOwnerAccess(owner.chatId, owner.status || 'granted')} className="text-[10px] font-black uppercase tracking-wider text-success bg-success/10 hover:bg-success/20 px-4 py-2.5 rounded-lg transition-colors shadow-sm">
                            Grant
                          </button>
                        ) : (
                          <button onClick={() => handleToggleTelegramOwnerAccess(owner.chatId, owner.status || 'granted')} className="text-[10px] font-black uppercase tracking-wider text-error bg-error/10 hover:bg-error/20 px-4 py-2.5 rounded-lg transition-colors shadow-sm">
                            Revoke
                          </button>
                        )}
                        <Tooltip text="Permanently Delete">
                          <button
                            onClick={() => handlePermanentDeleteOwner(owner.chatId)}
                            className="p-2.5 text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors bg-bg-surface border border-border-theme hover:border-red-500/30 rounded-lg ml-1 shadow-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
                
                {telegramOwners.length === 0 && (
                  <div className="text-sm text-text-secondary font-medium text-center p-8 border border-dashed border-border-theme rounded-xl bg-bg-surface/50">No authorized Telegram owners yet.</div>
                )}
              </div>

              <div className="bg-bg-primary/50 border border-border-theme p-6 rounded-xl mt-auto shadow-sm">
                <h4 className="text-xs font-black uppercase tracking-widest text-text-primary mb-4">Add New Owner</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => handleGenerateTelegramLink('PRIMARY_OWNER')} 
                    disabled={generatingLinkRole === 'PRIMARY_OWNER'}
                    className="flex-1 px-5 py-3.5 bg-bg-surface text-text-primary font-black text-xs uppercase tracking-wider rounded-xl hover:bg-bg-card border border-border-theme transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    {generatingLinkRole === 'PRIMARY_OWNER' ? 'Generating...' : 'Link Primary'}
                  </button>
                  <button 
                    onClick={() => handleGenerateTelegramLink('SECONDARY_OWNER')} 
                    disabled={generatingLinkRole === 'SECONDARY_OWNER'}
                    className="flex-1 px-5 py-3.5 bg-blue-500/10 text-blue-500 font-black text-xs uppercase tracking-wider rounded-xl hover:bg-blue-500/20 border border-blue-500/20 transition-all shadow-sm flex items-center justify-center gap-2"
                  >
                    {generatingLinkRole === 'SECONDARY_OWNER' ? 'Generating...' : 'Link Secondary'}
                  </button>
                </div>
                
                {telegramInviteLink && (
                  <div className="mt-5 animate-in fade-in slide-in-from-top-2 bg-bg-card p-4 rounded-xl border border-accent/30 shadow-inner">
                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-2">Invite Link Generated</p>
                    <div className="flex gap-2">
                      <input type="text" readOnly value={telegramInviteLink} className="w-full text-xs font-mono bg-bg-surface p-3 rounded-lg outline-none text-accent border border-border-theme" />
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(telegramInviteLink);
                          toast.success('Link copied to clipboard!');
                        }}
                        className="px-5 py-3 bg-accent text-bg-primary font-black text-xs uppercase tracking-wider rounded-lg hover:opacity-90 transition-opacity shadow-md"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help & Support Section */}
      <div className="flex flex-col gap-6 mt-6">
        <h2 className="text-2xl font-black flex items-center gap-3">
          <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          Help Center
        </h2>
        
        <div className="bg-bg-card border border-border-theme rounded-2xl overflow-hidden flex flex-col p-8 lg:p-12 relative shadow-sm">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
          
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl font-black mb-3 tracking-tight">How can we help?</h2>
            <p className="text-text-secondary text-base leading-relaxed">Search our knowledge base or get in touch with our dedicated support team to resolve your issues quickly.</p>
          </div>
  
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            <button onClick={() => toast('Comprehensive documentation is being prepared for the new update.')} className="p-8 rounded-2xl border border-border-theme bg-bg-surface hover:border-accent hover:shadow-xl hover:shadow-accent/5 transition-all group flex flex-col items-start w-full text-left">
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-inner">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </div>
              <h3 className="font-extrabold text-text-primary text-xl mb-2">Documentation</h3>
              <p className="text-sm text-text-secondary leading-relaxed">Read guides & tutorials on using QControl.</p>
            </button>
            <button onClick={() => toast('IoT Hardware integration is currently in private beta. Contact support to enable.')} className="p-8 rounded-2xl border border-border-theme bg-bg-surface hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/5 transition-all group flex flex-col items-start w-full text-left">
              <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-inner">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <h3 className="font-extrabold text-text-primary text-xl mb-2">API & Hardware</h3>
              <p className="text-sm text-text-secondary leading-relaxed">Setup IoT switches & API integrations.</p>
            </button>
            <button onClick={() => setSidebarTab('subscription')} className="p-8 rounded-2xl border border-border-theme bg-bg-surface hover:border-green-500/50 hover:shadow-xl hover:shadow-green-500/5 transition-all group flex flex-col items-start w-full text-left">
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500 mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-inner">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <h3 className="font-extrabold text-text-primary text-xl mb-2">Billing & Pricing</h3>
              <p className="text-sm text-text-secondary leading-relaxed">Questions about subscription & payments.</p>
            </button>
          </div>
  
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <h3 className="text-xl font-bold text-text-primary mb-8 flex items-center gap-2">
                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Frequently Asked Questions
              </h3>
              <div className="space-y-4">
                <div className="border border-border-theme rounded-2xl p-6 bg-bg-surface hover:border-text-secondary/30 transition-colors shadow-sm">
                  <h4 className="font-extrabold text-sm text-text-primary mb-2">How do I update pricing?</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">Go to the Settings tab to adjust hourly rates or add promotions. Changes take effect immediately for all new sessions.</p>
                </div>
                <div className="border border-border-theme rounded-2xl p-6 bg-bg-surface hover:border-text-secondary/30 transition-colors shadow-sm">
                  <h4 className="font-extrabold text-sm text-text-primary mb-2">My tables aren't syncing?</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">Check your internet connection. QControl uses Supabase for real-time WebSocket sync. Try refreshing the page if the issue persists.</p>
                </div>
                <div className="border border-border-theme rounded-2xl p-6 bg-bg-surface hover:border-text-secondary/30 transition-colors shadow-sm">
                  <h4 className="font-extrabold text-sm text-text-primary mb-2">How do I export data?</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">Navigate to the Reports tab and click "Export CSV". You can export data for specific date ranges.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-bg-primary/80 p-10 rounded-3xl border border-border-theme flex flex-col shadow-lg backdrop-blur-sm">
              <h3 className="text-2xl font-black text-text-primary mb-2">Need direct help?</h3>
              <p className="text-sm text-text-secondary mb-8">Send us a message and our support team will get back to you within 24 hours.</p>
              
              <form onSubmit={(e) => { e.preventDefault(); toast.success("Support request sent! Our team will contact you shortly."); e.currentTarget.reset(); }} className="flex flex-col gap-5 flex-1">
                <input type="text" placeholder="Subject" className="w-full px-5 py-4 bg-bg-surface border border-border-theme rounded-xl text-sm outline-none font-medium input-premium" required />
                <textarea placeholder="Describe your issue in detail..." rows={6} className="w-full px-5 py-4 bg-bg-surface border border-border-theme rounded-xl text-sm outline-none resize-none font-medium input-premium" required></textarea>
                <button type="submit" className="mt-auto py-4 bg-text-primary text-bg-primary font-black uppercase tracking-widest text-sm rounded-xl shadow-[0_4px_15px_rgba(255,255,255,0.2)] flex justify-center items-center gap-2 btn-premium">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  Submit Ticket
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
