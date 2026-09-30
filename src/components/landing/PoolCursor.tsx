'use client';
import React, { useEffect, useRef } from 'react';

export default function PoolCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Disable on reduced motion or touch devices
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    
    if (prefersReducedMotion || isTouchDevice) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    let mouseX = width / 2;
    let mouseY = height / 2;
    let isActive = true;
    let animationFrameId: number;

    const balls = [
      { x: width/2, y: height/2, vx: 0, vy: 0, radius: 6, color: '#f8fafc' }, // cue ball
      { x: width/3, y: height/3, vx: 0, vy: 0, radius: 6, color: '#10b981' },
      { x: width/3 * 2, y: height/3 * 2, vx: 0, vy: 0, radius: 6, color: '#0088cc' },
      { x: width/4, y: height/4 * 3, vx: 0, vy: 0, radius: 6, color: '#ef4444' },
      { x: width/4 * 3, y: height/4, vx: 0, vy: 0, radius: 6, color: '#eab308' },
    ];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };

    const mouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', mouseMove);

    document.addEventListener('visibilitychange', () => {
      isActive = document.visibilityState === 'visible';
    });

    const updateAndDraw = () => {
      if (!isActive) {
        animationFrameId = requestAnimationFrame(updateAndDraw);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Mouse influence on cue ball (spring towards mouse but with inertia)
      const cue = balls[0];
      const dx = mouseX - cue.x;
      const dy = mouseY - cue.y;
      
      cue.vx += dx * 0.02;
      cue.vy += dy * 0.02;

      // Friction
      for (let b of balls) {
        b.vx *= 0.92;
        b.vy *= 0.92;
        b.x += b.vx;
        b.y += b.vy;

        // Wall collisions
        if (b.x < b.radius) { b.x = b.radius; b.vx *= -0.8; }
        if (b.x > width - b.radius) { b.x = width - b.radius; b.vx *= -0.8; }
        if (b.y < b.radius) { b.y = b.radius; b.vy *= -0.8; }
        if (b.y > height - b.radius) { b.y = height - b.radius; b.vy *= -0.8; }
      }

      // Ball collisions
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const b1 = balls[i];
          const b2 = balls[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const minDist = b1.radius + b2.radius;
          
          if (dist < minDist && dist > 0) {
            const angle = Math.atan2(dy, dx);
            const targetX = b1.x + Math.cos(angle) * minDist;
            const targetY = b1.y + Math.sin(angle) * minDist;
            const ax = (targetX - b2.x) * 0.1;
            const ay = (targetY - b2.y) * 0.1;
            
            b1.vx -= ax;
            b1.vy -= ay;
            b2.vx += ax;
            b2.vy += ay;
          }
        }
      }

      // Draw shadows and balls
      for (let b of balls) {
        // Shadow
        ctx.beginPath();
        ctx.arc(b.x + 2, b.y + 4, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();

        // Ball
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        
        // Highlight (3d effect)
        ctx.beginPath();
        ctx.arc(b.x - 2, b.y - 2, b.radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(updateAndDraw);
    };

    updateAndDraw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', mouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-0 mix-blend-screen opacity-30"
    />
  );
}
