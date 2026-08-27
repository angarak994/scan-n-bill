'use client';

import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

interface WelcomeCelebrationProps {
  ownerName: string;
  onComplete: () => void;
}

export default function WelcomeCelebration({ ownerName, onComplete }: WelcomeCelebrationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    // Smooth entrance
    const enterTimer = setTimeout(() => {
      setIsVisible(true);
      triggerConfetti();
    }, 150);

    // Progress bar animation (2.5 seconds total visible time)
    const DISPLAY_DURATION = 2500;
    const startTime = Date.now() + 150;
    
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / DISPLAY_DURATION) * 100);
      setProgress(remaining);
      
      if (elapsed >= DISPLAY_DURATION) {
        clearInterval(progressInterval);
        handleClose();
      }
    }, 16); // 60fps update

    return () => {
      clearTimeout(enterTimer);
      clearInterval(progressInterval);
    };
  }, []);

  const triggerConfetti = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const duration = 2000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);

      const particleCount = 40 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#8dd5b6', '#212121', '#ffffff']
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#8dd5b6', '#f0a500', '#ffffff']
      });
    }, 250);
  };

  const handleClose = async () => {
    setIsClosing(true);
    
    try {
      await fetch('/api/mark-logged-in', { method: 'POST' });
    } catch (err) {
      console.error('Failed to mark as logged in', err);
    }
    
    setTimeout(() => {
      onComplete();
    }, 400); // Wait for exit animation
  };

  return (
    <div className={`fixed inset-0 z-[9990] flex items-center justify-center p-4 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${isVisible && !isClosing ? 'bg-black/40 backdrop-blur-md' : 'bg-transparent pointer-events-none'}`}>
      <div 
        className={`relative overflow-hidden bg-bg-surface w-full max-w-sm rounded-[24px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-border-theme/30 p-8 text-center transform transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isVisible && !isClosing 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-12 scale-90'
        }`}
      >
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-accent/30 to-accent/5 rounded-2xl flex items-center justify-center mb-6 shadow-[inset_0_0_20px_rgba(141,213,182,0.2)] border border-accent/20 rotate-3">
          <span className="text-3xl transform -rotate-3 hover:scale-110 transition-transform origin-bottom-right">👋</span>
        </div>
        
        <h2 className="text-2xl font-black text-text-primary tracking-tight mb-2">
          Welcome, {ownerName.split(' ')[0]}!
        </h2>
        
        <p className="text-text-secondary text-sm leading-relaxed">
          Your Qcontrol dashboard is ready. Setting everything up for you...
        </p>

        {/* Progress Bar Container */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-border-theme/50">
          <div 
            className="h-full bg-accent transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
