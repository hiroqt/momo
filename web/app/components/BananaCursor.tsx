'use client';

import { useEffect, useRef } from 'react';
import Icon from './Icon';

const interactiveSelector = 'a, button:not(:disabled), summary, [role="button"]';
const nativeSelector = 'input, textarea, select, [contenteditable="true"], [data-native-cursor], :disabled';

export default function BananaCursor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const bananaRef = useRef<HTMLDivElement>(null);
  const auraRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current!;
    const banana = bananaRef.current!;
    const aura = auraRef.current!;
    const tip = tipRef.current!;
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const target = { x: 0, y: 0 };
    const position = { x: 0, y: 0 };
    const follower = { x: 0, y: 0 };
    let visible = false;
    let hovering = false;
    let pressed = false;
    let angle = 0;
    let scale = 1;
    let frame = 0;
    let lastTime = 0;

    const paint = () => {
      banana.style.transform = `translate3d(${position.x - 3}px,${position.y - 3}px,0) rotate(${angle}deg) scale(${scale})`;
      aura.style.transform = `translate3d(${follower.x}px,${follower.y}px,0) scale(${hovering ? 1.35 : 1})`;
      tip.style.transform = `translate3d(${target.x}px,${target.y}px,0)`;
    };
    const tick = (time: number) => {
      frame = 0;
      if (!visible) return;
      const dt = Math.min(time - (lastTime || time - 16.67), 40);
      lastTime = time;
      // Time-based damping feels the same on 60 Hz and 120 Hz displays.
      const ease = 1 - Math.exp(-dt / 42);
      const trailEase = 1 - Math.exp(-dt / 105);
      const dx = target.x - position.x;
      position.x += dx * ease;
      position.y += (target.y - position.y) * ease;
      follower.x += (target.x - follower.x) * trailEase;
      follower.y += (target.y - follower.y) * trailEase;
      const targetAngle = Math.max(-18, Math.min(18, dx * 0.45)) + (hovering ? -9 : 0);
      const targetScale = pressed ? 0.88 : hovering ? 1.14 : 1;
      angle += (targetAngle - angle) * ease;
      scale += (targetScale - scale) * ease;
      paint();
      const unsettled = Math.hypot(target.x - follower.x, target.y - follower.y) > 0.1
        || Math.abs(angle - targetAngle) > 0.1 || Math.abs(scale - targetScale) > 0.001;
      if (unsettled) frame = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!frame && visible) {
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    };
    const hide = () => {
      visible = false;
      pressed = false;
      root.style.opacity = '0';
      document.documentElement.classList.remove('has-custom-cursor');
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const move = (event: PointerEvent) => {
      if (!pointer.matches || reduced.matches || event.pointerType === 'touch') return hide();
      const element = event.target instanceof Element ? event.target : null;
      if (element?.closest(nativeSelector)) return hide();
      target.x = event.clientX;
      target.y = event.clientY;
      hovering = Boolean(element?.closest(interactiveSelector));
      if (!visible) {
        position.x = follower.x = target.x;
        position.y = follower.y = target.y;
        angle = 0;
        scale = 1;
        visible = true;
        paint();
        root.style.opacity = '1';
        document.documentElement.classList.add('has-custom-cursor');
      }
      root.dataset.hover = String(hovering);
      wake();
    };
    const down = (event: PointerEvent) => {
      move(event);
      if (!visible) return;
      // Snap the stem to the real click point so glide never obscures the target.
      position.x = target.x;
      position.y = target.y;
      pressed = true;
      paint();
      wake();
    };
    const up = () => { pressed = false; wake(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Tab') hide(); };
    const visibility = () => { if (document.hidden) hide(); };
    const updateHover = () => {
      if (!visible) return;
      const element = document.elementFromPoint(target.x, target.y);
      if (element?.closest(nativeSelector)) return hide();
      hovering = Boolean(element?.closest(interactiveSelector));
      root.dataset.hover = String(hovering);
      wake();
    };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('keydown', key);
    window.addEventListener('scroll', updateHover, { passive: true });
    document.documentElement.addEventListener('pointerleave', hide);
    document.addEventListener('visibilitychange', visibility);
    pointer.addEventListener('change', hide);
    reduced.addEventListener('change', hide);
    return () => {
      hide();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', hide);
      window.removeEventListener('blur', hide);
      window.removeEventListener('keydown', key);
      window.removeEventListener('scroll', updateHover);
      document.documentElement.removeEventListener('pointerleave', hide);
      document.removeEventListener('visibilitychange', visibility);
      pointer.removeEventListener('change', hide);
      reduced.removeEventListener('change', hide);
    };
  }, []);

  return (
    <div ref={rootRef} className="banana-cursor" aria-hidden="true">
      <div ref={auraRef} className="banana-cursor-aura" />
      <div ref={tipRef} className="banana-cursor-tip" />
      <div ref={bananaRef} className="banana-cursor-icon">
        <Icon name="banana" size={42} />
      </div>
    </div>
  );
}
