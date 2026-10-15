'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown, Sparkles, X, Languages } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { SupportedLanguage } from '@/lib/i18n';

interface LanguageOption {
  id: SupportedLanguage;
  code: string;
  name: string;
  nativeName: string;
  subtitle: string;
  flag: string;
  badge: string;
}

const LANGUAGES: LanguageOption[] = [
  {
    id: 'en',
    code: 'EN',
    name: 'English',
    nativeName: 'English',
    subtitle: 'International standard • Default',
    flag: '',
    badge: 'Global'
  },
  {
    id: 'hi',
    code: 'हिं',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    subtitle: 'देवनागरी लिपि • सम्पूर्ण प्रणाली',
    flag: '',
    badge: 'लोकप्रिय'
  },
  {
    id: 'mr',
    code: 'मरा',
    name: 'Marathi',
    nativeName: 'मराठी',
    subtitle: 'देवनागरी लिपी • महाराष्ट्र राज्य',
    flag: '',
    badge: 'स्थानिक'
  }
];

export default function FancyLanguageToggle({ 
  className = '',
  showDropdown = true 
}: { 
  className?: string;
  showDropdown?: boolean;
}) {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeIndex = LANGUAGES.findIndex(l => l.id === language);
  const currentLang = LANGUAGES.find(l => l.id === language) || LANGUAGES[0];

  const handleSelectLanguage = (langId: SupportedLanguage) => {
    setLanguage(langId);
    // Add small delay before closing pop-up to show checkmark animation
    setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-flex items-center ${className}`}>
      {/* Main Luxury Toggle Bar */}
      <div className="flex items-center bg-bg-surface/90 backdrop-blur-xl border border-border-theme/80 hover:border-accent/50 rounded-full p-1 shadow-[0_2px_15px_rgba(0,0,0,0.15)] transition-all duration-300">
        
        {/* Globe Popover Trigger Button */}
        {showDropdown && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-1.5 pl-2.5 pr-2 py-1 text-xs font-semibold rounded-full transition-all duration-200 outline-none ${
              isOpen 
                ? 'bg-accent/15 text-accent shadow-sm' 
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary/50'
            }`}
            title="Language settings and options"
            aria-label="Language options"
            aria-expanded={isOpen}
          >
            <div className="relative">
              <Globe className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? 'rotate-90 text-accent' : 'text-accent/90'}`} />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent rounded-full animate-ping opacity-75"></span>
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-accent rounded-full"></span>
            </div>
            <ChevronDown className={`w-3 h-3 text-text-secondary transition-transform duration-300 ${isOpen ? 'rotate-180 text-accent' : ''}`} />
          </button>
        )}

        {/* Separator Line */}
        {showDropdown && <div className="h-4 w-[1px] bg-border-theme mx-0.5" />}

        {/* Sliding Segmented Pill Switcher */}
        <div className="relative flex items-center p-0.5 bg-bg-primary/60 rounded-full border border-border-theme/40">
          {/* Animated Sliding Background Bubble */}
          <div 
            className="absolute top-0.5 bottom-0.5 w-[calc((100%-4px)/3)] rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] bg-gradient-to-r from-accent to-emerald-400 shadow-[0_2px_10px_rgba(16,185,129,0.45)] ring-1 ring-white/20"
            style={{
              left: `${(activeIndex * 100) / 3}%`,
              transform: `translateX(${activeIndex === 0 ? '2px' : activeIndex === 1 ? '0px' : '-2px'})`
            }}
          />

          {LANGUAGES.map((item) => {
            const isActive = language === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setLanguage(item.id)}
                className={`relative z-10 px-2.5 sm:px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 select-none flex items-center justify-center min-w-[34px] sm:min-w-[38px] ${
                  isActive
                    ? 'text-black font-extrabold drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)] scale-[1.02]'
                    : 'text-text-secondary hover:text-text-primary hover:scale-105 opacity-80 hover:opacity-100'
                }`}
                title={`${item.name} (${item.nativeName})`}
              >
                <span>{item.code}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Luxury Floating Pop-Up Card */}
      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2.5 w-80 sm:w-88 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right"
        >
          <div className="bg-bg-card/95 backdrop-blur-2xl border border-border-theme/90 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10 flex flex-col gap-3">
            
            {/* Pop-up Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border-theme/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <Languages className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                    Select Language
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-semibold">
                      Live
                    </span>
                  </h4>
                  <p className="text-[10px] text-text-secondary">
                    Changes reflect across tables, bills & bot instantly
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsOpen(false)}
                className="w-6 h-6 rounded-full bg-bg-surface hover:bg-bg-primary text-text-secondary hover:text-text-primary border border-border-theme flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Language Cards List */}
            <div className="flex flex-col gap-2">
              {LANGUAGES.map((lang) => {
                const isSelected = language === lang.id;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.id)}
                    className={`group relative w-full p-3 rounded-xl border text-left transition-all duration-200 flex items-center justify-between ${
                      isSelected
                        ? 'border-accent bg-accent/10 shadow-[0_0_20px_rgba(16,185,129,0.15)] ring-1 ring-accent'
                        : 'border-border-theme bg-bg-surface/60 hover:bg-bg-surface hover:border-accent/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Flag / Script Badge */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs border transition-transform duration-200 group-hover:scale-105 ${
                        isSelected 
                          ? 'bg-accent/20 border-accent/50 shadow-sm' 
                          : 'bg-bg-card border-border-theme'
                      }`}>
                        <span className="font-mono font-black text-xs text-accent tracking-wider">{lang.code}</span>
                      </div>

                      {/* Language Title & Subtitle */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-primary">
                            {lang.name}
                          </span>
                          <span className="text-xs font-semibold text-accent">
                            ({lang.nativeName})
                          </span>
                        </div>
                        <p className="text-[10px] text-text-secondary mt-0.5">
                          {lang.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Status Pill / Checkmark */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                        isSelected 
                          ? 'bg-accent text-black font-extrabold shadow-sm' 
                          : 'bg-bg-primary border border-border-theme text-text-secondary'
                      }`}>
                        {lang.code}
                      </span>
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-black shadow-sm">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-border-theme group-hover:border-accent/40 transition-colors" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Footer Info */}
            <div className="pt-2 border-t border-border-theme/40 flex items-center justify-between text-[10px] text-text-secondary px-1">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-accent" />
                Active: <strong className="text-text-primary">{currentLang.name} ({currentLang.code})</strong>
              </span>
              <span className="italic">QControl i18n Engine</span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
