import { useEffect, useRef, useState } from 'react';

const MESSAGES = [
  'Initializing orbital mechanics engine…',
  'Connecting to CelesTrak satellite network…',
  'Loading 15,000+ TLE orbital elements…',
  'Propagating satellite positions via SGP4…',
  'Fetching near-Earth asteroid catalogue…',
  'Rendering photorealistic Earth…',
  'Calibrating local space bubble…',
  'Cosmic awareness online.',
];

export function LoadingScreen({ done }) {
  const [progress, setProgress] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [fading,   setFading]   = useState(false);

  useEffect(() => {
    const tick = setInterval(() => {
      setProgress(p => {
        if (p >= 95) { clearInterval(tick); return p; }
        return p + Math.random() * 4 + 1;
      });
      setMsgIndex(i => Math.min(i + 1, MESSAGES.length - 1));
    }, 400);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (done) {
      setProgress(100);
      setTimeout(() => setFading(true), 400);
    }
  }, [done]);

  if (fading && done) return null;

  return (
    <div className={`loading-screen${fading ? ' fade-out' : ''}`}
         style={{ pointerEvents: done ? 'none' : 'all' }}>
      <div className="loading-content">
        <div className="loading-earth">🌍</div>

        <div>
          <h1 className="loading-title">VAANTHULI</h1>
          <p className="loading-subtitle">Real-Time Cosmic Awareness System</p>
        </div>

        <div className="loading-bar-wrap">
          <div
            className="loading-bar-fill"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>

        <p className="loading-status">{MESSAGES[msgIndex]}</p>

        <div className="loading-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}
