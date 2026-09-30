'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button, Modal, Container, Section, H2, Input } from './ui/Primitives';

export default function FooterNew() {
  const [modalContent, setModalContent] = useState<{ title: string; content: React.ReactNode } | null>(null);

  const openTrialModal = () => {
    setModalContent({
      title: 'Start Free Trial',
      content: (
        <form className="flex flex-col gap-[var(--space-4)]" onSubmit={(e) => { e.preventDefault(); setModalContent({ title: 'Success', content: <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">Thanks! We will contact you shortly.</p> }); }}>
          <p className="text-[var(--text-sm)] text-[var(--text-secondary)] mb-[var(--space-2)]">Our self-serve onboarding is launching soon. Leave your details and we'll set up your free trial account immediately.</p>
          <Input type="text" placeholder="Club Name" required aria-label="Club Name" />
          <Input type="email" placeholder="Email Address" required aria-label="Email Address" />
          <Input type="tel" placeholder="Phone Number" required aria-label="Phone Number" />
          <Button type="submit" variant="primary" className="w-full mt-[var(--space-2)]">Request Trial Access</Button>
        </form>
      )
    });
  };

  const openModal = (type: string) => {
    if (type === 'trial') return openTrialModal();
    
    switch (type) {
      case 'privacy':
        setModalContent({
          title: 'Privacy Policy',
          content: <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">This is a simulated privacy policy for the QControl demo. All data here is local and temporary.</p>
        });
        break;
      case 'terms':
        setModalContent({
          title: 'Terms of Service',
          content: <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">These are the simulated terms of service for the QControl demo environment.</p>
        });
        break;
      case 'about':
        setModalContent({
          title: 'About QControl',
          content: <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">QControl is the premier operating system for modern billiards clubs, offering realtime table management, smart billing, and telegram integrations.</p>
        });
        break;
      case 'contact':
        setModalContent({
          title: 'Contact Us',
          content: <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">Please email sales@qcontrol.app to schedule a real demo.</p>
        });
        break;
      case 'docs':
        setModalContent({
          title: 'Documentation',
          content: <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">API and integration documentation is provided to active customers upon onboarding.</p>
        });
        break;
    }
  };

  return (
    <div className="bg-[var(--bg-base)] border-t border-[var(--border-hairline)] relative z-10 transition-colors duration-200">
      {/* FINAL CTA */}
      <Section className="py-[var(--space-32)] !border-t-0">
        <Container>
          <div className="max-w-4xl px-[var(--space-6)] text-left flex flex-col items-start">
            <H2 className="text-[var(--text-5xl)] sm:text-[var(--text-6xl)] md:text-[var(--text-6xl)] font-black tracking-tight mb-[var(--space-8)] text-balance">
              Run more of your club <span className="text-[var(--text-muted)]">from one place.</span>
            </H2>
            <p className="text-[var(--text-xl)] text-[var(--text-secondary)] mb-[var(--space-12)] max-w-2xl text-balance leading-[1.6]">
              Live tables. Accurate billing. QR sessions. Promotions. Owner controls. Reports. One connected system designed exclusively for billiards.
            </p>
            <div className="flex flex-col sm:flex-row gap-[var(--space-4)] w-full sm:w-auto">
               <Button variant="primary" className="w-full sm:w-auto" onClick={() => openModal('trial')}>Start Free Trial</Button>
               <Link href="#why" className="w-full sm:w-auto" tabIndex={-1}>
                  <Button variant="secondary" className="w-full sm:w-auto">Explore QControl</Button>
               </Link>
            </div>
          </div>
        </Container>
      </Section>

      {/* FOOTER */}
      <footer className="py-[var(--space-16)] border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]">
         <Container>
           <div className="grid grid-cols-2 md:grid-cols-12 gap-[var(--space-12)]">
              <div className="col-span-2 md:col-span-4 flex flex-col items-start">
                <Link href="/" className="flex items-center gap-[var(--space-2)] mb-[var(--space-6)] focus-ring rounded-[var(--radius-sm)]">
                  <div className="w-6 h-6 rounded-[var(--radius-full)] bg-[var(--accent)] flex items-center justify-center border border-transparent">
                    <div className="w-1.5 h-1.5 rounded-[var(--radius-full)] bg-white"></div>
                  </div>
                  <span className="text-[var(--text-xl)] font-bold font-display tracking-tight text-[var(--text-primary)]">QControl</span>
                </Link>
                <p className="text-[var(--text-sm)] text-[var(--text-secondary)] max-w-xs mb-[var(--space-8)]">
                  The intelligent operating system for modern billiards and snooker clubs. 
                </p>
              </div>
              
              <div className="col-span-1 md:col-span-2">
                <h4 className="font-bold mb-[var(--space-4)] text-[var(--text-sm)] text-[var(--text-primary)]">Product</h4>
                <ul className="space-y-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-secondary)] flex flex-col items-start">
                  <li><Link href="#tables" className="hover:text-[var(--text-primary)] transition-interactive focus-ring rounded-sm">Live Tables</Link></li>
                  <li><Link href="#billing" className="hover:text-[var(--text-primary)] transition-interactive focus-ring rounded-sm">Smart Billing</Link></li>
                  <li><Link href="#qr" className="hover:text-[var(--text-primary)] transition-interactive focus-ring rounded-sm">QR Sessions</Link></li>
                  <li><Link href="#telegram" className="hover:text-[var(--text-primary)] transition-interactive focus-ring rounded-sm">Telegram Bot</Link></li>
                </ul>
              </div>

              <div className="col-span-1 md:col-span-3">
                <h4 className="font-bold mb-[var(--space-4)] text-[var(--text-sm)] text-[var(--text-primary)]">Company</h4>
                <ul className="space-y-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-secondary)] flex flex-col items-start">
                  <li><button onClick={() => openModal('about')} className="hover:text-[var(--text-primary)] transition-interactive focus-ring rounded-sm">About Us</button></li>
                  <li><Link href="#pricing" className="hover:text-[var(--text-primary)] transition-interactive focus-ring rounded-sm">Pricing</Link></li>
                  <li><button onClick={() => openModal('contact')} className="hover:text-[var(--text-primary)] transition-interactive focus-ring rounded-sm">Contact</button></li>
                </ul>
              </div>

              <div className="col-span-2 md:col-span-3">
                <h4 className="font-bold mb-[var(--space-4)] text-[var(--text-sm)] text-[var(--text-primary)]">Legal & Resources</h4>
                <ul className="space-y-[var(--space-3)] text-[var(--text-sm)] text-[var(--text-secondary)] flex flex-col items-start">
                  <li><button onClick={() => openModal('docs')} className="hover:text-[var(--text-primary)] transition-interactive focus-ring rounded-sm">Documentation</button></li>
                  <li><button onClick={() => openModal('privacy')} className="hover:text-[var(--text-primary)] transition-interactive focus-ring rounded-sm">Privacy Policy</button></li>
                  <li><button onClick={() => openModal('terms')} className="hover:text-[var(--text-primary)] transition-interactive focus-ring rounded-sm">Terms of Service</button></li>
                </ul>
              </div>
           </div>
           
           <div className="mt-[var(--space-16)] pt-[var(--space-8)] border-t border-[var(--border-hairline)] flex flex-col md:flex-row items-center justify-between text-[var(--text-xs)] text-[var(--text-muted)]">
             <p>© {new Date().getFullYear()} QControl. All rights reserved.</p>
             <p className="mt-[var(--space-2)] md:mt-0">Engineered for precision.</p>
           </div>
         </Container>
      </footer>

      <Modal isOpen={!!modalContent} onClose={() => setModalContent(null)} title={modalContent?.title}>
        {modalContent && (
          <div className="flex flex-col gap-[var(--space-6)]">
            <div>{modalContent.content}</div>
          </div>
        )}
      </Modal>
    </div>
  );
}
