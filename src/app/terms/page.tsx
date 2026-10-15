import React from 'react';
import Navbar from '@/components/landing/Navbar';

export const metadata = {
  title: 'Terms and Conditions | QControl',
  description: 'Terms and Conditions for QControl services.'
};

export default function TermsConditions() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg-primary text-text-primary pt-12 pb-24 px-4 bg-grid-pattern">
        <div className="max-w-4xl mx-auto glass-panel p-8 sm:p-12 rounded-3xl border border-border-theme bg-bg-surface relative z-10">
          <h1 className="text-3xl sm:text-4xl font-black mb-8">Terms and Conditions</h1>
          <p suppressHydrationWarning className="text-text-secondary mb-8">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <div className="space-y-8 text-text-secondary leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">1. Acceptance of Terms</h2>
              <p>By accessing and using QControl's software, website, or services, you agree to comply with and be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">2. Description of Service</h2>
              <p>QControl provides a cloud-based management platform for gaming clubs, including pool, snooker, and console cafes. The service includes table tracking, billing automation, reservations, and analytics.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">3. User Responsibilities</h2>
              <p>You are responsible for:</p>
              <ul className="list-disc pl-5 mt-2 space-y-2">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>Ensuring all activities under your account comply with local laws</li>
                <li>Providing accurate and current billing information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">4. Payment and Subscriptions</h2>
              <p>Services are billed on a subscription basis. You will be billed in advance on a recurring schedule. Subscriptions can be cancelled at any time, but we do not provide refunds for partial months of service. Our 14-day free trial does not require a credit card and will not automatically charge you upon completion unless you explicitly provide payment details and subscribe.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">5. Limitation of Liability</h2>
              <p>QControl shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service, including but not limited to loss of revenue or data.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">6. Changes to Terms</h2>
              <p>We reserve the right to modify these terms at any time. We will provide notice of significant changes. Your continued use of the service following any changes constitutes acceptance of those changes.</p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
