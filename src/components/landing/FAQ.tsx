"use client";

import { useState } from 'react';
import ScrollReveal from '@/components/ui/ScrollReveal';

export default function FAQ() {
  const faqs = [
    {
      question: 'What is Qcontrol?',
      answer: 'Qcontrol is an all-in-one platform built specifically for gaming and billiards venues. It handles table timers, bookings, QKhata (digital ledgers), food ordering, and analytics in one unified dashboard.'
    },
    {
      question: 'Who is this for?',
      answer: 'It is designed for owners of billiards clubs, snooker halls, pool rooms, gaming lounges (PS5, PC), and multi-activity entertainment venues.'
    },
    {
      question: 'How do the QR Smart Timers work?',
      answer: 'Customers scan a QR code at their table to start their session. The timer begins immediately on their phone and on your dashboard. When they are done, the exact duration and cost are calculated automatically.'
    },
    {
      question: 'Can I manage multiple tables or consoles?',
      answer: 'Yes, Qcontrol scales from a single table up to large multi-location franchises. The Professional and Enterprise plans support unlimited tables and consoles.'
    },
    {
      question: 'How does the digital QKhata work?',
      answer: 'The digital QKhata replaces paper ledgers. When a customer ends a session without paying immediately, you can add the balance to their profile. You can track total outstanding dues and send automated payment reminders.'
    },
    {
      question: 'How does the WhatsApp/Telegram integration work?',
      answer: 'Customers can message your venue\'s WhatsApp or Telegram bot to check table availability, make bookings, or view their QKhata balance. All interactions sync directly with your main dashboard.'
    },
    {
      question: 'Do I need to buy special hardware?',
      answer: 'No. Qcontrol is entirely cloud-based. You can run the dashboard on any laptop, tablet, or smartphone. The only physical items you need are the printed QR codes for your tables.'
    }
  ];

  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section className="w-full max-w-4xl mx-auto px-4 sm:px-8 py-16 sm:py-24" itemScope itemType="https://schema.org/FAQPage">
      <ScrollReveal animation="fade-up" delay={0}>
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-text-secondary text-lg">
            Everything you need to know about switching to Qcontrol.
          </p>
        </div>
      </ScrollReveal>

      <div className="max-w-3xl mx-auto space-y-4">
        {faqs.map((faq, idx) => (
          <ScrollReveal key={idx} animation="fade-up" delay={idx * 100}>
            <div 
              className="bg-bg-surface border border-border-light rounded-xl overflow-hidden transition-all duration-300"
              itemScope itemProp="mainEntity" itemType="https://schema.org/Question"
            >
              <button 
                className="w-full text-left px-6 py-5 flex justify-between items-center focus:outline-none"
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              >
                <span className="font-bold text-lg text-text-primary" itemProp="name">{faq.question}</span>
                <svg 
                  className={`w-5 h-5 text-text-secondary transition-transform duration-300 ${openIdx === idx ? 'rotate-180' : ''}`} 
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div 
                className={`px-6 overflow-hidden transition-all duration-300 ${openIdx === idx ? 'max-h-96 pb-5 opacity-100' : 'max-h-0 opacity-0'}`}
                itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer"
              >
                <p className="text-text-secondary leading-relaxed" itemProp="text">{faq.answer}</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
