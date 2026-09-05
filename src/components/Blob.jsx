import React, { useEffect, useRef } from "react";
import { motion, animate, useReducedMotion } from "framer-motion";

const W = 300;
const H = 300;
const CX = W / 2;
const CY = H / 2;
const BASE_R = 92;
const POINTS = 14;

// A closed, organic blob outline: N points spaced around a circle, each
// pushed in/out by a few sine harmonics, then joined with a
// Catmull-Rom -> cubic-Bezier spline so the edge stays silky smooth.
function blobPoints(rawT, speed = 9.5) {
  // Speed multiplier: drives both harmonic drift & breathing envelope
  const t = rawT * speed;

  // Breathing envelope pushes the wobble between near-circle and organic fluid
  const envelope = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * 0.55 - Math.PI / 2));

  // Each harmonic's phase drifts with its own angular speed
  const pts = [];
  for (let i = 0; i < POINTS; i++) {
    const angle = (i / POINTS) * Math.PI * 2;
    const wobble =
      (Math.sin(angle * 3 + t * 0.6) * 4.6 +
        Math.sin(angle * 5 - t * 0.85 + 1.7) * 2.8 +
        Math.sin(angle * 7 + t * 0.45 + 3.4) * 1.5) *
      envelope;
    const r = BASE_R + wobble;
    pts.push([CX + Math.cos(angle) * r, CY + Math.sin(angle) * r]);
  }
  return pts;
}

function smoothClosedPath(pts) {
  const n = pts.length;
  const get = (i) => pts[(i + n) % n];
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} `;
  for (let i = 0; i < n; i++) {
    const p0 = get(i - 1);
    const p1 = get(i);
    const p2 = get(i + 1);
    const p3 = get(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} `;
  }
  return d + "Z";
}

export const Blob = ({ size = 260, speed = 9.5, className = "" }) => {
  const prefersReduced = useReducedMotion();
  const coreRef = useRef(null);

  useEffect(() => {
    const paint = (t) => {
      const d = smoothClosedPath(blobPoints(t, speed));
      coreRef.current?.setAttribute("d", d);
    };

    if (prefersReduced) {
      paint(0);
      return;
    }

    const controls = animate(0, 1000, {
      duration: 1000,
      ease: "linear",
      repeat: Infinity,
      onUpdate: paint,
    });
    return () => controls.stop();
  }, [prefersReduced, speed]);

  return (
    <div
      className={`blob-outer ${className}`}
      style={{
        width: size,
        height: size,
        position: "relative",
      }}
    >
      {/* Subtle ambient halo */}
      <div
        style={{
          position: "absolute",
          inset: -24,
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, rgba(186, 230, 253, 0.55), rgba(255, 255, 255, 0) 70%)",
          filter: "blur(14px)",
          pointerEvents: "none",
        }}
      />

      <div
        className="blob-wrap"
        style={{ width: "100%", height: "100%", position: "relative" }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="blob-svg"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "visible",
            filter: "drop-shadow(0 16px 32px rgba(56, 140, 220, 0.22))",
          }}
        >
          <defs>
            <radialGradient id="blobFill" cx="34%" cy="26%" r="78%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="32%" stopColor="#edf7fe" />
              <stop offset="62%" stopColor="#c9e7fb" />
              <stop offset="100%" stopColor="#9bd0f3" />
            </radialGradient>
          </defs>

          <path
            ref={coreRef}
            d={smoothClosedPath(blobPoints(0, speed))}
            fill="url(#blobFill)"
          />
        </svg>
      </div>
    </div>
  );
};

export default Blob;
