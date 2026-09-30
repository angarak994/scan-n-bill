'use client';

import React, { useRef, useEffect } from 'react';
import { useDemoStore } from '../store/DemoProvider';
import { Section, Container, H2, Card } from '../ui/Primitives';

export default function TelegramDemo() {
  const { state, dispatch } = useDemoStore();
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.telegramLog]);

  const handleStartT2 = () => {
    if (state.tables.find(t => t.id === 'T2')?.status !== 'AVAILABLE') return;
    
    // User message
    dispatch({ type: 'ADD_TELEGRAM_MSG', payload: { sender: 'user', text: 'Start T2' } });
    
    // Bot response and state change after 500ms
    setTimeout(() => {
      dispatch({ type: 'START_TABLE', payload: { id: 'T2', player: 'Walk-in (Telegram)' } });
      dispatch({ 
        type: 'ADD_TELEGRAM_MSG', 
        payload: { 
          sender: 'bot', 
          text: (
            <>
              ✅ <b>Table 02</b> started successfully.<br/>
              Game: Snooker<br/>
              Rate: ₹250/hr
            </>
          ) 
        } 
      });
    }, 500);
  };

  const handleStopT2 = () => {
    if (state.tables.find(t => t.id === 'T2')?.status === 'AVAILABLE') return;
    
    dispatch({ type: 'ADD_TELEGRAM_MSG', payload: { sender: 'user', text: 'Stop T2' } });
    
    setTimeout(() => {
      dispatch({ type: 'STOP_TABLE', payload: { id: 'T2' } });
      dispatch({ 
        type: 'ADD_TELEGRAM_MSG', 
        payload: { 
          sender: 'bot', 
          text: (
            <>
              🛑 <b>Table 02</b> stopped.<br/>
              Total Bill: ₹250 (minimum charge applied)
            </>
          ) 
        } 
      });
    }, 500);
  };

  const isT2Available = state.tables.find(t => t.id === 'T2')?.status === 'AVAILABLE';

  return (
    <Section id="telegram" className="bg-[var(--bg-base)]">
      <Container>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-[var(--space-12)] items-center">
          <div className="order-2 lg:order-1 lg:col-span-6 relative flex justify-center">
            {/* Phone Mockup */}
            <div className="relative w-[300px] h-[600px] border-[8px] border-black bg-black rounded-[40px] shadow-[var(--shadow-lg)] overflow-hidden flex flex-col ring-1 ring-[var(--border-strong)] transform transition-transform duration-500 hover:-translate-y-2">
               {/* Header */}
               <div className="h-16 bg-[#1c242d] flex items-center px-4 gap-3 border-b border-white/5 shrink-0 z-10">
                 <div className="w-10 h-10 rounded-full bg-[var(--info)] flex items-center justify-center text-white font-bold text-[var(--text-sm)]">QC</div>
                 <div>
                   <div className="text-white font-bold text-[15px] leading-tight">QControl Bot</div>
                   <div className="text-[var(--info)] text-[13px] leading-tight">bot</div>
                 </div>
               </div>
               
               {/* Chat Area */}
               <div className="flex-1 bg-[#0e1621] p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar relative z-0">
                  {state.telegramLog.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`p-2.5 rounded-2xl max-w-[85%] text-[15px] leading-snug shadow-sm ${msg.sender === 'user' ? 'bg-[#2b5278] text-white rounded-tr-sm' : 'bg-[#182533] text-white rounded-tl-sm border border-white/5'}`}>
                        {msg.text}
                        <div className={`text-[11px] mt-1 text-right ${msg.sender === 'user' ? 'text-blue-200' : 'text-[#688aab]'}`}>
                          {msg.time}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Interactive Inline Keyboard (Simulated) */}
                  <div className="flex flex-col items-start animate-in fade-in duration-300">
                    <div className="bg-[#182533] text-white p-2.5 rounded-2xl rounded-tl-sm w-[85%] text-[15px] border border-white/5 shadow-sm">
                      <div className="font-bold mb-2 text-sm text-[#8eb0cc]">Interactive Demo</div>
                      <div className="grid grid-cols-1 gap-2 mt-2">
                        {isT2Available ? (
                          <button 
                            onClick={handleStartT2}
                            className="bg-[#202b36] hover:bg-[#2a3947] border border-white/5 py-2.5 rounded-[var(--radius-sm)] text-center text-[var(--info)] font-bold text-[14px] transition-interactive focus-ring"
                          >
                            Start Table 02
                          </button>
                        ) : (
                          <button 
                            onClick={handleStopT2}
                            className="bg-[#202b36] hover:bg-[#2a3947] border border-white/5 py-2.5 rounded-[var(--radius-sm)] text-center text-[var(--danger)] font-bold text-[14px] transition-interactive focus-ring"
                          >
                            Stop Table 02
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div ref={chatEndRef} />
               </div>
               
               {/* Input Bar */}
               <div className="h-14 bg-[#1c242d] border-t border-white/5 flex items-center px-4 gap-3 shrink-0 text-text-muted text-[15px]">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  <div className="flex-1 text-[#688aab]">Message...</div>
                  <div className="w-8 h-8 rounded-full bg-[#2b5278] flex items-center justify-center text-white">
                    <svg className="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                  </div>
               </div>
            </div>
          </div>

          <div className="order-1 lg:order-2 lg:col-span-6 flex flex-col items-start pt-[var(--space-8)]">
            <H2 className="mb-[var(--space-6)]">
              Your club in your pocket.
            </H2>
            <p className="text-[var(--text-lg)] text-[var(--text-secondary)] leading-[1.6] mb-[var(--space-8)] text-balance">
              Don't be tied to the reception desk. Manage everything directly from Telegram. Start tables, pause sessions, check live availability, and close out bills while walking around the floor.
            </p>
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-[var(--radius-md)] p-[var(--space-4)] inline-flex items-start gap-[var(--space-4)]">
              <div className="w-8 h-8 rounded-[var(--radius-full)] bg-[var(--info)]/10 text-[var(--info)] flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-[var(--text-sm)] text-[var(--text-secondary)]">
                <strong>Try it out:</strong> Click the "Start Table 02" button in the phone mockup. Watch it update the Hero dashboard live.
              </p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
