'use client';

import dynamic from 'next/dynamic';
import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import type { DotLottie } from '@lottiefiles/dotlottie-web';

const Player = dynamic(() => import('@lottiefiles/dotlottie-react').then(mod => mod.DotLottieReact), { ssr: false });

/** Same corrected offline pack as mobile; pause illustrations outside the viewport. */
export default function MomoMotion({ name, className }: {
  name: 'document-scan' | 'momo-thinking' | 'book-loading' | 'momo-hero';
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const container = useRef<HTMLDivElement>(null);
  const [player, setPlayer] = useState<DotLottie | null>(null);
  const [inView, setInView] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    if (container.current) observer.observe(container.current);
    const refresh = () => setVisible(!document.hidden);
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  useEffect(() => {
    if (!player) return;
    const update = () => {
      if (reducedMotion) { player.pause(); player.setFrame(0); }
      else if (inView && visible) player.play();
      else player.pause();
    };
    player.addEventListener('load', update);
    update();
    return () => player.removeEventListener('load', update);
  }, [player, reducedMotion, inView, visible]);

  return <div ref={container} className={className} aria-hidden="true">
    <Player src={`/lottie/${name}.lottie`} loop autoplay={false}
      dotLottieRefCallback={setPlayer} layout={{ fit: 'contain', align: [0.5, 0.5] }}
      renderConfig={{ autoResize: true }} style={{ width: '100%', height: '100%' }} />
  </div>;
}
