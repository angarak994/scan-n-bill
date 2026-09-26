'use client';

import React, { useEffect, useRef, useState } from 'react';
import Matter from 'matter-js';

export default function MouseGlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    // Check constraints
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isMobile = window.innerWidth < 768 || navigator.maxTouchPoints > 0;
    
    if (mediaQuery.matches || isMobile) {
      setIsActive(false);
      return;
    }

    const Engine = Matter.Engine,
          Render = Matter.Render,
          Runner = Matter.Runner,
          Bodies = Matter.Bodies,
          Composite = Matter.Composite,
          Body = Matter.Body,
          Events = Matter.Events,
          Vector = Matter.Vector;

    // Top-down view, no gravity
    const engine = Engine.create({ gravity: { x: 0, y: 0, scale: 0 } });
    const world = engine.world;

    let runner = Runner.create();
    Runner.run(runner, engine);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    let domBodies: Matter.Body[] = [];
    
    const updateDomBodies = () => {
      if (domBodies.length) {
        Composite.remove(world, domBodies);
      }
      domBodies = [];
      
      const elements = document.querySelectorAll('button, a, .card, .interactive-card, input, nav');
      elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) return;
        
        const body = Bodies.rectangle(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
          rect.width,
          rect.height,
          { isStatic: true, restitution: 0.9, friction: 0.05 }
        );
        domBodies.push(body);
      });
      Composite.add(world, domBodies);
    };

    updateDomBodies();

    let resizeTimeout: NodeJS.Timeout;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        updateDomBodies();
      }, 200);
    };
    
    let scrollTimeout: NodeJS.Timeout;
    const onScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateDomBodies, 100);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll);

    let mousePoints: {x: number, y: number, time: number}[] = [];
    interface Ball {
      body: Matter.Body;
      color: string;
      num: string;
      birth: number;
      impact: number;
    }
    let balls: Ball[] = [];
    let lastMousePos = { x: -1000, y: -1000 };
    
    // Virtual mouse body to push balls
    const mouseBody = Bodies.circle(-1000, -1000, 30, { 
      isStatic: true, 
      restitution: 0.8,
      friction: 0.1
    });
    Composite.add(world, mouseBody);

    // Micro-animation on collision
    Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const ball = balls.find(b => b.body === pair.bodyA || b.body === pair.bodyB);
        if (ball && (pair.bodyA.isStatic || pair.bodyB.isStatic)) {
           // Only flash on solid hits
           const speed = Vector.magnitude(ball.body.velocity);
           if (speed > 1) {
             ball.impact = Math.min(1.0, speed / 5);
           }
        }
      });
    });

    const colors = ['#10b981', '#34d399', '#ffffff', '#0f172a', '#3b82f6'];

    const spawnBall = (x: number, y: number, vx: number, vy: number) => {
      if (balls.length >= 5) {
        const oldest = balls.shift();
        if (oldest) Composite.remove(world, oldest.body);
      }
      
      const radius = 9 + Math.random() * 3; // 18-24px diameter
      const body = Bodies.circle(x, y, radius, {
        restitution: 0.7, 
        friction: 0.01,
        frictionAir: 0.02, 
        density: 0.05
      });
      
      Body.setVelocity(body, { x: vx * 0.4, y: vy * 0.4 });
      
      Composite.add(world, body);
      balls.push({
        body,
        color: colors[Math.floor(Math.random() * colors.length)],
        num: String(Math.floor(Math.random() * 9) + 1),
        birth: Date.now(),
        impact: 0
      });
    };

    let lastSpawnTime = 0;

    const onMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const x = e.clientX;
      const y = e.clientY;
      
      const vx = x - lastMousePos.x;
      const vy = y - lastMousePos.y;
      const speedSq = vx*vx + vy*vy;
      
      Body.setPosition(mouseBody, { x, y });
      mousePoints.push({ x, y, time: now });
      
      if (speedSq > 300 && now - lastSpawnTime > 400) {
        const mag = Math.sqrt(speedSq) || 1;
        const spawnX = x - (vx/mag) * 40;
        const spawnY = y - (vy/mag) * 40;
        
        spawnBall(spawnX, spawnY, vx, vy);
        lastSpawnTime = now;
      }
      
      lastMousePos = { x, y };
    };
    
    window.addEventListener('mousemove', onMouseMove);

    let frameId: number;

    const render = () => {
      const now = Date.now();
      ctx.clearRect(0, 0, width, height);
      
      // 1. Draw tiny ambient glow
      if (lastMousePos.x > -100) {
         const g = ctx.createRadialGradient(lastMousePos.x, lastMousePos.y, 0, lastMousePos.x, lastMousePos.y, 80);
         g.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
         g.addColorStop(1, 'rgba(16, 185, 129, 0)');
         ctx.fillStyle = g;
         ctx.beginPath();
         ctx.arc(lastMousePos.x, lastMousePos.y, 80, 0, 2*Math.PI);
         ctx.fill();
      }

      // 2. Draw trail
      mousePoints = mousePoints.filter(p => now - p.time < 200);
      if (mousePoints.length > 1) {
        ctx.beginPath();
        ctx.moveTo(mousePoints[0].x, mousePoints[0].y);
        for (let i = 1; i < mousePoints.length; i++) {
          const xc = (mousePoints[i].x + mousePoints[i-1].x) / 2;
          const yc = (mousePoints[i].y + mousePoints[i-1].y) / 2;
          ctx.quadraticCurveTo(mousePoints[i-1].x, mousePoints[i-1].y, xc, yc);
        }
        ctx.lineTo(mousePoints[mousePoints.length-1].x, mousePoints[mousePoints.length-1].y);
        
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // 3. Update & Draw balls
      balls = balls.filter(ball => {
        const age = now - ball.birth;
        // Slow down drastically over time or cull
        if (age > 6000) {
          Composite.remove(world, ball.body);
          return false;
        }
        return true;
      });

      for (const ball of balls) {
        const pos = ball.body.position;
        const r = ball.body.circleRadius!;
        const angle = ball.body.angle;
        const age = now - ball.birth;
        
        // Impact decay
        if (ball.impact > 0) ball.impact -= 0.05;
        if (ball.impact < 0) ball.impact = 0;
        
        let opacity = 1;
        if (age < 200) opacity = age / 200;
        else if (age > 5000) opacity = (6000 - age) / 1000;
        
        const scale = 1 + (ball.impact * 0.1);

        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.scale(scale, scale);
        ctx.rotate(angle);
        ctx.globalAlpha = opacity;
        
        // Impact flash (behind ball)
        if (ball.impact > 0.1) {
            ctx.beginPath();
            ctx.arc(0, 0, r + (ball.impact * 4), 0, 2*Math.PI);
            ctx.fillStyle = `rgba(255, 255, 255, ${ball.impact * 0.5})`;
            ctx.fill();
        }

        // Shadow
        ctx.beginPath();
        ctx.arc(r*0.15, r*0.15, r, 0, 2*Math.PI);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fill();

        // Base color
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, 2*Math.PI);
        ctx.fillStyle = ball.color;
        ctx.fill();

        // Glossy highlight
        const grad = ctx.createRadialGradient(-r*0.3, -r*0.3, r*0.1, 0, 0, r);
        grad.addColorStop(0, 'rgba(255,255,255,0.7)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Number circle
        if (r > 10) {
            ctx.beginPath();
            ctx.arc(0, 0, r * 0.55, 0, 2*Math.PI);
            ctx.fillStyle = ball.color === '#ffffff' ? '#0f172a' : '#ffffff';
            ctx.fill();
            
            ctx.fillStyle = ball.color === '#ffffff' ? '#ffffff' : '#0f172a';
            ctx.font = `800 ${r*0.65}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Counter-rotate the text so it stays upright (optional, but requested real pool balls so letting it rotate is physically accurate!)
            // We'll let it rotate with the ball for physical realism!
            ctx.fillText(ball.num, 0, 0);
        }

        ctx.restore();
      }

      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frameId);
      Runner.stop(runner);
      Engine.clear(engine);
    };
  }, []);

  if (!isActive) return null;

  return (
    <canvas 
      ref={canvasRef} 
      className="pointer-events-none fixed inset-0 z-50 w-full h-full"
      style={{ mixBlendMode: 'normal' }}
      aria-hidden="true"
    />
  );
}
