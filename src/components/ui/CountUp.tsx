"use client";
import { useEffect, useState, useRef } from 'react';

export default function CountUp({ end, duration = 2000, suffix = '', prefix = '' }: { end: number, duration?: number, suffix?: string, prefix?: string }) {
  const [count, setCount] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return end;
    }
    return 0;
  });
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (count === end) return;
    
    let startTime: number | null = null;
    let animationFrame: number;
    let observer: IntersectionObserver;
    const currentRef = ref.current;

    const startAnimation = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeProgress * end));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(startAnimation);
      } else {
        setCount(end);
      }
    };

    observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        startTime = null;
        animationFrame = requestAnimationFrame(startAnimation);
      } else {
        cancelAnimationFrame(animationFrame);
        setCount(0);
      }
    }, { threshold: 0.1 });

    if (currentRef) observer.observe(currentRef);

    return () => {
      cancelAnimationFrame(animationFrame);
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [end, duration]);

  return <span ref={ref} className="font-mono tabular-nums">{prefix}{count}{suffix}</span>;
}
