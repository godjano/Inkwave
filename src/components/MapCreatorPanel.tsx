'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { MapPin } from '@/lib/types';

/* ──────────────────── Constants ──────────────────── */

const PIN_TYPES: { type: MapPin['type']; icon: string; label: string }[] = [
  { type: 'city', icon: '🏰', label: 'City' },
  { type: 'town', icon: '🏘️', label: 'Town' },
  { type: 'mountain', icon: '⛰️', label: 'Mountain' },
  { type: 'forest', icon: '🌲', label: 'Forest' },
  { type: 'dungeon', icon: '🕳️', label: 'Dungeon' },
  { type: 'port', icon: '⚓', label: 'Port' },
  { type: 'ruins', icon: '🏚️', label: 'Ruins' },
  { type: 'temple', icon: '⛪', label: 'Temple' },
  { type: 'capital', icon: '👑', label: 'Capital' },
];

/* ──────────────────── Terrain Generation ──────────────────── */

// Permutation table for Perlin noise
const PERM = (() => {
  const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  const perm = new Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
})();

function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t: number, a: number, b: number) { return a + t * (b - a); }
function grad(hash: number, x: number, y: number) {
  const h = hash & 3;
  const u = h < 2 ? x : y;
  const v = h < 2 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function perlin2D(x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const a = PERM[X] + Y;
  const b = PERM[X + 1] + Y;
  return lerp(v,
    lerp(u, grad(PERM[a], xf, yf), grad(PERM[b], xf - 1, yf)),
    lerp(u, grad(PERM[a + 1], xf, yf - 1), grad(PERM[b + 1], xf - 1, yf - 1))
  );
}

function terrainNoise(x: number, y: number, seed: number): number {
  const sx = x + seed * 0.7;
  const sy = y + seed * 1.3;
  let val = 0;
  let amp = 0.5;
  let freq = 1.0;
  for (let i = 0; i < 5; i++) {
    val += perlin2D(sx * freq, sy * freq) * amp;
    amp *= 0.5;
    freq *= 2.0;
  }
  const cx = x * 0.8;
  const cy = y * 0.8;
  const dist = Math.sqrt(cx * cx + cy * cy);
  val -= dist * 0.3;
  return val;
}

function getTerrainColor(noiseVal: number): string {
  if (noiseVal < -0.35) return '#1a2e4a';
  if (noiseVal < -0.2) return '#2a4a6a';
  if (noiseVal < -0.1) return '#3a6a8a';
  if (noiseVal < -0.05) return '#c4a86a';
  if (noiseVal < 0.05) return '#8aaa5a';
  if (noiseVal < 0.15) return '#5a8a3a';
  if (noiseVal < 0.25) return '#3a6a2a';
  if (noiseVal < 0.35) return '#2a5a20';
  if (noiseVal < 0.45) return '#7a6a4a';
  if (noiseVal < 0.55) return '#9a7a5a';
  if (noiseVal < 0.65) return '#6a5a4a';
  if (noiseVal < 0.75) return '#8a8a8a';
  return '#d4d4d4';
}


function getThemeColors() {
  return {
    labelBg: 'rgba(0, 0, 0, 0.6)',
    labelText: '#e8e0d4',
    gridLine: 'rgba(212, 173, 74, 0.08)',
    border: 'rgba(212, 173, 74, 0.2)',
    statusBg: 'rgba(0, 0, 0, 0.7)',
    overlayText: '#f0e8dc',
  };
}

export default function MapCreatorPanel() {
  const activeProjectId = useStore(s => s.activeProjectId);
  const addMapPin = useStore(s => s.addMapPin);
  const deleteMapPin = useStore(s => s.deleteMapPin);
  const updateMapPin = useStore(s => s.updateMapPin);
  const getActiveProject = useStore(s => s.getActiveProject);

  const project = getActiveProject();
  const pins = useMemo(() => project?.mapPins ?? [], [project?.mapPins]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Canvas state
  const [seed, setSeed] = useState(() => Math.random() * 1000);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [selectedPinType, setSelectedPinType] = useState<MapPin['type']>('city');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; pinId: string } | null>(null);
  const [statusText, setStatusText] = useState('');

  // Interaction refs
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const isDraggingRef = useRef(false);
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const seedRef = useRef(seed);
  const pinsRef = useRef(pins);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);
  useEffect(() => { seedRef.current = seed; }, [seed]);
  useEffect(() => { pinsRef.current = pins; }, [pins]);

  /* ─────── Terrain rendering ─────── */

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const px = panXRef.current;
    const py = panYRef.current;
    const z = zoomRef.current;
    const s = seedRef.current;
    const tc = getThemeColors();

    // Draw terrain
    const step = 2;
    for (let x = 0; x < w; x += step) {
      for (let y = 0; y < h; y += step) {
        const wx = (x - w / 2) / (z * 200) + px;
        const wy = (y - h / 2) / (z * 200) + py;
        const noiseVal = terrainNoise(wx, wy, s);
        ctx.fillStyle = getTerrainColor(noiseVal);
        ctx.fillRect(x, y, step, step);
      }
    }

    // Draw pins
    const curPins = pinsRef.current;
    for (const pin of curPins) {
      const sx = (pin.x - 0.5) * z * 200 + w / 2 + px * z * 200;
      const sy = (pin.y - 0.5) * z * 200 + h / 2 + py * z * 200;

      // Pin background circle
      ctx.beginPath();
      ctx.arc(sx, sy, 16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();

      // Pin icon
      const pinType = PIN_TYPES.find(pt => pt.type === pin.type);
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pinType?.icon || '📍', sx, sy);

      // Pin label
      ctx.font = '11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelW = ctx.measureText(pin.label).width;
      ctx.fillStyle = tc.labelBg;
      ctx.fillRect(sx - labelW / 2 - 4, sy + 18, labelW + 8, 16);
      ctx.fillStyle = tc.labelText;
      ctx.fillText(pin.label, sx, sy + 20);
    }

    // Status text
    if (statusText) {
      ctx.font = '12px Georgia, serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = tc.statusBg;
      ctx.fillRect(8, h - 30, ctx.measureText(statusText).width + 16, 22);
      ctx.fillStyle = tc.overlayText;
      ctx.fillText(statusText, 16, h - 14);
    }
  }, [statusText]);

  // Animation loop
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => { draw(); });
    ro.observe(container);
    return () => ro.disconnect();
  }, [draw]);

  /* ─────── Mouse handlers ─────── */

  const getMousePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const screenToPin = useCallback((sx: number, sy: number): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    const z = zoomRef.current;
    const px = panXRef.current;
    const py = panYRef.current;
    const x = (sx - w / 2 - px * z * 200) / (z * 200) + 0.5;
    const y = (sy - h / 2 - py * z * 200) / (z * 200) + 0.5;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, []);

  const findPinAt = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    const z = zoomRef.current;
    const px = panXRef.current;
    const py = panYRef.current;

    for (const pin of pinsRef.current) {
      const pinSx = (pin.x - 0.5) * z * 200 + w / 2 + px * z * 200;
      const pinSy = (pin.y - 0.5) * z * 200 + h / 2 + py * z * 200;
      const dx = sx - pinSx;
      const dy = sy - pinSy;
      if (dx * dx + dy * dy < 256) return pin; // 16px radius
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return; // right-click handled by context menu
    const pos = getMousePos(e);
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: panXRef.current, panY: panYRef.current };
    isDraggingRef.current = true;
  }, [getMousePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.buttons === 4 || e.buttons === 1) {
      // Middle button or left button = pan
      const dx = (e.clientX - panStartRef.current.x) / zoomRef.current;
      const dy = (e.clientY - panStartRef.current.y) / zoomRef.current;
      const newPanX = panStartRef.current.panX + dx / 200;
      const newPanY = panStartRef.current.panY + dy / 200;
      setPanX(newPanX);
      setPanY(newPanY);
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      const dx = Math.abs(e.clientX - panStartRef.current.x);
      const dy = Math.abs(e.clientY - panStartRef.current.y);
      // Only treat as click if barely moved
      if (dx < 5 && dy < 5) {
        const pos = getMousePos(e);
        const hitPin = findPinAt(pos.x, pos.y);
        if (!hitPin && activeProjectId) {
          // Place new pin
          const pinPos = screenToPin(pos.x, pos.y);
          const pinType = PIN_TYPES.find(pt => pt.type === selectedPinType);
          const label = window.prompt(`New ${pinType?.label || 'Pin'} name:`, pinType?.label || 'Pin');
          if (label !== null && label.trim()) {
            addMapPin(activeProjectId, {
              x: pinPos.x,
              y: pinPos.y,
              label: label.trim(),
              type: selectedPinType,
              description: '',
            });
          }
        }
      }
    }
    isDraggingRef.current = false;
  }, [getMousePos, findPinAt, screenToPin, activeProjectId, selectedPinType, addMapPin]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getMousePos(e);
    const hitPin = findPinAt(pos.x, pos.y);
    if (hitPin) {
      setContextMenu({ x: e.clientX, y: e.clientY, pinId: hitPin.id });
    }
  }, [getMousePos, findPinAt]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(5, prev * delta)));
  }, []);

  /* ─────── Context menu actions ─────── */

  const handleRenamePin = useCallback(() => {
    if (!contextMenu || !activeProjectId) return;
    const pin = pins.find(p => p.id === contextMenu.pinId);
    if (!pin) return;
    const newLabel = window.prompt('Rename pin:', pin.label);
    if (newLabel !== null && newLabel.trim()) {
      updateMapPin(activeProjectId, pin.id, { label: newLabel.trim() });
    }
    setContextMenu(null);
  }, [contextMenu, activeProjectId, pins, updateMapPin]);

  const handleChangeType = useCallback(() => {
    if (!contextMenu || !activeProjectId) return;
    const pin = pins.find(p => p.id === contextMenu.pinId);
    if (!pin) return;
    const types = PIN_TYPES.map(pt => pt.label).join(', ');
    const newType = window.prompt(`Pin type (${types}):`, pin.type);
    if (newType !== null && newType.trim()) {
      const found = PIN_TYPES.find(pt => pt.label.toLowerCase() === newType.trim().toLowerCase() || pt.type === newType.trim().toLowerCase());
      if (found) {
        updateMapPin(activeProjectId, pin.id, { type: found.type });
      }
    }
    setContextMenu(null);
  }, [contextMenu, activeProjectId, pins, updateMapPin]);

  const handleSetDescription = useCallback(() => {
    if (!contextMenu || !activeProjectId) return;
    const pin = pins.find(p => p.id === contextMenu.pinId);
    if (!pin) return;
    const desc = window.prompt('Pin description:', pin.description);
    if (desc !== null) {
      updateMapPin(activeProjectId, pin.id, { description: desc });
    }
    setContextMenu(null);
  }, [contextMenu, activeProjectId, pins, updateMapPin]);

  const handleDeletePin = useCallback(() => {
    if (!contextMenu || !activeProjectId) return;
    const pin = pins.find(p => p.id === contextMenu.pinId);
    if (!pin) return;
    if (window.confirm(`Delete pin "${pin.label}"?`)) {
      deleteMapPin(activeProjectId, pin.id);
    }
    setContextMenu(null);
  }, [contextMenu, activeProjectId, pins, deleteMapPin]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  /* ─────── Toolbar actions ─────── */

  const handleQuickTerrain = useCallback(() => {
    setSeed(Math.random() * 1000);
    setStatusText('Terrain regenerated');
    setTimeout(() => setStatusText(''), 2000);
  }, []);

  const handleClearAllPins = useCallback(() => {
    if (!activeProjectId) return;
    if (!window.confirm('Clear all pins? This cannot be undone.')) return;
    for (const pin of pins) {
      deleteMapPin(activeProjectId, pin.id);
    }
  }, [activeProjectId, pins, deleteMapPin]);

  const handleZoomIn = useCallback(() => setZoom(prev => Math.min(5, prev * 1.2)), []);
  const handleZoomOut = useCallback(() => setZoom(prev => Math.max(0.3, prev / 1.2)), []);
  const handleResetView = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  /* ─────── Render ─────── */

  if (!project) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Select a project to use the World Map
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col" style={{ height: '100%' }}>
      {/* Toolbar */}
      <div className="manuscript-header flex flex-col" style={{ padding: '10px 12px 8px', gap: 8 }}>
        {/* Row 1: Title + primary actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--accent-gold)',
              letterSpacing: 0.5,
              flexShrink: 0,
              textShadow: '0 0 12px rgba(212,173,74,0.15)',
            }}
          >
            World Map
          </h2>

          <div style={{ flex: 1 }} />

          <button className="inkweave-btn inkweave-btn-primary" onClick={handleQuickTerrain} style={{ padding: '4px 12px', fontSize: 11 }}>
            🌍 Quick Terrain
          </button>

          <button className="inkweave-btn" onClick={handleClearAllPins} disabled={pins.length === 0} style={{ padding: '4px 12px', fontSize: 11, color: 'var(--accent-red)' }}>
            Clear All Pins
          </button>

          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="inkweave-btn" onClick={handleZoomOut} style={{ padding: '2px 8px', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>−</button>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 36, textAlign: 'center', fontFamily: 'monospace' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button className="inkweave-btn" onClick={handleZoomIn} style={{ padding: '2px 8px', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>+</button>
            <button className="inkweave-btn" onClick={handleResetView} title="Reset view" style={{ padding: '2px 8px', fontSize: 11 }}>⌂</button>
          </div>
        </div>

        {/* Row 2: Pin type selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Pin:</span>
          {PIN_TYPES.map(pt => (
            <button
              key={pt.type}
              onClick={() => setSelectedPinType(pt.type)}
              title={pt.label}
              style={{
                padding: '3px 7px',
                borderRadius: 10,
                fontSize: 14,
                border: selectedPinType === pt.type ? '2px solid var(--accent-gold)' : '2px solid transparent',
                background: selectedPinType === pt.type ? 'rgba(160,128,56,0.15)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {pt.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { isDraggingRef.current = false; }}
          onContextMenu={handleContextMenu}
          onWheel={handleWheel}
        />

        {/* Help overlay */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            fontSize: 10,
            color: 'var(--text-muted)',
            background: 'var(--bg-primary)',
            padding: '4px 8px',
            borderRadius: 4,
            pointerEvents: 'none',
            lineHeight: 1.6,
            border: '1px solid var(--border-color)',
          }}
        >
          Click to place pin &middot; Drag to pan &middot; Scroll to zoom<br />
          Right-click pin for options
        </div>

        {/* Pin count */}
        {pins.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              fontSize: 10,
              color: 'var(--text-muted)',
              background: 'var(--bg-primary)',
              padding: '4px 8px',
              borderRadius: 4,
              pointerEvents: 'none',
              border: '1px solid var(--border-color)',
            }}
          >
            {pins.length} pin{pins.length !== 1 ? 's' : ''}
          </div>
        )}

        {/* Empty state */}
        {pins.length === 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, maxWidth: 240 }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>🗺️</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No pins placed yet.</div>
              <div style={{ fontSize: 12 }}>Click on the map to place location pins for your world.</div>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-light)',
            borderRadius: 6,
            padding: '4px 0',
            zIndex: 1000,
            boxShadow: 'var(--shadow-lg)',
            minWidth: 160,
          }}
        >
          <button
            onClick={handleRenamePin}
            style={{ display: 'block', width: '100%', padding: '6px 16px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: "'Georgia', serif" }}
          >
            ✏️ Rename
          </button>
          <button
            onClick={handleChangeType}
            style={{ display: 'block', width: '100%', padding: '6px 16px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: "'Georgia', serif" }}
          >
            🔄 Change Type
          </button>
          <button
            onClick={handleSetDescription}
            style={{ display: 'block', width: '100%', padding: '6px 16px', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: "'Georgia', serif" }}
          >
            📝 Set Description
          </button>
          <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
          <button
            onClick={handleDeletePin}
            style={{ display: 'block', width: '100%', padding: '6px 16px', background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontFamily: "'Georgia', serif" }}
          >
            🗑️ Delete
          </button>
        </div>
      )}
    </div>
  );
}
