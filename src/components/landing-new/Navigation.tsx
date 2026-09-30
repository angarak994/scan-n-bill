'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button, Modal } from './ui/Primitives';

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<'product' | 'resources' | null>(null);
  const lastScrollY = useRef(0);

  // Modals state
  const [docsOpen, setDocsOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 20);
      
      // Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setHidden(true);
        setActiveDropdown(null); // close dropdowns on scroll
      } else {
        setHidden(false);
      }
      lastScrollY.current = currentScrollY;
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Trap focus for mobile drawer
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [mobileOpen]);

  const closeMenus = () => {
    setMobileOpen(false);
    setActiveDropdown(null);
  };

  const navLinks = [
    { name: 'Features', href: '#features' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Promotions', href: '#promotions' },
    { name: 'Pricing', href: '#pricing' },
  ];

  const productItems = [
    { name: 'Live Table Management', href: '#tables' },
    { name: 'Smart Billing', href: '#billing' },
    { name: 'QR Sessions', href: '#qr' },
    { name: 'Telegram Control', href: '#telegram' },
    { name: 'Promotions', href: '#promotions' },
    { name: 'Reports', href: '#reports' },
  ];

  return (
    <>
      <nav 
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ease-in-out ${hidden ? '-translate-y-full' : 'translate-y-0'} ${scrolled ? 'bg-bg-base/80 backdrop-blur-md border-b border-border-light py-3' : 'bg-transparent py-5'}`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm" onClick={closeMenus}>
            <div className="w-8 h-8 rounded-full bg-baize-green flex items-center justify-center border border-border-light group-hover:border-accent transition-colors">
               <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
            </div>
            <span className="text-xl font-bold font-display tracking-tight text-white">QControl</span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center gap-1">
            {/* Product Mega Menu */}
            <div 
              className="relative"
              onMouseEnter={() => setActiveDropdown('product')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button 
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
                onClick={() => setActiveDropdown(activeDropdown === 'product' ? null : 'product')}
                aria-expanded={activeDropdown === 'product'}
              >
                Product
                <svg className={`w-4 h-4 transition-transform ${activeDropdown === 'product' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              
              {activeDropdown === 'product' && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 w-[600px] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-bg-surface border border-border-light rounded-xl p-6 shadow-2xl grid grid-cols-2 gap-x-8 gap-y-4">
                    {productItems.map((item) => (
                      <Link 
                        key={item.name} 
                        href={item.href} 
                        className="group flex items-center gap-3 p-2 -m-2 rounded-lg hover:bg-white/5 transition-colors"
                        onClick={closeMenus}
                      >
                        <div className="w-8 h-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-accent group-hover:bg-accent/10 transition-colors">
                          <div className="w-1.5 h-1.5 rounded-full bg-text-secondary group-hover:bg-accent transition-colors"></div>
                        </div>
                        <span className="text-sm font-medium text-white">{item.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {navLinks.map((link) => (
              <Link key={link.name} href={link.href} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md">
                {link.name}
              </Link>
            ))}

            {/* Resources Menu */}
            <div 
              className="relative"
              onMouseEnter={() => setActiveDropdown('resources')}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button 
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
                onClick={() => setActiveDropdown(activeDropdown === 'resources' ? null : 'resources')}
                aria-expanded={activeDropdown === 'resources'}
              >
                Resources
                <svg className={`w-4 h-4 transition-transform ${activeDropdown === 'resources' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              
              {activeDropdown === 'resources' && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 w-[200px] animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="bg-bg-surface border border-border-light rounded-xl p-2 shadow-2xl flex flex-col">
                    <button onClick={() => { setDocsOpen(true); closeMenus(); }} className="text-left px-4 py-2.5 text-sm font-medium text-white hover:bg-white/5 rounded-md transition-colors">Documentation</button>
                    <Link href="#faq" onClick={closeMenus} className="px-4 py-2.5 text-sm font-medium text-white hover:bg-white/5 rounded-md transition-colors">FAQ</Link>
                    <button onClick={() => { setContactOpen(true); closeMenus(); }} className="text-left px-4 py-2.5 text-sm font-medium text-white hover:bg-white/5 rounded-md transition-colors">Contact Us</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CTAs */}
          <div className="hidden lg:flex items-center gap-4">
            <Link href="/login" className="text-sm font-bold text-text-secondary hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-2 py-1">
              Log In
            </Link>
            <Link href="/onboard">
              <Button magnetic={false} variant="primary" className="py-2.5 px-5">Get Started</Button>
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button 
            className="lg:hidden p-2 text-white outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Full-Screen Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-bg-base/95 backdrop-blur-xl lg:hidden pt-24 pb-8 px-6 overflow-y-auto animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col gap-6">
            <div className="text-xs font-mono text-text-muted uppercase tracking-widest">Product</div>
            <div className="grid grid-cols-1 gap-2 border-b border-border-light pb-6">
               {productItems.map(item => (
                 <Link key={item.name} href={item.href} onClick={closeMenus} className="flex items-center gap-3 py-3 text-lg font-medium text-white">
                   <div className="w-2 h-2 rounded-full bg-accent"></div>
                   {item.name}
                 </Link>
               ))}
            </div>
            
            <div className="flex flex-col gap-2 border-b border-border-light pb-6">
              {navLinks.map(link => (
                <Link key={link.name} href={link.href} onClick={closeMenus} className="py-3 text-lg font-medium text-text-secondary hover:text-white">
                  {link.name}
                </Link>
              ))}
              <button onClick={() => { setDocsOpen(true); closeMenus(); }} className="text-left py-3 text-lg font-medium text-text-secondary hover:text-white">Documentation</button>
              <button onClick={() => { setContactOpen(true); closeMenus(); }} className="text-left py-3 text-lg font-medium text-text-secondary hover:text-white">Contact</button>
            </div>

            <div className="flex flex-col gap-4 pt-2">
              <Link href="/login" onClick={closeMenus} className="w-full py-4 text-center text-lg font-bold text-white bg-white/5 rounded-xl border border-white/10">
                Log In
              </Link>
              <Link href="/onboard" onClick={closeMenus} className="w-full py-4 text-center text-lg font-bold text-bg-base bg-accent rounded-xl">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Shared Modals */}
      <Modal isOpen={docsOpen} onClose={() => setDocsOpen(false)}>
         <h2 className="text-2xl font-bold mb-4">Documentation</h2>
         <p className="text-text-secondary mb-6 leading-relaxed">
           This is a demo documentation modal. In the production app, this would route to our developer portal or help center.
         </p>
         <Button onClick={() => setDocsOpen(false)} variant="secondary" className="w-full">Close</Button>
      </Modal>

      <Modal isOpen={contactOpen} onClose={() => setContactOpen(false)}>
         <h2 className="text-2xl font-bold mb-4">Contact Sales</h2>
         <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); setContactOpen(false); }}>
           <div>
             <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
             <input type="email" required className="w-full bg-bg-base border border-border-strong rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent" placeholder="hello@club.com" />
           </div>
           <div>
             <label className="block text-sm font-medium text-text-secondary mb-1">Message</label>
             <textarea required rows={4} className="w-full bg-bg-base border border-border-strong rounded-lg px-4 py-3 text-white focus:outline-none focus:border-accent" placeholder="How can we help?"></textarea>
           </div>
           <Button type="submit" variant="primary" className="w-full mt-2">Send Message</Button>
         </form>
      </Modal>
    </>
  );
}
