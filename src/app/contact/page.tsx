'use client';
import React, { useState } from 'react';
import Navbar from '@/components/landing/Navbar';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    businessName: '',
    phone: '',
    tables: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: null, message: '' });

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({ type: 'success', message: data.message });
        setFormData({ name: '', email: '', businessName: '', phone: '', tables: '', message: '' });
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to submit.' });
      }
    } catch (error) {
      setStatus({ type: 'error', message: 'An unexpected error occurred. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg-primary text-text-primary bg-grid-pattern pt-12 pb-24 px-4">
        <div className="max-w-3xl mx-auto glass-panel p-8 sm:p-12 rounded-3xl border border-border shadow-2xl bg-bg-surface relative z-10">
          <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">Talk to Sales</h1>
            <p className="text-text-secondary text-lg">Tell us about your business and we'll help you find the best solution.</p>
          </div>

          {status.type === 'success' ? (
            <div className="bg-accent/10 border border-accent/20 rounded-xl p-8 text-center animate-in fade-in zoom-in">
              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Message Sent Successfully!</h2>
              <p className="text-text-secondary">{status.message}</p>
              <button onClick={() => setStatus({ type: null, message: '' })} className="mt-6 px-6 py-2 border border-border rounded-lg hover:bg-bg-card transition-colors">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {status.type === 'error' && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg text-sm font-medium">
                  {status.message}
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-bold text-text-secondary block">Full Name *</label>
                  <input type="text" id="name" name="name" required value={formData.name} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all" placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-bold text-text-secondary block">Business Email *</label>
                  <input type="email" id="email" name="email" required value={formData.email} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all" placeholder="john@club.com" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="businessName" className="text-sm font-bold text-text-secondary block">Business Name *</label>
                  <input type="text" id="businessName" name="businessName" required value={formData.businessName} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all" placeholder="Corner Pocket Club" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-bold text-text-secondary block">Phone Number *</label>
                  <input type="tel" id="phone" name="phone" required value={formData.phone} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all" placeholder="+91 98765 43210" />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="tables" className="text-sm font-bold text-text-secondary block">Number of Tables/Consoles</label>
                <select id="tables" name="tables" value={formData.tables} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all">
                  <option value="">Select an option</option>
                  <option value="1-4">1 to 4</option>
                  <option value="5-9">5 to 9</option>
                  <option value="10-19">10 to 19</option>
                  <option value="20+">20+</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-bold text-text-secondary block">How can we help you?</label>
                <textarea id="message" name="message" rows={4} value={formData.message} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-border bg-bg-card text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all resize-y" placeholder="Tell us about your specific requirements..."></textarea>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full px-8 py-4 bg-accent text-white font-bold rounded-xl text-lg hover:bg-accent/90 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-70 flex items-center justify-center gap-2">
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : 'Submit Inquiry'}
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
