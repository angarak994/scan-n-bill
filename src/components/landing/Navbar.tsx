'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Sun, Moon } from 'lucide-react';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    const stored = localStorage.getItem('theme');
    if (stored === 'light') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme('light');
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <nav className="w-full flex items-center justify-between px-4 sm:px-8 py-4 max-w-7xl mx-auto gap-4 sticky top-0 z-50 bg-bg-primary/80 backdrop-blur-xl border-b border-border/50">
      {/* Logo (Left) */}
      <Link href="/" className="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md p-1">
        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-accent drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        <span className="text-lg sm:text-xl font-bold font-mono tracking-tighter">Qcontrol<span className="text-accent drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">.</span></span>
      </Link>

      {/* Nav Links (Center) */}
      <div className="hidden lg:flex justify-center items-center gap-8 text-sm font-bold text-text-secondary">
        {navLinks.map((link) => (
          <Link key={link.name} href={link.href} className="hover:text-text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-2 py-1">
            {link.name}
          </Link>
        ))}
      </div>

      {/* Actions (Right) */}
      <div className="hidden lg:flex justify-end gap-3 items-center">
        {isMounted && (
          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full hover:bg-border/30 text-text-secondary hover:text-text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        )}
        <Link href="/demo" className="px-4 py-2 rounded-full font-bold text-sm text-accent bg-accent/10 hover:bg-accent/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent">
          Explore Demo
        </Link>
        <Link href="/pricing" className="px-4 py-2 rounded-full font-bold text-sm text-text-secondary hover:text-text-primary transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent">
          View Plans
        </Link>
        <Link href="/onboard" className="px-4 py-2 bg-accent text-white font-bold text-sm rounded-full hover:bg-accent/90 transition-all border border-transparent hover:border-accent outline-none focus-visible:ring-2 focus-visible:ring-accent shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          Register Business
        </Link>
      </div>

      {/* Mobile Toggle */}
      <div className="lg:hidden flex items-center gap-4">
        {isMounted && (
          <button 
            onClick={toggleTheme} 
            className="p-2 rounded-full hover:bg-border/30 text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        )}
        <button 
          className="p-2 text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle Menu"
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-bg-primary/95 backdrop-blur-xl border-b border-border p-4 flex flex-col gap-4 lg:hidden shadow-lg animate-in slide-in-from-top-2">
          {navLinks.map((link) => (
            <Link key={link.name} href={link.href} onClick={() => setIsOpen(false)} className="text-lg font-bold text-text-secondary hover:text-text-primary p-2 rounded-md">
              {link.name}
            </Link>
          ))}
          <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-border">
            <Link href="/demo" onClick={() => setIsOpen(false)} className="w-full text-center px-4 py-3 rounded-xl font-bold text-accent bg-accent/10 hover:bg-accent/20 transition-colors">
              Explore Demo
            </Link>
            <Link href="/pricing" onClick={() => setIsOpen(false)} className="w-full text-center px-4 py-3 rounded-xl font-bold text-text-primary border border-border hover:bg-border/50 transition-colors">
              View Plans
            </Link>
            <Link href="/onboard" onClick={() => setIsOpen(false)} className="w-full text-center px-4 py-3 bg-accent text-white font-bold rounded-xl hover:bg-accent/90 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              Register Business
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
