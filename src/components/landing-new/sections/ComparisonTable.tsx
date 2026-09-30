'use client';

import React from 'react';
import { Section, Container, H2, Card } from '../ui/Primitives';

const rows = [
  { feature: 'Live Table Tracking', manual: 'Whiteboard', pos: 'Depends', qc: 'Real-time Dashboard' },
  { feature: 'Time-Based Billing', manual: 'Mental Math', pos: 'Manual Entry', qc: 'Automated by Minute' },
  { feature: 'Time-Aware Promotions', manual: 'Error Prone', pos: 'No', qc: 'Automated Splits' },
  { feature: 'Remote Owner Control', manual: 'No', pos: 'Depends', qc: 'Telegram Bot' },
  { feature: 'Customer QR Flow', manual: 'No', pos: 'Depends', qc: 'Yes (No App Req)' },
  { feature: 'F&B Integration', manual: 'Paper Checks', pos: 'Yes', qc: 'Yes (Added to Bill)' },
  { feature: 'Digital Store Credit', manual: 'Logbook', pos: 'Depends', qc: 'QKhata Wallet' }
];

export default function ComparisonTable() {
  return (
    <Section className="bg-[var(--bg-base)]">
      <Container>
        <div className="flex flex-col items-start mb-[var(--space-12)]">
          <H2 className="mb-[var(--space-6)]">
            Compare the alternatives.
          </H2>
          <p className="text-[var(--text-lg)] text-[var(--text-secondary)] max-w-2xl text-balance">
            See how QControl measures up against manual operations and generic restaurant POS systems.
          </p>
        </div>

        <Card elevated className="p-0 overflow-hidden border-[var(--border-strong)]">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[var(--bg-surface)] border-b border-[var(--border-strong)] text-[var(--text-sm)]">
                  <th className="p-[var(--space-4)] sm:p-[var(--space-6)] font-bold text-[var(--text-primary)] w-1/3">Capability</th>
                  <th className="p-[var(--space-4)] sm:p-[var(--space-6)] font-bold text-[var(--text-muted)]">Manual Operations</th>
                  <th className="p-[var(--space-4)] sm:p-[var(--space-6)] font-bold text-[var(--text-secondary)]">Generic POS</th>
                  <th className="p-[var(--space-4)] sm:p-[var(--space-6)] font-bold text-[var(--accent)] bg-[var(--accent)]/10">QControl</th>
                </tr>
              </thead>
              <tbody className="text-[var(--text-sm)]">
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-[var(--border-hairline)] hover:bg-[var(--bg-surface)] transition-interactive">
                    <td className="p-[var(--space-4)] sm:p-[var(--space-6)] font-bold text-[var(--text-primary)]">{row.feature}</td>
                    <td className="p-[var(--space-4)] sm:p-[var(--space-6)] text-[var(--text-muted)]">{row.manual}</td>
                    <td className="p-[var(--space-4)] sm:p-[var(--space-6)] text-[var(--text-secondary)]">{row.pos}</td>
                    <td className="p-[var(--space-4)] sm:p-[var(--space-6)] font-bold text-[var(--accent)] bg-[var(--accent)]/5">{row.qc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        
        <p className="text-[var(--text-xs)] text-[var(--text-muted)] mt-[var(--space-4)]">
          *Comparison reflects typical setups; capabilities vary between POS vendors.
        </p>
      </Container>
    </Section>
  );
}
