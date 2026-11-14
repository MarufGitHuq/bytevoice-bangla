'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { OrbLook } from './voice-orb';

// Chooses between the 3D orb and a flat CSS circle. three.js is only
// downloaded when the browser can draw WebGL; otherwise (old device, WebGL
// switched off, server render) the page shows the static circle and keeps
// working. With prefers-reduced-motion the 3D orb stays but stops drifting.

const VoiceOrb = dynamic(() => import('./voice-orb'), { ssr: false, loading: () => <StaticOrb /> });

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function StaticOrb() {
  return (
    <div
      aria-hidden="true"
      className="m-auto aspect-square w-[62%] rounded-full bg-[radial-gradient(circle_at_35%_30%,#99f6e4,#0d9488_45%,#134e4a_80%)] shadow-[0_0_80px_rgb(45_212_191/0.35)]"
    />
  );
}

export function HeroOrb({ look, level }: { look: OrbLook; level: number }) {
  const [webgl, setWebgl] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setWebgl(canUseWebGL());
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setStill(query.matches);
    const onChange = () => setStill(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="grid size-full place-items-center">
      {webgl ? <VoiceOrb look={look} level={still ? 0 : level} still={still} /> : <StaticOrb />}
    </div>
  );
}
