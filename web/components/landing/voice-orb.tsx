'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';

// The 3D orb in the hero. A vertex shader pushes an icosphere's surface out
// along its normals with 3D simplex noise. The call's state sets colour and
// speed; the receptionist's voice level (0..1) makes the surface swell while
// she speaks. Loaded only in the browser, and only when WebGL works (see
// hero-orb.tsx).

export type OrbLook = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

const LOOKS: Record<OrbLook, { color: string; speed: number; base: number }> = {
  idle: { color: '#0d9488', speed: 0.3, base: 0.07 },
  connecting: { color: '#0891b2', speed: 1.1, base: 0.1 },
  listening: { color: '#14b8a6', speed: 0.35, base: 0.06 },
  thinking: { color: '#0284c7', speed: 1.4, base: 0.12 },
  speaking: { color: '#2dd4bf', speed: 0.7, base: 0.08 },
};

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uLevel;
  uniform float uBase;
  varying float vDisplacement;
  varying vec3 vNormal;

  // Simplex 3D noise (Ian McEwan, Ashima Arts)
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);
    float slow = snoise(position * 1.2 + uTime * 0.6);
    float fine = snoise(position * 3.5 + uTime * 1.3);
    vDisplacement = slow * (uBase + uLevel * 0.45) + fine * uLevel * 0.18;
    vec3 displaced = position + normal * vDisplacement;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uLevel;
  varying float vDisplacement;
  varying vec3 vNormal;

  void main() {
    // Fresnel rim: brighter where the surface turns away from the camera.
    float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.2);
    vec3 core = uColor * (0.8 + vDisplacement * 2.0);
    vec3 glow = mix(uColor, vec3(1.0), 0.55) * rim * (1.3 + uLevel * 1.5);
    gl_FragColor = vec4(core + glow, 1.0);
  }
`;

interface OrbProps {
  look: OrbLook;
  level: number;
  /** prefers-reduced-motion: keep the shape, drop the drifting and spinning. */
  still: boolean;
}

function OrbMesh({ look, level, still }: OrbProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const smoothed = useRef(0);
  const clock = useRef(0);
  const targetColor = useMemo(() => new THREE.Color(), []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uBase: { value: 0.05 },
      uColor: { value: new THREE.Color(LOOKS.idle.color) },
    }),
    []
  );

  useFrame((_, delta) => {
    const style = LOOKS[look];
    const motion = still ? 0 : 1;

    // Ease toward the live audio level so the surface moves, not jitters.
    smoothed.current += (level - smoothed.current) * Math.min(1, delta * 12);
    clock.current += delta * style.speed * motion;

    uniforms.uTime.value = clock.current;
    uniforms.uLevel.value = smoothed.current;
    uniforms.uBase.value += (style.base - uniforms.uBase.value) * Math.min(1, delta * 4);
    uniforms.uColor.value.lerp(targetColor.set(style.color), Math.min(1, delta * 4));

    if (mesh.current) {
      mesh.current.rotation.y += delta * 0.15 * motion;
      mesh.current.scale.setScalar(1 + smoothed.current * 0.12);
    }
  });

  return (
    <mesh ref={mesh}>
      <icosahedronGeometry args={[1, 28]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}

export default function VoiceOrb(props: OrbProps) {
  return (
    <Canvas
      camera={{ position: [0, 0, 3.2], fov: 45 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      aria-hidden="true"
    >
      <OrbMesh {...props} />
    </Canvas>
  );
}
