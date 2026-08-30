'use client';

import { Toaster, toast, ToastBar } from 'react-hot-toast';

export function Providers() {
  return (
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
  );
}
