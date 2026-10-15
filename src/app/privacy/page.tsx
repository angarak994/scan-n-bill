import React from 'react';
import Navbar from '@/components/landing/Navbar';

export const metadata = {
  title: 'Privacy Policy | QControl',
  description: 'Privacy Policy for QControl services.'
};

export default function PrivacyPolicy() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg-primary text-text-primary pt-12 pb-24 px-4 bg-grid-pattern">
        <div className="max-w-4xl mx-auto glass-panel p-8 sm:p-12 rounded-3xl border border-border-theme bg-bg-surface relative z-10">
          <h1 className="text-3xl sm:text-4xl font-black mb-8">Privacy Policy</h1>
          <p suppressHydrationWarning className="text-text-secondary mb-8">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <div className="space-y-8 text-text-secondary leading-relaxed">
            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">1. Introduction</h2>
              <p>Welcome to QControl. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and share information about you when you use our services.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">2. Information We Collect</h2>
              <p>We collect information you provide directly to us, such as when you create an account, register a business, or contact support. This includes:</p>
              <ul className="list-disc pl-5 mt-2 space-y-2">
                <li>Name, email address, and contact number</li>
                <li>Business name, location, and operational data</li>
                <li>Payment and transaction history</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">3. How We Use Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-5 mt-2 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process transactions and send related information</li>
                <li>Send technical notices, updates, security alerts, and support messages</li>
                <li>Respond to your comments, questions, and customer service requests</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">4. Data Security</h2>
              <p>We implement appropriate technical and organizational measures to maintain the security of your personal information, including encryption of data in transit and at rest. However, no security system is impenetrable, and we cannot guarantee the security of our systems 100%.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">5. Third-Party Services</h2>
              <p>We may share your information with third-party vendors, consultants, and other service providers who need access to such information to carry out work on our behalf, such as payment processing (e.g., Razorpay) and notifications (e.g., Telegram, WhatsApp).</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-text-primary mb-4">6. Contact Us</h2>
              <p>If you have any questions about this Privacy Policy, please contact us at support@qcontrol.com.</p>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
