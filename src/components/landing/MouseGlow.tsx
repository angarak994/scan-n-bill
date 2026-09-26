'use client';

import React, { useEffect, useRef, useState } from 'react';

export default function MouseGlow() {
  const glowRef = useRef<HTMLDivElement>(null);
  const targetPos = useRef({ x: 0, y: 0 });
  const currentPos = useRef({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check for reduced motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    let animationFrameId: number;
    let isMoving = false;
    let stopTimeout: NodeJS.Timeout;

    const onMouseMove = (e: MouseEvent) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
      setIsVisible(true);
      isMoving = true;
      
      clearTimeout(stopTimeout);
      stopTimeout = setTimeout(() => {
        isMoving = false;
        // Fade out slightly when stopped, or keep a subtle presence
      }, 500);
    };

    const update = () => {
      // Smooth interpolation (lerp)
      currentPos.current.x += (targetPos.current.x - currentPos.current.x) * 0.15;
      currentPos.current.y += (targetPos.current.y - currentPos.current.y) * 0.15;

      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${currentPos.current.x}px, ${currentPos.current.y}px)`;
        
        // Slightly dim when not moving
        if (isMoving) {
          glowRef.current.style.opacity = '1';
          glowRef.current.style.transform += ' scale(1)';
        } else {
          glowRef.current.style.opacity = '0.5';
          glowRef.current.style.transform += ' scale(0.9)';
        }
      }

      animationFrameId = requestAnimationFrame(update);
    };

    window.addEventListener('mousemove', onMouseMove);
    animationFrameId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animationFrameId);
      clearTimeout(stopTimeout);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div 
        ref={glowRef}
        className="absolute left-0 top-0 -ml-[300px] -mt-[300px] w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
          opacity: 0.15,
          mixBlendMode: 'screen', // Adjust based on light/dark mode if needed
          transition: 'opacity 0.5s ease, transform 0.1s linear', // smooth scale transition
          willChange: 'transform, opacity'
        }}
      />
    </div>
  );
}
