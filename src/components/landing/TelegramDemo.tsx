'use client';
import React from 'react';
import ScrollReveal from '@/components/ui/ScrollReveal';
import { useDemoEngine } from '@/components/landing/store/DemoEngine';

export default function TelegramDemo() {
  const { state, startTable, pauseTable, stopTable, addTelegramMsg } = useDemoEngine();

  const handleCommand = (cmd: string) => {
    addTelegramMsg('user', cmd);
    setTimeout(() => {
      if (cmd.includes('/start')) {
        startTable('T2', 'Telegram Bot');
        addTelegramMsg('bot', 'Table 2 started successfully. Rate: ₹250/hr.');
      } else if (cmd.includes('/pause')) {
        pauseTable('T1');
        addTelegramMsg('bot', 'Table 1 paused.');
      } else if (cmd.includes('/stop')) {
        stopTable('T1');
        addTelegramMsg('bot', 'Table 1 stopped. Final bill added to dashboard.');
      } else {
        addTelegramMsg('bot', 'Unknown command. Try /start T2 or /pause T1');
      }
    }, 600);
  };

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-16 sm:py-24 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <ScrollReveal animation="slide-right" delay={0} className="order-2 lg:order-1">
          <span className="text-accent font-bold text-sm tracking-wider uppercase mb-3 block">Telegram Integration</span>
          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight mb-6">
            Control your club from chat.
          </h2>
          <p className="text-text-secondary text-lg leading-relaxed mb-8">
            Manage tables, track availability, and receive instant notifications without ever opening the dashboard. Our Telegram bot gives you full operational control directly from your messaging app.
          </p>
          
          <div className="flex flex-wrap gap-3">
            <button onClick={() => handleCommand('/start T2')} className="px-4 py-2 bg-bg-surface border border-border-theme hover:border-accent/50 hover:bg-bg-card rounded-lg text-sm font-mono transition-colors">/start T2</button>
            <button onClick={() => handleCommand('/pause T1')} className="px-4 py-2 bg-bg-surface border border-border-theme hover:border-accent/50 hover:bg-bg-card rounded-lg text-sm font-mono transition-colors">/pause T1</button>
            <button onClick={() => handleCommand('/stop T1')} className="px-4 py-2 bg-bg-surface border border-border-theme hover:border-accent/50 hover:bg-bg-card rounded-lg text-sm font-mono transition-colors">/stop T1</button>
          </div>
        </ScrollReveal>

        <div className="order-1 lg:order-2 relative">
          <ScrollReveal animation="fade-up" delay={200}>
            <div className="relative w-full max-w-sm mx-auto rounded-xl shadow-2xl overflow-hidden flex flex-col h-[500px] glass-panel">
              {/* Phone Header */}
              <div className="w-full h-16 bg-bg-card border-b border-border-light flex items-center px-4 gap-4">
                <div className="w-10 h-10 rounded-full bg-[#0088cc]/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[#0088cc]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                </div>
                <div>
                  <div className="font-bold text-sm">QControl Bot</div>
                  <div className="text-xs text-[#0088cc]">bot</div>
                </div>
              </div>
              
              {/* Chat Area */}
              <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\' fill-rule=\'evenodd\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'3\'/%3E%3Ccircle cx=\'13\' cy=\'13\' r=\'3\'/%3E%3C/g%3E%3C/svg%3E")'}}>
                {state.telegramLog.map(msg => (
                  <div key={msg.id} className={`flex flex-col max-w-[85%] animate-entrance ${msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                    <div className={`p-3 rounded-2xl ${msg.sender === 'user' ? 'bg-[#0088cc] text-white rounded-tr-none' : 'bg-bg-card border border-border-light rounded-tl-none text-text-primary'}`}>
                      <div className="text-sm font-medium">{msg.text}</div>
                    </div>
                    <span className="text-[10px] text-text-disabled mt-1 px-1 tracking-wider">
                      {new Date(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
