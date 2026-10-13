'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Sun, Moon, ArrowRight, Sparkles } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const stored = localStorage.getItem('theme');
    if (stored === 'light') {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const navLinks = [
    { name: 'Features', href: '/#features' },
    { name: 'Integrations', href: '/#integrations' },
    { name: 'Pricing', href: '/pricing' },
    { name: 'FAQ', href: '/#faq' }
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-bg-primary/80 backdrop-blur-xl border-b border-border/40 transition-colors">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
        {/* Brand Logo (Left) */}
        <Link 
          href="/" 
          className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg p-1 group shrink-0"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent group-hover:scale-105 transition-transform">
            <svg className="w-5 h-5 text-accent drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-text-primary">
            Qcontrol<span className="text-accent drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">.</span>
          </span>
        </Link>

        {/* Desktop Nav Links (Center) */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-text-secondary">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              href={link.href} 
              className="hover:text-text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-1.5 py-1"
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Desktop Action Buttons (Right) */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {isMounted && (
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full border border-border/60 hover:border-accent/40 hover:bg-accent/5 text-text-secondary hover:text-text-primary transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          <Link 
            href="/demo" 
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full font-semibold text-xs tracking-wide text-accent bg-accent/10 hover:bg-accent/20 border border-accent/20 transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Explore Demo</span>
          </Link>

          <Link 
            href="/login" 
            className="px-3.5 py-2 rounded-full font-semibold text-sm text-text-secondary hover:text-text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent whitespace-nowrap"
          >
            Log In
          </Link>

          <Link 
            href="/onboard" 
            className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2 bg-accent text-white font-semibold text-sm rounded-full hover:bg-accent/90 active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] whitespace-nowrap"
          >
            <span>Register Business</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile Hamburger & Theme Toggle */}
        <div className="flex md:hidden items-center gap-2">
          {isMounted && (
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full border border-border/60 text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
          <button 
            className="p-2 text-text-primary rounded-lg hover:bg-border/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle Menu"
            aria-expanded={isOpen}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isOpen && (
        <div className="md:hidden w-full bg-bg-primary/95 backdrop-blur-xl border-b border-border/60 px-6 py-6 flex flex-col gap-4 shadow-xl animate-in slide-in-from-top-2">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link 
                key={link.name} 
                href={link.href} 
                onClick={() => setIsOpen(false)} 
                className="text-base font-semibold text-text-secondary hover:text-text-primary py-2.5 px-3 rounded-lg hover:bg-bg-surface transition-colors"
              >
                {link.name}
              </Link>
            ))}
          </nav>
          
          <div className="flex flex-col gap-3 pt-4 border-t border-border/60">
            <Link 
              href="/demo" 
              onClick={() => setIsOpen(false)} 
              className="w-full text-center px-4 py-3 rounded-xl font-bold text-sm text-accent bg-accent/10 hover:bg-accent/20 border border-accent/20 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Explore Demo</span>
            </Link>
            
            <Link 
              href="/login" 
              onClick={() => setIsOpen(false)} 
              className="w-full text-center px-4 py-3 rounded-xl font-bold text-sm text-text-secondary hover:text-text-primary border border-border hover:bg-border/40 transition-colors"
            >
              Log In
            </Link>
            
            <Link 
              href="/onboard" 
              onClick={() => setIsOpen(false)} 
              className="w-full text-center px-4 py-3 bg-accent text-white font-bold text-sm rounded-xl hover:bg-accent/90 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
            >
              <span>Register Business</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
