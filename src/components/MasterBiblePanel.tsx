'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { worldSchemas } from '@/lib/schemas';
import { WorldCategory } from '@/lib/types';

export { MasterBiblePanel };

/* ──────────────────── Constants ──────────────────── */

const NODE_RADIUS = 24;
const GRID_SIZE = 40;
const LABEL_FONT = '13px Segoe UI, system-ui, sans-serif';
const SMALL_FONT = '11px Segoe UI, system-ui, sans-serif';

const EDGE_COLORS: Record<string, string> = {
  family: '#a78bfa',
  ally: '#34d399',
  enemy: '#f87171',
  romantic: '#fb923c',
  political: '#60a5fa',
  mentor: '#fbbf24',
  serves: '#94a3b8',
  possesses: '#c084fc',
  located_in: '#2dd4bf',
  member_of: '#818cf8',
  default: '#888888',
};

/* ──────────────────── Helpers ──────────────────── */

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function screenToWorld(
  sx: number,
  sy: number,
  panX: number,
  panY: number
) {
  return { x: sx - panX, y: sy - panY };
}

/** Get theme-aware colors from CSS custom properties */
function getThemeColors() {
  if (typeof window === 'undefined') {
    return {
      bg: '#1a1410',
      grid: 'rgba(61, 53, 44, 0.35)',
      labelBg: 'rgba(26, 20, 16, 0.85)',
      labelText: '#e8dcc8',
      hoverLabel: '#fff',
      edgeLine: 'rgba(212, 168, 83, 0.4)',
      edgeArrow: 'rgba(212, 168, 83, 0.5)',
      edgeLabel: '#d4a853',
      edgeLabelBg: 'rgba(26, 20, 16, 0.85)',
      statusBg: 'rgba(26, 20, 16, 0.7)',
      legendBg: 'rgba(26, 20, 16, 0.7)',
      helpBg: 'rgba(26, 20, 16, 0.6)',
      mutedText: '#8a7e6e',
      overlayText: '#d4a853',
    };
  }
  const cs = getComputedStyle(document.documentElement);
  const isDark = cs.getPropertyValue('--bg-primary').trim().startsWith('#1') ||
                 cs.getPropertyValue('--bg-primary').trim().startsWith('#0');

  return {
    bg: isDark ? '#1a1410' : '#f5f0e8',
    grid: isDark ? 'rgba(61, 53, 44, 0.35)' : 'rgba(180, 170, 150, 0.25)',
    labelBg: isDark ? 'rgba(26, 20, 16, 0.85)' : 'rgba(255, 252, 245, 0.9)',
    labelText: isDark ? '#e8dcc8' : '#3d3529',
    hoverLabel: isDark ? '#fff' : '#1a1410',
    edgeLine: isDark ? 'rgba(212, 168, 83, 0.4)' : 'rgba(180, 130, 50, 0.5)',
    edgeArrow: isDark ? 'rgba(212, 168, 83, 0.5)' : 'rgba(160, 120, 40, 0.6)',
    edgeLabel: isDark ? '#d4a853' : '#7a5a20',
    edgeLabelBg: isDark ? 'rgba(26, 20, 16, 0.85)' : 'rgba(255, 252, 245, 0.92)',
    statusBg: isDark ? 'rgba(26, 20, 16, 0.7)' : 'rgba(255, 252, 245, 0.85)',
    legendBg: isDark ? 'rgba(26, 20, 16, 0.7)' : 'rgba(255, 252, 245, 0.85)',
    helpBg: isDark ? 'rgba(26, 20, 16, 0.6)' : 'rgba(255, 252, 245, 0.8)',
    mutedText: isDark ? '#8a7e6e' : '#9a8e7e',
    overlayText: isDark ? '#d4a853' : '#7a5a20',
  };
}

/* ──────────────────── Component ──────────────────── */

function MasterBiblePanel() {
  const activeProjectId = useStore(s => s.activeProjectId);
  const getActiveProject = useStore(s => s.getActiveProject);
  const addMasterNode = useStore(s => s.addMasterNode);
  const updateMasterNode = useStore(s => s.updateMasterNode);
  const deleteMasterNode = useStore(s => s.deleteMasterNode);
  const addMasterEdge = useStore(s => s.addMasterEdge);
  const addWorldEntry = useStore(s => s.addWorldEntry);

  const project = getActiveProject();
  const nodes = useMemo(() => project?.masterBibleNodes ?? [], [project?.masterBibleNodes]);
  const edges = useMemo(() => project?.masterBibleEdges ?? [], [project?.masterBibleEdges]);
  const worldBible = useMemo(() => project?.worldBible ?? [], [project?.worldBible]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Local canvas state
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [addEdgeMode, setAddEdgeMode] = useState(false);
  const [edgeSourceId, setEdgeSourceId] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{from: string; to: string; type?: string; label?: string; weight?: number; quote?: string; chapter?: string; x: number; y: number} | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<WorldCategory>('characters');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [diviningEdges, setDiviningEdges] = useState(false);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);
  const [lastEdgeCount, setLastEdgeCount] = useState<number | null>(null);

  // Interaction refs (no re-renders during drag)
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const dragNodeRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const isDraggingRef = useRef(false);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);

  // Keep refs in sync
  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);

  // Nodes/edges refs for rAF (avoid stale closures)
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const hoveredNodeIdRef = useRef(hoveredNodeId);
  const edgeSourceIdRef = useRef(edgeSourceId);
  const addEdgeModeRef = useRef(addEdgeMode);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { hoveredNodeIdRef.current = hoveredNodeId; }, [hoveredNodeId]);
  useEffect(() => { edgeSourceIdRef.current = edgeSourceId; }, [edgeSourceId]);
  useEffect(() => { addEdgeModeRef.current = addEdgeMode; }, [addEdgeMode]);

  // Get schema for a category
  const getSchemaForCategory = useCallback((cat: WorldCategory) => {
    return worldSchemas.find(s => s.category === cat);
  }, []);

  /* ─────── Auto-sync from World Bible ─────── */

  const handleSyncFromWorldBible = useCallback(async () => {
    if (!activeProjectId || !project) return;
    setSyncing(true);
    setStatusText('Syncing from World Bible...');

    try {
      const container = containerRef.current;
      const cw = container ? container.getBoundingClientRect().width / 2 : 300;
      const ch = container ? container.getBoundingClientRect().height / 2 : 300;
      const centerX = cw - panX;
      const centerY = ch - panY;

      // Get category color from schema
      const getCategoryColor = (cat: WorldCategory) => {
        return worldSchemas.find(s => s.category === cat)?.color ?? '#d4a853';
      };

      // Count existing nodes by label to avoid duplicates
      const existingLabels = new Set(nodes.map(n => n.label.toLowerCase()));

      // Group entries by category for layout
      const entriesByCategory = new Map<WorldCategory, typeof worldBible>();
      for (const entry of worldBible) {
        if (existingLabels.has(entry.name.toLowerCase())) continue; // Skip duplicates
        const cat = entry.category;
        if (!entriesByCategory.has(cat)) entriesByCategory.set(cat, []);
        entriesByCategory.get(cat)!.push(entry);
      }

      const categories = Array.from(entriesByCategory.keys());
      const totalToPlace = Array.from(entriesByCategory.values()).reduce((sum, arr) => sum + arr.length, 0);

      if (totalToPlace === 0) {
        setStatusText('All World Bible entries already synced.');
        setTimeout(() => setStatusText(''), 2500);
        setSyncing(false);
        return;
      }

      // Layout in a circle by category
      const angleStep = (2 * Math.PI) / totalToPlace;
      let angle = 0;
      const radius = Math.min(cw, ch) * 0.35;

      let created = 0;
      for (const cat of categories) {
        const entries = entriesByCategory.get(cat)!;
        const color = getCategoryColor(cat);
        for (const entry of entries) {
          const x = centerX + radius * Math.cos(angle) + (Math.random() - 0.5) * 30;
          const y = centerY + radius * Math.sin(angle) + (Math.random() - 0.5) * 30;
          addMasterNode(activeProjectId, entry.name, x, y, color, cat);
          angle += angleStep;
          created++;
        }
      }

      setLastSyncCount(created);
      setStatusText(`Synced ${created} entries from World Bible`);

      // Auto-layout after sync
      setTimeout(() => {
        handleAutoLayoutInternal();
      }, 200);

      setTimeout(() => setStatusText(''), 3000);
    } catch {
      setStatusText('Sync failed. Try again.');
      setTimeout(() => setStatusText(''), 2500);
    } finally {
      setSyncing(false);
    }
  }, [activeProjectId, project, worldBible, nodes, panX, panY, addMasterNode]);

  /* ─────── AI Divine Edges ─────── */

  const handleDivineEdges = useCallback(async () => {
    if (!activeProjectId || !project || worldBible.length < 2) {
      alert('Need at least 2 World Bible entries and some chapter content to divine edges.');
      return;
    }

    // Check if there are chapters with content
    const chaptersWithContent = (project.chapters || []).filter(c => {
      const plain = (c.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      return plain.length > 20;
    });

    if (chaptersWithContent.length === 0) {
      alert('Please write at least one chapter before divining relationships.');
      return;
    }

    setDiviningEdges(true);
    setStatusText('Divining relationships from chapters...');

    try {
      const aiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_key') || '') : '';
      const aiProv = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_provider') || 'openrouter') : 'openrouter';
      const aiModel = aiProv === 'openrouter' ? 'google/gemma-3-27b-it:free' : aiProv === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

      // Build chapter text from all chapters
      const chapterText = chaptersWithContent.map(ch => {
        const plain = (ch.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        return `--- Chapter: "${ch.title}" ---\n${plain}`;
      }).join('\n\n');

      // Build World Bible entity list
      const entityList = worldBible.map(e => ({
        name: e.name,
        category: e.category,
        notes: e.notes || Object.values(e.fields).filter(Boolean).join(', '),
      }));

      const res = await fetch('/api/ai/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate-edges',
          data: { worldBible: entityList, chapterContent: chapterText },
          apiKey: aiKey,
          provider: aiProv,
          model: aiModel,
        }),
      });

      const data = await res.json();
      if (data.error) {
        alert(`AI failed: ${data.error}`);
        return;
      }

      if (data.content) {
        try {
          const cleaned = data.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const parsed = JSON.parse(cleaned);

          if (parsed.edges && Array.isArray(parsed.edges)) {
            if (parsed.edges.length === 0) {
              setStatusText('No relationships found in chapters.');
              setTimeout(() => setStatusText(''), 3000);
              return;
            }

            // Map entity names to node IDs
            const nodeMap = new Map<string, string>();
            for (const node of nodes) {
              nodeMap.set(node.label.toLowerCase(), node.id);
            }

            let created = 0;
            let skipped = 0;

            for (const edge of parsed.edges) {
              const fromId = nodeMap.get(edge.from?.toLowerCase());
              const toId = nodeMap.get(edge.to?.toLowerCase());
              if (!fromId || !toId) {
                skipped++;
                continue;
              }
              if (fromId === toId) continue; // Skip self-edges

              // Check if edge already exists
              const exists = edges.some(e =>
                (e.from === fromId && e.to === toId) ||
                (e.from === toId && e.to === fromId)
              );
              if (exists) continue;

              addMasterEdge(activeProjectId, fromId, toId, edge.label || 'related');
              created++;
            }

            setLastEdgeCount(created);
            let msg = `Divined ${created} relationship${created !== 1 ? 's' : ''}`;
            if (skipped > 0) msg += ` (${skipped} skipped — no matching nodes)`;
            setStatusText(msg);
            setTimeout(() => setStatusText(''), 4000);
          } else {
            setStatusText('No relationships found.');
            setTimeout(() => setStatusText(''), 3000);
          }
        } catch {
          setStatusText('Could not parse AI response.');
          setTimeout(() => setStatusText(''), 3000);
        }
      }
    } catch {
      setStatusText('Edge divination failed. Try again.');
      setTimeout(() => setStatusText(''), 2500);
    } finally {
      setDiviningEdges(false);
    }
  }, [activeProjectId, project, worldBible, nodes, edges, addMasterEdge]);

  /* ─────── Canvas rendering ─────── */

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
    const curNodes = nodesRef.current;
    const curEdges = edgesRef.current;
    const hovId = hoveredNodeIdRef.current;
    const srcId = edgeSourceIdRef.current;
    const tc = getThemeColors();

    // Background
    ctx.fillStyle = tc.bg;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = tc.grid;
    ctx.lineWidth = 0.5;
    const gridOffX = px % GRID_SIZE;
    const gridOffY = py % GRID_SIZE;
    for (let x = gridOffX; x < w; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = gridOffY; y < h; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Edges
    for (const edge of curEdges) {
      const fromNode = curNodes.find(n => n.id === edge.from);
      const toNode = curNodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      const x1 = fromNode.x + px;
      const y1 = fromNode.y + py;
      const x2 = toNode.x + px;
      const y2 = toNode.y + py;

      // Line (color by type, thickness by weight)
      const edgeColor = EDGE_COLORS[edge.type || 'default'] || EDGE_COLORS.default;
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = Math.max(1, Math.min(4, (edge.weight || 2) * 0.8));
      if (edge.evolved) { ctx.setLineDash([6, 4]); } else { ctx.setLineDash([]); }
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow at midpoint
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const angle = Math.atan2(y2 - y1, x2 - x1);

      ctx.fillStyle = edgeColor;
      ctx.beginPath();
      ctx.moveTo(mx + 6 * Math.cos(angle), my + 6 * Math.sin(angle));
      ctx.lineTo(
        mx - 6 * Math.cos(angle - Math.PI / 6),
        my - 6 * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        mx - 6 * Math.cos(angle + Math.PI / 6),
        my - 6 * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fill();

      // Label
      if (edge.label) {
        ctx.font = SMALL_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textWidth = ctx.measureText(edge.label).width;
        ctx.fillStyle = tc.edgeLabelBg;
        ctx.fillRect(mx - textWidth / 2 - 6, my - 18, textWidth + 12, 18);
        ctx.fillStyle = tc.edgeLabel;
        ctx.fillText(edge.label, mx, my - 10);
      }
    }

    // "Pending" edge line when in add-edge mode with source selected
    if (srcId) {
      const srcNode = curNodes.find(n => n.id === srcId);
      if (srcNode) {
        ctx.strokeStyle = tc.edgeLine;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(srcNode.x + px, srcNode.y + py);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Nodes
    for (const node of curNodes) {
      const nx = node.x + px;
      const ny = node.y + py;
      const isHovered = hovId === node.id;
      const isEdgeSource = srcId === node.id;
      const r = isHovered ? NODE_RADIUS + 3 : NODE_RADIUS;

      // Glow
      if (isHovered || isEdgeSource) {
        const gradient = ctx.createRadialGradient(nx, ny, r * 0.5, nx, ny, r * 2);
        gradient.addColorStop(0, node.color + '44');
        gradient.addColorStop(1, node.color + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(nx, ny, r * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Circle
      ctx.fillStyle = node.color + (isHovered ? 'cc' : '99');
      ctx.strokeStyle = isHovered ? (tc.hoverLabel === '#fff' ? '#fff' : '#1a1410') : node.color;
      ctx.lineWidth = isEdgeSource ? 3 : 2;
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner dot
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(nx, ny, r * 0.35, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.font = LABEL_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const label = node.label || 'Unnamed';
      const textWidth = ctx.measureText(label).width;
      // Label background
      ctx.fillStyle = tc.labelBg;
      const labelY = ny + r + 6;
      ctx.fillRect(nx - textWidth / 2 - 4, labelY - 1, textWidth + 8, 18);
      // Label text
      ctx.fillStyle = isHovered ? tc.hoverLabel : tc.labelText;
      ctx.fillText(label, nx, labelY);
    }

    // Status text overlay
    if (statusText || addEdgeModeRef.current) {
      ctx.font = '12px Segoe UI, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const txt = statusText || (srcId ? 'Click a target node to complete the edge' : 'Click a source node to start an edge');
      ctx.fillStyle = tc.statusBg;
      ctx.fillRect(8, h - 30, ctx.measureText(txt).width + 16, 22);
      ctx.fillStyle = tc.overlayText;
      ctx.fillText(txt, 16, h - 14);
    }
  }, [statusText]);

  // Internal auto-layout reference (used after sync)
  const handleAutoLayoutInternal = useCallback(() => {
    if (!activeProjectId || nodes.length === 0) return;
    const iterations = 120;
    const repulsion = 5000;
    const attraction = 0.005;
    const damping = 0.9;
    const centerForce = 0.001;

    const container = containerRef.current;
    const cw = container ? container.getBoundingClientRect().width / 2 : 300;
    const ch = container ? container.getBoundingClientRect().height / 2 : 300;
    const centerX = cw - panXRef.current;
    const centerY = ch - panYRef.current;

    const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    for (const n of nodes) {
      positions.set(n.id, { x: n.x, y: n.y, vx: 0, vy: 0 });
    }

    for (let iter = 0; iter < iterations; iter++) {
      const nodeArr = Array.from(positions.entries());
      for (let i = 0; i < nodeArr.length; i++) {
        for (let j = i + 1; j < nodeArr.length; j++) {
          const [, a] = nodeArr[i];
          const [, b] = nodeArr[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = repulsion / (d * d);
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      for (const edge of edges) {
        const a = positions.get(edge.from);
        const b = positions.get(edge.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const fx = dx * attraction;
        const fy = dy * attraction;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      for (const [, p] of positions) {
        p.vx += (centerX - p.x) * centerForce;
        p.vy += (centerY - p.y) * centerForce;
      }

      for (const [, p] of positions) {
        p.vx *= damping;
        p.vy *= damping;
        p.x += p.vx;
        p.y += p.vy;
      }
    }

    for (const node of nodes) {
      const pos = positions.get(node.id);
      if (pos) {
        updateMasterNode(activeProjectId, node.id, { x: pos.x, y: pos.y });
      }
    }

    const minX = Math.min(...nodes.map(n => (positions.get(n.id)?.x ?? n.x)));
    const maxX = Math.max(...nodes.map(n => (positions.get(n.id)?.x ?? n.x)));
    const minY = Math.min(...nodes.map(n => (positions.get(n.id)?.y ?? n.y)));
    const maxY = Math.max(...nodes.map(n => (positions.get(n.id)?.y ?? n.y)));
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    setPanX(cw - midX);
    setPanY(ch - midY);
  }, [activeProjectId, nodes, edges, updateMasterNode]);

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
    const ro = new ResizeObserver(() => {
      draw();
    });
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

  const findNodeAtPos = useCallback(
    (wx: number, wy: number) => {
      // Check in reverse order (top-most first)
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (dist({ x: wx, y: wy }, { x: nodes[i].x, y: nodes[i].y }) <= NODE_RADIUS + 4) {
          return nodes[i];
        }
      }
      return null;
    },
    [nodes]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);
      const worldPos = screenToWorld(pos.x, pos.y, panXRef.current, panYRef.current);
      const hitNode = findNodeAtPos(worldPos.x, worldPos.y);

      if (hitNode) {
        // In add-edge mode, handle edge creation
        if (addEdgeModeRef.current) {
          if (!edgeSourceIdRef.current) {
            // First click = source
            setEdgeSourceId(hitNode.id);
            setStatusText(`Source: "${hitNode.label}" — now click target node`);
          } else {
            // Second click = target, prompt for label
            const sourceLabel = nodesRef.current.find(n => n.id === edgeSourceIdRef.current)?.label ?? '';
            const targetLabel = hitNode.label;
            const label = window.prompt(
              `Relationship from "${sourceLabel}" to "${targetLabel}":`,
              ''
            );
            if (label !== null && label.trim() && activeProjectId) {
              addMasterEdge(activeProjectId, edgeSourceIdRef.current!, hitNode.id, label.trim());
            }
            setEdgeSourceId(null);
            setStatusText('');
          }
          return;
        }

        // Start dragging node
        isDraggingRef.current = true;
        dragNodeRef.current = {
          id: hitNode.id,
          offsetX: worldPos.x - hitNode.x,
          offsetY: worldPos.y - hitNode.y,
        };
      } else {
        // Start panning
        panStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          panX: panXRef.current,
          panY: panYRef.current,
        };
        isDraggingRef.current = true;
        dragNodeRef.current = null;
      }
    },
    [getMousePos, findNodeAtPos, addMasterEdge, activeProjectId]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);
      const worldPos = screenToWorld(pos.x, pos.y, panXRef.current, panYRef.current);

      // Update hovered node
      const hitNode = findNodeAtPos(worldPos.x, worldPos.y);
      setHoveredNodeId(hitNode ? hitNode.id : null);

      // Update cursor
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = hitNode
          ? addEdgeModeRef.current
            ? 'pointer'
            : 'grab'
          : addEdgeModeRef.current
            ? 'crosshair'
            : 'grab';
      }

      if (!isDraggingRef.current) return;

      if (dragNodeRef.current && activeProjectId) {
        // Dragging a node
        const newX = worldPos.x - dragNodeRef.current.offsetX;
        const newY = worldPos.y - dragNodeRef.current.offsetY;
        updateMasterNode(activeProjectId, dragNodeRef.current.id, { x: newX, y: newY });
        if (canvas) canvas.style.cursor = 'grabbing';
      } else if (!dragNodeRef.current) {
        // Panning
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        const newPanX = panStartRef.current.panX + dx;
        const newPanY = panStartRef.current.panY + dy;
        setPanX(newPanX);
        setPanY(newPanY);
        if (canvas) canvas.style.cursor = 'grabbing';
      }
    },
    [getMousePos, findNodeAtPos, activeProjectId, updateMasterNode]
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    dragNodeRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = addEdgeModeRef.current ? 'crosshair' : 'grab';
    }
  }, []);

  const handleDblClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const pos = getMousePos(e);
      const worldPos = screenToWorld(pos.x, pos.y, panXRef.current, panYRef.current);
      const hitNode = findNodeAtPos(worldPos.x, worldPos.y);
      if (hitNode && activeProjectId) {
        const confirmed = window.confirm(`Delete node "${hitNode.label}" and all its edges?`);
        if (confirmed) {
          deleteMasterNode(activeProjectId, hitNode.id);
        }
      }
    },
    [getMousePos, findNodeAtPos, activeProjectId, deleteMasterNode]
  );

  /* ─────── Toolbar actions ─────── */

  const handleAddNode = useCallback(() => {
    if (!activeProjectId) return;
    const schema = getSchemaForCategory(selectedCategory);
    const color = schema?.color ?? '#d4a853';
    // Place at center of visible canvas
    const container = containerRef.current;
    const cx = container ? container.getBoundingClientRect().width / 2 - panX : 200;
    const cy = container ? container.getBoundingClientRect().height / 2 - panY : 200;
    // Slight random offset to prevent stacking
    const jitter = () => (Math.random() - 0.5) * 40;
    const label = window.prompt('Node label:', schema?.label ?? 'New Node');
    if (label !== null && label.trim()) {
      addMasterNode(activeProjectId, label.trim(), cx + jitter(), cy + jitter(), color, selectedCategory);
    }
  }, [activeProjectId, selectedCategory, getSchemaForCategory, addMasterNode, panX, panY]);

  const handleClearAll = useCallback(() => {
    if (!activeProjectId) return;
    const confirmed = window.confirm('Clear all nodes and edges? This cannot be undone.');
    if (!confirmed) return;
    const proj = getActiveProject();
    if (!proj) return;
    for (const node of proj.masterBibleNodes) {
      deleteMasterNode(activeProjectId, node.id);
    }
    setEdgeSourceId(null);
    setStatusText('');
    setLastSyncCount(null);
    setLastEdgeCount(null);
  }, [activeProjectId, getActiveProject, deleteMasterNode]);

  const handleToggleEdgeMode = useCallback(() => {
    const next = !addEdgeMode;
    setAddEdgeMode(next);
    setEdgeSourceId(null);
    setStatusText(next ? 'Edge mode ON — click source node' : '');
  }, [addEdgeMode]);

  const handleAutoLayout = useCallback(() => {
    handleAutoLayoutInternal();
  }, [handleAutoLayoutInternal]);

  /* ─────── Render ─────── */

  if (!project) {
    return (
      <div
        className="inkweave-panel flex items-center justify-center"
        style={{ color: 'var(--text-muted)', fontSize: 14 }}
      >
        Select a project to view the Relationship Graph
      </div>
    );
  }

  // Calculate unsynced entries count
  const existingNodeLabels = new Set(nodes.map(n => n.label.toLowerCase()));
  const unsyncedCount = worldBible.filter(e => !existingNodeLabels.has(e.name.toLowerCase())).length;
  const canDivine = worldBible.length >= 2 && (project.chapters || []).some(c => (c.content || '').replace(/<[^>]*>/g, '').trim().length > 20);

  return (
    <div
      className="inkweave-panel flex flex-col"
      style={{ height: '100%', padding: 0 }}
    >
      {/* Toolbar */}
      <div
        className="manuscript-header flex flex-col"
        style={{ padding: '10px 12px 8px', gap: 8 }}
      >
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
            Relationship Graph
          </h2>

          <div style={{ flex: 1 }} />

          {/* Sync from World Bible */}
          <button
            className="inkweave-btn inkweave-btn-primary"
            onClick={handleSyncFromWorldBible}
            disabled={syncing || unsyncedCount === 0}
            style={{ padding: '4px 12px', fontSize: 11 }}
            title={unsyncedCount > 0 ? `Import ${unsyncedCount} World Bible entries as graph nodes` : 'All entries already synced'}
          >
            {syncing ? (
              <>
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', border: '2px solid var(--accent-gold)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', marginRight: 4 }} />
                Syncing...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 3 }}>
                  <path d="M6 1v3M6 8v3M1 6h3M8 6h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                Sync World Bible
                {unsyncedCount > 0 && (
                  <span style={{
                    marginLeft: 4, background: 'var(--accent-gold)', color: '#1a1410',
                    fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 8, lineHeight: '14px',
                  }}>
                    {unsyncedCount}
                  </span>
                )}
              </>
            )}
          </button>
        <button
          onClick={async () => {
            if (!activeProjectId || !project) return;
            setDiviningEdges(true);
            try {
              const aiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_key') || '') : '';
              const aiProv = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_provider') || 'groq') : 'groq';
              const aiModel = aiProv === 'groq' ? 'llama-3.3-70b-versatile' : 'google/gemma-3-27b-it:free';
              const chapters = project.chapters || [];
              const chapterText = chapters.map(ch => { const p = ch.content.replace(/<[^>]+>/g, ''); return '--- Chapter: "' + ch.title + '" ---\n' + p; }).join('\n\n');
              const res = await fetch('/api/ai/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate-graph', data: { genre: project.genre, synopsis: project.description, chapterContent: chapterText }, apiKey: aiKey, provider: aiProv, model: aiModel }) });
              const data = await res.json();
              if (data.content) {
                const cleaned = data.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                const parsed = JSON.parse(cleaned);
                if (parsed.entities?.length) {
                  for (const ent of parsed.entities) {
                    const exists = project.worldBible.some(w => w.name.toLowerCase() === ent.name.toLowerCase());
                    if (!exists) { addWorldEntry(activeProjectId, (ent.category || 'characters') as WorldCategory, ent.name); }
                  }
                }
                if (parsed.edges?.length) {
                  const newEdges = parsed.edges.map((e: { from: string; to: string; type?: string; label?: string; weight?: number; quote?: string; chapter?: string }) => ({ id: Math.random().toString(36).slice(2), from: e.from, to: e.to, type: e.type || 'ally', label: e.label || '', weight: e.weight || 3, quote: e.quote || '', chapter: e.chapter || '' }));
                  for (const ne of newEdges) { addMasterEdge(activeProjectId, ne.from, ne.to, ne.label, { type: ne.type, weight: ne.weight, quote: ne.quote, chapter: ne.chapter }); }
                }
                alert('Discovered ' + (parsed.entities?.length || 0) + ' entities and ' + (parsed.edges?.length || 0) + ' relationships!');
              }
            } catch (err) { alert('AI failed: ' + (err instanceof Error ? err.message : 'Unknown error')); }
            setDiviningEdges(false);
          }}
          disabled={diviningEdges || !project?.chapters?.length}
          className="flex items-center gap-1 rounded-md text-xs transition-colors"
          style={{ padding: '4px 8px', background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(52,211,153,0.15))', border: '1px solid rgba(167,139,250,0.3)', color: 'var(--accent-gold)', cursor: 'pointer', opacity: diviningEdges ? 0.5 : 1 }}
          title="Auto-discover all entities and relationships from chapters"
        >{diviningEdges ? 'Analyzing...' : '\u2728 Divine All'}</button>

          {/* AI Divine Edges */}
          <button
            className="inkweave-btn"
            onClick={handleDivineEdges}
            disabled={diviningEdges || !canDivine || nodes.length < 2}
            style={{ padding: '4px 12px', fontSize: 11 }}
            title={canDivine ? 'AI analyzes chapters and creates relationship edges between entities' : 'Need 2+ nodes and chapter content'}
          >
            {diviningEdges ? (
              <>
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', border: '2px solid var(--accent-gold)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', marginRight: 4 }} />
                Divining...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 3 }}>
                  <path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5Z" fill="var(--accent-gold)" />
                </svg>
                Divine Edges
              </>
            )}
          </button>
        </div>

        {/* Row 2: Secondary actions + category selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            className="inkweave-btn"
            onClick={handleAddNode}
            style={{ padding: '3px 10px', fontSize: 11 }}
          >
            <span style={{ marginRight: 3 }}>+</span> Add Node
          </button>

          <button
            className={`inkweave-btn ${addEdgeMode ? 'inkweave-btn-primary' : ''}`}
            onClick={handleToggleEdgeMode}
            style={{ padding: '3px 10px', fontSize: 11 }}
            title="Toggle edge creation mode"
          >
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 3 }}
            >
              <line x1="5" y1="19" x2="19" y2="5" />
              <circle cx="5" cy="19" r="2" fill="currentColor" />
              <circle cx="19" cy="5" r="2" fill="currentColor" />
            </svg>
            {addEdgeMode ? 'Edge: ON' : 'Add Edge'}
          </button>

          <button
            className="inkweave-btn"
            onClick={handleAutoLayout}
            style={{ padding: '3px 10px', fontSize: 11 }}
            disabled={nodes.length < 2}
            title="Auto-arrange nodes"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 3 }}>
              <circle cx="12" cy="12" r="3" />
              <circle cx="4" cy="4" r="2" />
              <circle cx="20" cy="4" r="2" />
              <circle cx="4" cy="20" r="2" />
              <circle cx="20" cy="20" r="2" />
            </svg>
            Auto Layout
          </button>

          <button
            className="inkweave-btn"
            onClick={handleClearAll}
            style={{ padding: '3px 10px', fontSize: 11, color: 'var(--accent-red)' }}
            disabled={nodes.length === 0}
          >
            Clear All
          </button>

          {/* Category selector (compact) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
            {worldSchemas.map(schema => (
              <button
                key={schema.category}
                onClick={() => setSelectedCategory(schema.category)}
                title={schema.label}
                style={{
                  padding: '2px 7px',
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 500,
                  border: selectedCategory === schema.category
                    ? `2px solid ${schema.color}`
                    : '2px solid transparent',
                  background: selectedCategory === schema.category
                    ? schema.color + '22'
                    : 'transparent',
                  color: selectedCategory === schema.category
                    ? schema.color
                    : 'var(--text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {schema.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
      >
        <canvas
          ref={canvasRef}
          className="master-bible-canvas"
          style={{ display: 'block', width: '100%', height: '100%' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDblClick}
        />
      {selectedEdge && (
        <div
          style={{
            position: 'absolute',
            left: selectedEdge.x,
            top: selectedEdge.y,
            transform: 'translate(-50%, -120%)',
            background: 'var(--bg-elevated, #2a2520)',
            border: '1px solid ' + (EDGE_COLORS[(selectedEdge as {type?: string}).type || 'default'] || '#888'),
            borderRadius: 8,
            padding: '10px 14px',
            maxWidth: 280,
            zIndex: 100,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            fontSize: 12,
            color: 'var(--text-primary)',
          }}
          onClick={() => setSelectedEdge(null)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ background: EDGE_COLORS[(selectedEdge as {type?: string}).type || 'default'] || '#888', color: '#fff', padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>{(selectedEdge as {type?: string}).type || 'related'}</span>
            <span style={{ fontWeight: 600 }}>{selectedEdge.from} {String.fromCharCode(8594)} {selectedEdge.to}</span>
          </div>
          {(selectedEdge as {label?: string}).label && <div style={{ marginBottom: 4, color: 'var(--text-secondary)' }}>{(selectedEdge as {label?: string}).label}</div>}
          {(selectedEdge as {quote?: string}).quote && <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', borderLeft: '2px solid ' + (EDGE_COLORS[(selectedEdge as {type?: string}).type || 'default'] || '#888'), paddingLeft: 8, marginTop: 6 }}>{String.fromCharCode(8220)}{(selectedEdge as {quote?: string}).quote}{String.fromCharCode(8221)}</div>}
          {(selectedEdge as {chapter?: string}).chapter && <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>{String.fromCharCode(8212)} {(selectedEdge as {chapter?: string}).chapter}</div>}
        </div>
      )}

        {/* Empty state overlay */}
        {nodes.length === 0 && (
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
            <div
              style={{
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 13,
                maxWidth: 260,
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>
                🔗
              </div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                No nodes yet.
              </div>
              {worldBible.length > 0 ? (
                <div style={{ fontSize: 12 }}>
                  You have <strong>{worldBible.length}</strong> World Bible entries.
                  Click <em>Sync World Bible</em> to auto-populate the graph.
                </div>
              ) : (
                <div style={{ fontSize: 12 }}>
                  Add entries to the World Bible first, or click <em>Add Node</em> to create one manually.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legend / stats overlay */}
        {nodes.length > 0 && (
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
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span>{nodes.length} node{nodes.length !== 1 ? 's' : ''}</span>
            <span>&middot;</span>
            <span>{edges.length} edge{edges.length !== 1 ? 's' : ''}</span>
            {lastSyncCount !== null && (
              <>
                <span>&middot;</span>
                <span style={{ color: 'var(--accent-gold)' }}>+{lastSyncCount} synced</span>
              </>
            )}
            {lastEdgeCount !== null && (
              <>
                <span>&middot;</span>
                <span style={{ color: 'var(--accent-gold)' }}>+{lastEdgeCount} edges</span>
              </>
            )}
          </div>
        )}

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
          Drag nodes to move &middot; Drag empty to pan<br />
          Double-click node to delete
        </div>
      </div>
    </div>
  );
}
