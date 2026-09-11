"use client";

import { useEffect, useRef, useState } from 'react';

type AnimationType = 'fade-up' | 'fade-in' | 'scale' | 'slide-left' | 'slide-right';

interface ScrollRevealProps {
  children: React.ReactNode;
  animation?: AnimationType;
  delay?: number;
  duration?: number;
  className?: string;
  threshold?: number;
}

export default function ScrollReveal({
  children,
  animation = 'fade-up',
  delay = 0,
  duration = 700,
  className = '',
  threshold = 0.1,
}: ScrollRevealProps) {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      },
      {
        root: null,
        rootMargin: '50px',
        threshold,
      }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold]);

  const baseClasses = `transition-all motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:transform-none ${className}`;
  
  let animationClasses = '';
  
  if (!isVisible) {
    switch (animation) {
      case 'fade-up':
        animationClasses = 'opacity-0 translate-y-8';
        break;
      case 'fade-in':
        animationClasses = 'opacity-0';
        break;
      case 'scale':
        animationClasses = 'opacity-0 scale-95';
        break;
      case 'slide-left':
        animationClasses = 'opacity-0 -translate-x-8';
        break;
      case 'slide-right':
        animationClasses = 'opacity-0 translate-x-8';
        break;
    }
  } else {
    animationClasses = 'opacity-100 translate-y-0 translate-x-0 scale-100';
  }

  return (
    <div
      ref={ref}
      className={`${baseClasses} ${animationClasses}`}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {children}
    </div>
  );
}
