'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './ui/Primitives';

export default function MouseGlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    // Disable on mobile/touch devices or if reduced motion is preferred
    const isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 0;
    if (prefersReducedMotion || isMobile) {
      setTimeout(() => setIsActive(false), 0);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    interface Ball {
      x: number; y: number; vx: number; vy: number; radius: number; color: string; birth: number; impact: number;
    }
    let balls: Ball[] = [];
    const maxBalls = 8;
    const colors = ['#166534', '#b59654', '#ffffff', '#60a5fa', '#ef4444'];
    
    let mouse = { x: -1000, y: -1000, vx: 0, vy: 0 };
    let lastMouse = { x: -1000, y: -1000 };
    let lastTime = performance.now();
    let animationFrame: number;
    let isVisible = true;

    // Intersection Observer to pause when offscreen
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    });
    observer.observe(document.body);

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.vx = mouse.x - lastMouse.x;
      mouse.vy = mouse.y - lastMouse.y;
      
      const speed = Math.sqrt(mouse.vx**2 + mouse.vy**2);
      if (speed > 20 && balls.length < maxBalls && Math.random() > 0.5) {
        // Spawn ball
        balls.push({
          x: mouse.x, y: mouse.y,
          vx: (mouse.vx / speed) * (Math.random() * 5 + 5),
          vy: (mouse.vy / speed) * (Math.random() * 5 + 5),
          radius: Math.random() * 6 + 8,
          color: colors[Math.floor(Math.random() * colors.length)],
          birth: performance.now(),
          impact: 0
        });
      }
      lastMouse.x = mouse.x;
      lastMouse.y = mouse.y;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize, { passive: true });

    const update = (time: number) => {
      if (!isVisible) {
        animationFrame = requestAnimationFrame(update);
        return;
      }
      
      const dt = Math.min((time - lastTime) / 16, 2); // cap dt
      lastTime = time;
      
      ctx.clearRect(0, 0, width, height);
      
      // Draw ambient mouse glow
      if (mouse.x > -100) {
         const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 100);
         g.addColorStop(0, 'rgba(22, 101, 52, 0.15)');
         g.addColorStop(1, 'rgba(22, 101, 52, 0)');
         ctx.fillStyle = g;
         ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 100, 0, Math.PI*2); ctx.fill();
      }

      // Update & Draw balls
      for (let i = balls.length - 1; i >= 0; i--) {
        let b = balls[i];
        
        // Apply friction
        b.vx *= 0.98;
        b.vy *= 0.98;
        
        // Mouse collision
        const dx = b.x - mouse.x;
        const dy = b.y - mouse.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 40 + b.radius) {
          const nx = dx / dist;
          const ny = dy / dist;
          b.vx += nx * 2;
          b.vy += ny * 2;
          b.impact = 1;
        }

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Screen bounds
        if (b.x < b.radius) { b.x = b.radius; b.vx *= -0.8; b.impact = 1; }
        if (b.x > width - b.radius) { b.x = width - b.radius; b.vx *= -0.8; b.impact = 1; }
        if (b.y < b.radius) { b.y = b.radius; b.vy *= -0.8; b.impact = 1; }
        if (b.y > height - b.radius) { b.y = height - b.radius; b.vy *= -0.8; b.impact = 1; }

        // Remove old or stopped balls
        const age = time - b.birth;
        if (age > 4000 || (age > 1000 && Math.abs(b.vx) < 0.1 && Math.abs(b.vy) < 0.1)) {
          balls.splice(i, 1);
          continue;
        }

        // Draw
        b.impact = Math.max(0, b.impact - 0.1);
        const opacity = Math.min(1, (4000 - age) / 1000);
        
        ctx.save();
        ctx.globalAlpha = opacity;
        
        // Shadow
        ctx.beginPath(); ctx.arc(b.x + 2, b.y + 4, b.radius, 0, Math.PI*2);
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
        
        // Ball
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI*2);
        ctx.fillStyle = b.color; ctx.fill();
        
        // Highlight
        if (b.radius > 6) {
          ctx.beginPath(); ctx.arc(b.x - b.radius*0.3, b.y - b.radius*0.3, b.radius*0.2, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
        }
        
        ctx.restore();
      }

      animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [prefersReducedMotion]);

  if (!isActive) return null;

  return (
    <canvas 
      ref={canvasRef} 
      className="pointer-events-none fixed inset-0 z-0 w-full h-full opacity-60"
      aria-hidden="true"
    />
  );
}
