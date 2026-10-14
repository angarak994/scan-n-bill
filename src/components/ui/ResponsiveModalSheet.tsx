'use client';

import React, { useEffect, useRef } from 'react';

export interface ResponsiveModalSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string; // e.g. 'max-w-xl', 'max-w-2xl'
  showCloseButton?: boolean;
  preventBackdropClose?: boolean;
}

/**
 * ResponsiveModalSheet
 * - Desktop & Tablet (>= 768px): Centered, elegant modal dialog with backdrop blur
 * - Mobile (< 768px): Native bottom sheet with drag indicator, max-h-[90dvh], sticky header & footer
 */
export default function ResponsiveModalSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'max-w-xl',
  showCloseButton = true,
  preventBackdropClose = false,
}: ResponsiveModalSheetProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center bg-black/70 backdrop-blur-sm p-0 md:p-4 overflow-hidden"
      onClick={() => {
        if (!preventBackdropClose) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        ref={contentRef}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidthClass} bg-bg-surface border-t md:border border-border-theme rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col max-h-[90dvh] md:max-h-[85vh] animate-sheet-up md:animate-entrance overflow-hidden transition-all`}
      >
        {/* Mobile Drag Indicator */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 bg-border-theme rounded-full opacity-70" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3.5 md:py-4 border-b border-border-theme flex items-center justify-between shrink-0 bg-bg-surface/90 backdrop-blur">
          <div className="min-w-0 pr-3">
            <h3 className="text-base md:text-lg font-bold text-text-primary tracking-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-text-secondary mt-0.5 truncate font-medium">
                {subtitle}
              </p>
            )}
          </div>

          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="touch-target w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-card transition-colors shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-4">
          {children}
        </div>

        {/* Sticky Action Footer */}
        {footer && (
          <div className="px-5 py-3.5 md:py-4 border-t border-border-theme bg-bg-surface shrink-0 pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
