'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

export default function SmoothScroll() {
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let scroll: Lenis | undefined;
    const configure = () => {
      scroll?.destroy();
      scroll = undefined;
      if (!preference.matches) {
        scroll = new Lenis({
          autoRaf: true,
          lerp: 0.085,
          smoothWheel: true,
          syncTouch: false,
          anchors: true,
          prevent: (element) => element.hasAttribute('data-native-scroll'),
        });
      }
    };
    configure();
    preference.addEventListener('change', configure);
    return () => {
      scroll?.destroy();
      preference.removeEventListener('change', configure);
    };
  }, []);
  return null;
}
