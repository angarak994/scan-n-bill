'use client';

import React, { createContext, useContext, useSyncExternalStore } from 'react';
import { SupportedLanguage, Translations, t as translateHelper } from '@/lib/i18n';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: keyof Translations, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key, fallback) => fallback || String(key),
});

function getClientLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem('qcontrol_language') as SupportedLanguage;
    if (saved === 'en' || saved === 'hi' || saved === 'mr') return saved;
  } catch {
    // ignore
  }
  return 'en';
}

function getServerLanguage(): SupportedLanguage {
  return 'en';
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener('qcontrol_language_change', callback);

  // Immediately notify on next tick so client mounts with stored language
  const timer = setTimeout(callback, 0);

  return () => {
    clearTimeout(timer);
    window.removeEventListener('storage', callback);
    window.removeEventListener('qcontrol_language_change', callback);
  };
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const language = useSyncExternalStore(subscribe, getClientLanguage, getServerLanguage);

  const setLanguage = (lang: SupportedLanguage) => {
    try {
      localStorage.setItem('qcontrol_language', lang);
      window.dispatchEvent(new Event('qcontrol_language_change'));
    } catch {
      // ignore
    }
  };

  const t = (key: keyof Translations, fallback?: string) => {
    return translateHelper(language, key, fallback);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
