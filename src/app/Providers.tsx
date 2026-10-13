'use client';

import React from 'react';
import { Toaster, toast, ToastBar } from 'react-hot-toast';
import { LanguageProvider } from '@/context/LanguageContext';

// Filter out React 19 false-positive script tag warning for client rendering
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Encountered a script tag while rendering React component')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

export function Providers({ children }: { children?: React.ReactNode }) {
  return (
    <LanguageProvider>
      <Toaster 
        position="top-center"
        toastOptions={{
          className: '!bg-bg-surface !text-text-primary !border !border-border-theme !shadow-2xl cursor-pointer',
          style: { zIndex: 9999 }
        }}
      >
        {(t) => (
          <div onClick={() => toast.dismiss(t.id)}>
            <ToastBar toast={t} />
          </div>
        )}
      </Toaster>
      {children}
    </LanguageProvider>
  );
}
