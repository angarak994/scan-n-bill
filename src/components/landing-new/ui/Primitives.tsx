'use client';

import React, { useRef, useEffect, useState, ReactNode } from 'react';
import Link from 'next/link';

// --- Hooks ---
export function useReducedMotion() {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setTimeout(() => setMatches(mediaQuery.matches), 0);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  return matches;
}

// --- Layout Primitives ---
export function Section({ children, className = '', id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`py-[var(--space-24)] border-t border-border-hairline ${className}`}>
      {children}
    </section>
  );
}

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`max-w-[1200px] w-full mx-auto px-[var(--space-4)] sm:px-[var(--space-6)] lg:px-[var(--space-8)] ${className}`}>
      {children}
    </div>
  );
}

export function Stack({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-[var(--space-4)] ${className}`}>{children}</div>;
}

// --- Typography ---
export function H2({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-[var(--text-4xl)] sm:text-[var(--text-5xl)] font-bold font-display tracking-tight text-balance ${className}`}>{children}</h2>;
}

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  magnetic?: boolean;
  loading?: boolean;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ 
  children, variant = 'primary', magnetic = false, loading, className = '', ...props 
}, ref) => {
  const baseClasses = 'relative inline-flex items-center justify-center gap-2 px-[var(--space-6)] py-[var(--space-3)] rounded-[var(--radius-md)] font-bold text-[var(--text-sm)] transition-interactive focus-ring disabled:opacity-50 disabled:pointer-events-none active-press';
  
  const variants = {
    primary: 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] border border-transparent shadow-[var(--shadow-sm)]',
    secondary: 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-strong)] hover:border-[var(--accent)] shadow-[var(--shadow-sm)]',
    outline: 'bg-transparent border border-[var(--border-strong)] text-[var(--text-primary)] hover:border-[var(--text-primary)]',
    ghost: 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border-hairline)]'
  };

  return (
    <button
      ref={ref}
      className={`${baseClasses} ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
      ) : children}
    </button>
  );
});
Button.displayName = 'Button';

// --- Input & Forms ---
export function Input({ className = '', label, error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string, error?: string }) {
  return (
    <div className="flex flex-col gap-[var(--space-2)] w-full">
      {label && <label className="text-[var(--text-sm)] font-bold text-[var(--text-secondary)]">{label}</label>}
      <input 
        className={`w-full bg-[var(--bg-surface)] border ${error ? 'border-[var(--danger)]' : 'border-[var(--border-strong)]'} rounded-[var(--radius-sm)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-primary)] focus-ring transition-interactive ${className}`}
        {...props}
      />
      {error && <span className="text-[var(--text-xs)] text-[var(--danger)]">{error}</span>}
    </div>
  );
}

// --- Badge / StatusChip ---
export function Badge({ children, variant = 'default' }: { children: ReactNode, variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' }) {
  const variants = {
    default: 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-strong)]',
    success: 'bg-[var(--success)] text-white border-transparent',
    warning: 'bg-[var(--warning)] text-black border-transparent',
    danger: 'bg-[var(--danger)] text-white border-transparent',
    info: 'bg-[var(--info)] text-white border-transparent',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-[var(--radius-full)] text-[var(--text-xs)] font-bold uppercase tracking-wider border ${variants[variant]}`}>
      {children}
    </span>
  );
}

// --- Card (Replaces AnimatedBorder to remove AI slop) ---
export function Card({ children, className = '', elevated = false }: { children: ReactNode; className?: string, elevated?: boolean }) {
  return (
    <div className={`bg-[var(--bg-elevated)] border border-[var(--border-hairline)] rounded-[var(--radius-lg)] p-[var(--space-6)] transition-structural ${elevated ? 'shadow-[var(--shadow-md)] hover:border-[var(--border-strong)]' : 'shadow-none'} ${className}`}>
      {children}
    </div>
  );
}

// For backwards compatibility during Phase 2 transition
export const AnimatedBorder = Card;

// --- Modal ---
export function Modal({ isOpen, onClose, children, title }: { isOpen: boolean; onClose: () => void; children: ReactNode, title?: string }) {
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
      // Basic focus trap could go here
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-[var(--space-4)] sm:p-[var(--space-6)] animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true"></div>
      <div ref={modalRef} className="relative bg-[var(--bg-base)] border border-[var(--border-strong)] rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)] overflow-hidden max-w-lg w-full max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between p-[var(--space-6)] border-b border-[var(--border-hairline)]">
          {title && <h3 className="text-[var(--text-xl)] font-bold">{title}</h3>}
          <button onClick={onClose} className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-[var(--radius-full)] focus-ring transition-interactive ml-auto" aria-label="Close modal">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-[var(--space-6)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Accordion ---
export function Accordion({ title, children, isOpen, onClick }: { title: string; children: ReactNode; isOpen: boolean; onClick: () => void }) {
  return (
    <div className="border-b border-[var(--border-hairline)]">
      <button 
        className="w-full py-[var(--space-4)] flex items-center justify-between text-left focus-ring rounded-[var(--radius-sm)]"
        onClick={onClick}
        aria-expanded={isOpen}
      >
        <span className="font-bold text-[var(--text-base)] text-[var(--text-primary)]">{title}</span>
        <svg className={`w-5 h-5 text-[var(--text-muted)] transition-transform duration-250 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      <div 
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? '500px' : '0', opacity: isOpen ? 1 : 0 }}
        aria-hidden={!isOpen}
      >
        <div className="pb-[var(--space-4)] text-[var(--text-secondary)] text-[var(--text-sm)]">
          {children}
        </div>
      </div>
    </div>
  );
}
