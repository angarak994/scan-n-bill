'use client';

import React, { useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';

export interface MobileMoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onSelectTab: (tab: any) => void;
  preferences?: any;
  businessName?: string;
  ownerName?: string;
  onOpenManualModal?: () => void;
  onOpenQRModal?: () => void;
  onLogoutClick?: () => void;
}

export default function MobileMoreSheet({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  preferences,
  businessName,
  ownerName,
  onOpenManualModal,
  onOpenQRModal,
  onLogoutClick,
}: MobileMoreSheetProps) {
  const { t } = useLanguage();

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleItemClick = (tab: string) => {
    onSelectTab(tab);
    onClose();
  };

  const navItems = [
    {
      id: 'menu',
      label: 'Food & Beverages',
      description: 'Manage snacks, drinks & stock status',
      badge: null,
      icon: (
        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      id: 'messaging',
      label: 'Messaging & Bot',
      description: 'Automated WhatsApp & SMS templates',
      badge: null,
      icon: (
        <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
    },
    {
      id: 'reports',
      label: t('reports', 'Reports & Financials'),
      description: 'Reconciled revenue, cash flow & trail',
      badge: null,
      icon: (
        <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: t('settings', 'Club Settings'),
      description: 'Pricing slabs, stations & UPI QR',
      badge: null,
      icon: (
        <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      id: 'subscription',
      label: 'Subscription & Billing',
      description: 'QControl plan & payment invoices',
      badge: 'Active',
      icon: (
        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      id: 'support',
      label: 'Support & FAQs',
      description: 'Club owner guides & assistance',
      badge: null,
      icon: (
        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-sm lg:hidden overflow-hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-bg-surface border-t border-border-theme rounded-t-3xl shadow-2xl flex flex-col max-h-[88dvh] animate-sheet-up overflow-hidden pb-safe"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1 bg-border-theme rounded-full opacity-60" />
        </div>

        {/* Sheet Title Bar */}
        <div className="px-6 py-3 border-b border-border-theme flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-text-primary">More Modules</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              {businessName || 'QControl Club Hub'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="touch-target w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Quick Action Button for Manual Session */}
        {onOpenManualModal && (
          <div className="p-4 border-b border-border-theme bg-bg-primary/50">
            <button
              onClick={() => {
                onOpenManualModal();
                onClose();
              }}
              className="touch-target w-full py-3 bg-secondary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md btn-premium active:scale-98"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>{t('new_session', 'Start New Session')}</span>
            </button>
          </div>
        )}

        {/* Navigation Grid */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3.5 p-3.5 rounded-xl text-left transition-all touch-target ${
                  isActive
                    ? 'bg-accent/15 border border-accent/30 text-accent font-bold'
                    : 'bg-bg-card hover:bg-bg-primary border border-border-theme text-text-primary'
                }`}
              >
                <div className="p-2 rounded-lg bg-bg-surface border border-border-theme shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-accent/20 text-accent border border-accent/30 uppercase">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary truncate mt-0.5">{item.description}</p>
                </div>
                <svg className="w-4 h-4 text-text-disabled shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>

        {/* Footer with Sign Out */}
        {onLogoutClick && (
          <div className="p-4 border-t border-border-theme bg-bg-surface shrink-0">
            <button
              onClick={() => {
                onLogoutClick();
                onClose();
              }}
              className="touch-target w-full py-2.5 rounded-xl border border-red-500/20 text-red-500 font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>{t('logout', 'Sign Out')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
