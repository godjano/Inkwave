'use client';

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { FamilyRelation } from '@/lib/types';

/* ──────────────────── Constants ──────────────────── */

const NODE_RADIUS = 28;
const GRID_SIZE = 40;
const LABEL_FONT = '13px Georgia, serif';
const SMALL_FONT = '11px Georgia, serif';

const REL_COLORS: Record<FamilyRelation['type'], string> = {
  parent: '#d4a853',
  partner: '#e06080',
  sibling: '#60a0d0',
  child: '#80c060',
};

const REL_LABELS: Record<FamilyRelation['type'], string> = {
  parent: 'Parent',
  partner: 'Partner',
  sibling: 'Sibling',
  child: 'Child',
};

const REL_LINE_STYLES: Record<FamilyRelation['type'], number[]> = {
  parent: [], // solid
  partner: [8, 4], // dashed
  sibling: [4, 4], // dotted
  child: [12, 4, 2, 4], // dash-dot
};

/* ──────────────────── Helpers ──────────────────── */

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getThemeColors() {
  if (typeof window === 'undefined') {
    return {
      bg: '#1a1410', grid: 'rgba(61, 53, 44, 0.35)',
      nodeBg: '#2d2820', nodeBorder: '#d4a853', nodeText: '#e8dcc8',
      labelBg: 'rgba(26, 20, 16, 0.85)', labelText: '#e8dcc8',
      hoverLabel: '#fff', statusBg: 'rgba(26, 20, 16, 0.7)',
      overlayText: '#d4a853', mutedText: '#8a7e6e',
    };
  }
  const cs = getComputedStyle(document.documentElement);
  const isDark = cs.getPropertyValue('--bg-primary').trim().startsWith('#1') ||
                 cs.getPropertyValue('--bg-primary').trim().startsWith('#0');
  return {
    bg: isDark ? '#1a1410' : '#f5f0e8',
    grid: isDark ? 'rgba(61, 53, 44, 0.35)' : 'rgba(180, 170, 150, 0.25)',
    nodeBg: isDark ? '#2d2820' : '#faf5ee',
    nodeBorder: isDark ? '#d4a853' : '#a08030',
    nodeText: isDark ? '#e8dcc8' : '#3d3529',
    labelBg: isDark ? 'rgba(26, 20, 16, 0.85)' : 'rgba(255, 252, 245, 0.9)',
    labelText: isDark ? '#e8dcc8' : '#3d3529',
    hoverLabel: isDark ? '#fff' : '#1a1410',
    statusBg: isDark ? 'rgba(26, 20, 16, 0.7)' : 'rgba(255, 252, 245, 0.85)',
    overlayText: isDark ? '#d4a853' : '#7a5a20',
    mutedText: isDark ? '#8a7e6e' : '#9a8e7e',
  };
}

/* ──────────────────── Node type ──────────────────── */

interface TreeNode {
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/* ──────────────────── Component ──────────────────── */

export default function FamilyTreePanel() {
  const activeProjectId = useStore(s => s.activeProjectId);
  const addFamilyRelation = useStore(s => s.addFamilyRelation);
  const deleteFamilyRelation = useStore(s => s.deleteFamilyRelation);
  const getActiveProject = useStore(s => s.getActiveProject);

  const project = getActiveProject();
  const worldBible = useMemo(() => project?.worldBible ?? [], [project?.worldBible]);
  const relations = useMemo(() => project?.familyRelations ?? [], [project?.familyRelations]);

  // Characters from World Bible
  const characters = useMemo(
    () => worldBible.filter(e => e.category === 'characters').map(e => e.name),
    [worldBible]
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Canvas state
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; charName: string } | null>(null);
  const [statusText, setStatusText] = useState('');
  const [relationMode, setRelationMode] = useState<FamilyRelation['type'] | null>(null);
  const [relationSource, setRelationSource] = useState<string | null>(null);
  const [aiDetecting, setAiDetecting] = useState(false);

  // Node positions (persisted in state)
  const [nodes, setNodes] = useState<TreeNode[]>([]);

  // Sync nodes from characters
  useEffect(() => {
    setNodes(prev => {
      const existing = new Map(prev.map(n => [n.name, n]));
      const updated: TreeNode[] = [];
      for (const name of characters) {
        if (existing.has(name)) {
          updated.push(existing.get(name)!);
        } else {
          const angle = updated.length * (2 * Math.PI / Math.max(characters.length, 1));
          const radius = 120;
          updated.push({
            name,
            x: 300 + radius * Math.cos(angle),
            y: 200 + radius * Math.sin(angle),
            vx: 0,
            vy: 0,
          });
        }
      }
      return updated;
    });
  }, [characters]);

  // Interaction refs
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const isDraggingRef = useRef(false);
  const dragNodeRef = useRef<string | null>(null);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const nodesRef = useRef(nodes);
  const hoveredNodeRef = useRef(hoveredNode);
  const relationSourceRef = useRef(relationSource);
  const relationModeRef = useRef(relationMode);
  const relationsRef = useRef(relations);

  useEffect(() => { panXRef.current = panX; }, [panX]);
  useEffect(() => { panYRef.current = panY; }, [panY]);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { hoveredNodeRef.current = hoveredNode; }, [hoveredNode]);
  useEffect(() => { relationSourceRef.current = relationSource; }, [relationSource]);
  useEffect(() => { relationModeRef.current = relationMode; }, [relationMode]);
  useEffect(() => { relationsRef.current = relations; }, [relations]);

  /* ─────── Auto-layout ─────── */

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    const iterations = 100;
    const repulsion = 4000;
    const attraction = 0.005;
    const damping = 0.85;
    const centerForce = 0.001;

    const container = containerRef.current;
    const cw = container ? container.getBoundingClientRect().width / 2 : 300;
    const ch = container ? container.getBoundingClientRect().height / 2 : 200;
    const centerX = cw - panXRef.current;
    const centerY = ch - panYRef.current;

    const positions = new Map(nodes.map(n => [n.name, { x: n.x, y: n.y, vx: 0, vy: 0 }]));

    for (let iter = 0; iter < iterations; iter++) {
      const arr = Array.from(positions.entries());
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const [, a] = arr[i];
          const [, b] = arr[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const force = repulsion / (d * d);
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          a.vx -= fx; a.vy -= fy;
          b.vx += fx; b.vy += fy;
        }
      }

      for (const rel of relations) {
        const a = positions.get(rel.fromCharacter);
        const b = positions.get(rel.toCharacter);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        a.vx += dx * attraction;
        a.vy += dy * attraction;
        b.vx -= dx * attraction;
        b.vy -= dy * attraction;
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

    setNodes(prev => prev.map(n => {
      const pos = positions.get(n.name);
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    }));
  }, [nodes, relations, panX]);

  /* ─────── AI Relationship Detection ─────── */

  const handleAiDetect = useCallback(async () => {
    if (!activeProjectId || !project || characters.length < 2) {
      alert('Need at least 2 character entries and some chapter content.');
      return;
    }

    const chaptersWithContent = (project.chapters || []).filter(c => {
      const plain = (c.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      return plain.length > 20;
    });

    if (chaptersWithContent.length === 0) {
      alert('Please write at least one chapter before detecting relationships.');
      return;
    }

    setAiDetecting(true);
    setStatusText('AI analyzing character relationships...');

    try {
      const aiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_key') || '') : '';
      const aiProv = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_provider') || 'openrouter') : 'openrouter';
      const aiModel = aiProv === 'openrouter' ? 'google/gemma-3-27b-it:free' : aiProv === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

      const chapterText = chaptersWithContent.map(ch => {
        const plain = (ch.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        return `--- Chapter: "${ch.title}" ---\n${plain.slice(0, 800)}`;
      }).join('\n\n');

      const prompt = `Analyze these characters and chapter excerpts to find family/personal relationships.
Characters: ${characters.join(', ')}

${chapterText.slice(0, 2000)}

Return a JSON object: { "relations": [{ "from": "CharacterName", "to": "CharacterName", "type": "parent|partner|sibling|child" }] }
Only include relationships clearly implied by the text. Return ONLY valid JSON.`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          systemPrompt: 'You are a story analyst. Find family relationships between characters. Return only valid JSON.',
          temperature: 0.3,
          apiKey: aiKey,
          provider: aiProv,
          model: aiModel,
        }),
      });

      const data = await res.json();
      if (data.content) {
        const cleaned = data.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (parsed.relations && Array.isArray(parsed.relations)) {
          let created = 0;
          for (const rel of parsed.relations) {
            const fromName = rel.from?.trim();
            const toName = rel.to?.trim();
            const type = ['parent', 'partner', 'sibling', 'child'].includes(rel.type) ? rel.type : null;
            if (!fromName || !toName || !type) continue;
            if (!characters.includes(fromName) || !characters.includes(toName)) continue;
            if (fromName === toName) continue;

            // Check for duplicates
            const exists = relations.some(r =>
              (r.fromCharacter === fromName && r.toCharacter === toName && r.type === type) ||
              (r.fromCharacter === toName && r.toCharacter === fromName && r.type === type)
            );
            if (exists) continue;

            addFamilyRelation(activeProjectId, { fromCharacter: fromName, toCharacter: toName, type: type as FamilyRelation['type'] });
            created++;
          }
          setStatusText(`AI detected ${created} relationship${created !== 1 ? 's' : ''}`);
          setTimeout(() => setStatusText(''), 3000);
        }
      }
    } catch {
      setStatusText('AI detection failed. Try again.');
      setTimeout(() => setStatusText(''), 3000);
    } finally {
      setAiDetecting(false);
    }
  }, [activeProjectId, project, characters, relations, addFamilyRelation]);

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
    const curRels = relationsRef.current;
    const hov = hoveredNodeRef.current;
    const src = relationSourceRef.current;
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
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = gridOffY; y < h; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Edges (relations)
    for (const rel of curRels) {
      const fromNode = curNodes.find(n => n.name === rel.fromCharacter);
      const toNode = curNodes.find(n => n.name === rel.toCharacter);
      if (!fromNode || !toNode) continue;

      const x1 = fromNode.x + px;
      const y1 = fromNode.y + py;
      const x2 = toNode.x + px;
      const y2 = toNode.y + py;

      const color = REL_COLORS[rel.type] || '#888';

      // Line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      const dash = REL_LINE_STYLES[rel.type] || [];
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label at midpoint
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      ctx.font = SMALL_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textWidth = ctx.measureText(REL_LABELS[rel.type]).width;
      ctx.fillStyle = tc.labelBg;
      ctx.fillRect(mx - textWidth / 2 - 5, my - 9, textWidth + 10, 18);
      ctx.fillStyle = color;
      ctx.fillText(REL_LABELS[rel.type], mx, my);
    }

    // Pending relation line
    if (src) {
      ctx.strokeStyle = 'rgba(212, 168, 83, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      const srcNode = curNodes.find(n => n.name === src);
      if (srcNode) {
        ctx.beginPath();
        ctx.moveTo(srcNode.x + px, srcNode.y + py);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Nodes
    for (const node of curNodes) {
      const nx = node.x + px;
      const ny = node.y + py;
      const isHovered = hov === node.name;
      const isSource = src === node.name;
      const r = isHovered ? NODE_RADIUS + 3 : NODE_RADIUS;

      // Glow
      if (isHovered || isSource) {
        const gradient = ctx.createRadialGradient(nx, ny, r * 0.5, nx, ny, r * 2);
        gradient.addColorStop(0, 'rgba(212, 168, 83, 0.3)');
        gradient.addColorStop(1, 'rgba(212, 168, 83, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(nx, ny, r * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle
      ctx.fillStyle = isHovered ? '#3d3529' : tc.nodeBg;
      ctx.strokeStyle = isSource ? '#e06080' : (isHovered ? tc.hoverLabel : tc.nodeBorder);
      ctx.lineWidth = isSource ? 3 : 2;
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Character emoji
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👤', nx, ny - 2);

      // Label below
      ctx.font = LABEL_FONT;
      ctx.textBaseline = 'top';
      const labelW = ctx.measureText(node.name).width;
      ctx.fillStyle = tc.labelBg;
      ctx.fillRect(nx - labelW / 2 - 4, ny + r + 6, labelW + 8, 18);
      ctx.fillStyle = isHovered ? tc.hoverLabel : tc.labelText;
      ctx.fillText(node.name, nx, ny + r + 8);
    }

    // Status
    const txt = statusText || (relationModeRef.current && src
      ? `Click target character for "${REL_LABELS[relationModeRef.current]}" relation`
      : relationModeRef.current
        ? `Click source character for "${REL_LABELS[relationModeRef.current]}" relation`
        : '');
    if (txt) {
      ctx.font = '12px Georgia, serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = tc.statusBg;
      ctx.fillRect(8, h - 30, ctx.measureText(txt).width + 16, 22);
      ctx.fillStyle = tc.overlayText;
      ctx.fillText(txt, 16, h - 14);
    }
  }, [statusText]);

  // Animation loop
  useEffect(() => {
    let running = true;
    const loop = () => { if (!running) return; draw(); animFrameRef.current = requestAnimationFrame(loop); };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [draw]);

  // Resize
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

  const findNodeAt = useCallback((wx: number, wy: number) => {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      if (dist({ x: wx, y: wy }, nodesRef.current[i]) <= NODE_RADIUS + 4) return nodesRef.current[i];
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return;
    const pos = getMousePos(e);
    const worldX = pos.x - panXRef.current;
    const worldY = pos.y - panYRef.current;
    const hitNode = findNodeAt(worldX, worldY);

    if (relationModeRef.current) {
      if (hitNode) {
        if (!relationSourceRef.current) {
          setRelationSource(hitNode.name);
          setStatusText(`Source: "${hitNode.name}" — click target`);
        } else {
          // Create relation
          if (activeProjectId && relationModeRef.current) {
            addFamilyRelation(activeProjectId, {
              fromCharacter: relationSourceRef.current!,
              toCharacter: hitNode.name,
              type: relationModeRef.current,
            });
            setStatusText(`Added ${REL_LABELS[relationModeRef.current]} relation`);
            setTimeout(() => setStatusText(''), 2000);
          }
          setRelationSource(null);
          setRelationMode(null);
        }
      }
      return;
    }

    if (hitNode) {
      isDraggingRef.current = true;
      dragNodeRef.current = hitNode.name;
    } else {
      panStartRef.current = { x: e.clientX, y: e.clientY, panX: panXRef.current, panY: panYRef.current };
      isDraggingRef.current = true;
      dragNodeRef.current = null;
    }
  }, [getMousePos, findNodeAt, activeProjectId, addFamilyRelation]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    const worldX = pos.x - panXRef.current;
    const worldY = pos.y - panYRef.current;
    const hitNode = findNodeAt(worldX, worldY);
    setHoveredNode(hitNode ? hitNode.name : null);

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = hitNode
        ? relationModeRef.current ? 'pointer' : 'grab'
        : relationModeRef.current ? 'crosshair' : 'grab';
    }

    if (!isDraggingRef.current) return;

    if (dragNodeRef.current) {
      const newX = pos.x - panXRef.current;
      const newY = pos.y - panYRef.current;
      setNodes(prev => prev.map(n => n.name === dragNodeRef.current ? { ...n, x: newX, y: newY } : n));
    } else {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanX(panStartRef.current.panX + dx);
      setPanY(panStartRef.current.panY + dy);
    }
  }, [getMousePos, findNodeAt]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
    dragNodeRef.current = null;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const pos = getMousePos(e);
    const worldX = pos.x - panXRef.current;
    const worldY = pos.y - panYRef.current;
    const hitNode = findNodeAt(worldX, worldY);
    if (hitNode) {
      setContextMenu({ x: e.clientX, y: e.clientY, charName: hitNode.name });
    }
  }, [getMousePos, findNodeAt]);

  // Close context menu
  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  /* ─────── Context menu actions ─────── */

  const handleRelationAction = useCallback((type: FamilyRelation['type']) => {
    if (!contextMenu) return;
    setRelationMode(type);
    setRelationSource(contextMenu.charName);
    setStatusText(`Source: "${contextMenu.charName}" — click target for ${REL_LABELS[type]}`);
    setContextMenu(null);
  }, [contextMenu]);

  const handleRemoveRelations = useCallback(() => {
    if (!contextMenu || !activeProjectId) return;
    const name = contextMenu.charName;
    const toRemove = relations.filter(r => r.fromCharacter === name || r.toCharacter === name);
    if (toRemove.length === 0) {
      setStatusText('No relations found for this character');
      setTimeout(() => setStatusText(''), 2000);
      return;
    }
    for (const rel of toRemove) {
      deleteFamilyRelation(activeProjectId, rel.id);
    }
    setStatusText(`Removed ${toRemove.length} relation${toRemove.length !== 1 ? 's' : ''}`);
    setTimeout(() => setStatusText(''), 2000);
    setContextMenu(null);
  }, [contextMenu, activeProjectId, relations, deleteFamilyRelation]);

  const handleClearAll = useCallback(() => {
    if (!activeProjectId || relations.length === 0) return;
    if (!window.confirm('Clear all family relations?')) return;
    for (const rel of relations) {
      deleteFamilyRelation(activeProjectId, rel.id);
    }
  }, [activeProjectId, relations, deleteFamilyRelation]);

  const cancelRelationMode = useCallback(() => {
    setRelationMode(null);
    setRelationSource(null);
    setStatusText('');
  }, []);

  /* ─────── Render ─────── */

  if (!project) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100%', color: 'var(--text-muted)', fontSize: 14 }}>
        Select a project to use the Family Tree
      </div>
    );
  }

  const hasChars = characters.length > 0;
  const canAi = characters.length >= 2 && (project.chapters || []).some(c => (c.content || '').replace(/<[^>]*>/g, '').trim().length > 20);

  return (
    <div className="animate-fade-in flex flex-col" style={{ height: '100%' }}>
      {/* Toolbar */}
      <div className="manuscript-header flex flex-col" style={{ padding: '10px 12px 8px', gap: 8 }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <h2
            style={{
              margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)',
              letterSpacing: 0.5, flexShrink: 0, textShadow: '0 0 12px rgba(212,173,74,0.15)',
            }}
          >
            Family Tree
          </h2>

          <div style={{ flex: 1 }} />

          <button
            className="inkweave-btn"
            onClick={handleAutoLayout}
            disabled={nodes.length < 2}
            style={{ padding: '4px 12px', fontSize: 11 }}
          >
            🔄 Auto Layout
          </button>

          <button
            className="inkweave-btn inkweave-btn-primary"
            onClick={handleAiDetect}
            disabled={aiDetecting || !canAi}
            style={{ padding: '4px 12px', fontSize: 11 }}
          >
            {aiDetecting ? (
              <>
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', border: '2px solid var(--accent-gold)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', marginRight: 4 }} />
                Detecting...
              </>
            ) : (
              '🔮 AI Detect'
            )}
          </button>

          <button
            className="inkweave-btn"
            onClick={handleClearAll}
            disabled={relations.length === 0}
            style={{ padding: '4px 12px', fontSize: 11, color: 'var(--accent-red)' }}
          >
            Clear All
          </button>

          {relationMode && (
            <button
              className="inkweave-btn inkweave-btn-primary"
              onClick={cancelRelationMode}
              style={{ padding: '4px 12px', fontSize: 11, borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
            >
              ✕ Cancel
            </button>
          )}
        </div>

        {/* Relation mode buttons */}
        {!relationMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>Add:</span>
            {(['parent', 'partner', 'sibling', 'child'] as const).map(type => (
              <button
                key={type}
                onClick={() => { setRelationMode(type); setRelationSource(null); setStatusText(`Click source character for ${REL_LABELS[type]} relation`); }}
                style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 11,
                  border: `1px solid ${REL_COLORS[type]}`,
                  background: `${REL_COLORS[type]}15`,
                  color: REL_COLORS[type],
                  cursor: 'pointer', transition: 'all 0.2s',
                  fontFamily: "'Georgia', serif",
                }}
              >
                {REL_LABELS[type]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          className="master-bible-canvas"
          style={{ display: 'block', width: '100%', height: '100%' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={handleContextMenu}
        />

        {/* Help */}
        <div
          style={{
            position: 'absolute', top: 8, right: 8, fontSize: 10, color: 'var(--text-muted)',
            background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: 4,
            pointerEvents: 'none', lineHeight: 1.6, border: '1px solid var(--border-color)',
          }}
        >
          Drag nodes to move &middot; Drag empty to pan<br />
          Right-click for relation options
        </div>

        {/* Stats */}
        {relations.length > 0 && (
          <div
            style={{
              position: 'absolute', bottom: 8, left: 8, fontSize: 10, color: 'var(--text-muted)',
              background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: 4,
              pointerEvents: 'none', border: '1px solid var(--border-color)',
              display: 'flex', gap: 8,
            }}
          >
            <span>{characters.length} character{characters.length !== 1 ? 's' : ''}</span>
            <span>&middot;</span>
            <span>{relations.length} relation{relations.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Empty state */}
        {!hasChars && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.7, maxWidth: 260 }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.4 }}>👨‍👩‍👧‍👦</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No characters yet.</div>
              <div style={{ fontSize: 12 }}>Add character entries to the World Bible to populate the family tree.</div>
            </div>
          </div>
        )}

        {hasChars && relations.length === 0 && (
          <div style={{ position: 'absolute', bottom: 36, left: 8, right: 8, textAlign: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Use the toolbar buttons above to add relationships, or try AI Detect
            </span>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="animate-fade-in"
          style={{
            position: 'fixed', left: contextMenu.x, top: contextMenu.y,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-light)',
            borderRadius: 6, padding: '4px 0', zIndex: 1000, boxShadow: 'var(--shadow-lg)', minWidth: 160,
          }}
        >
          <div style={{ padding: '6px 16px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{contextMenu.charName}</strong>
          </div>
          {(['parent', 'partner', 'sibling', 'child'] as const).map(type => (
            <button
              key={type}
              onClick={() => handleRelationAction(type)}
              style={{
                display: 'block', width: '100%', padding: '6px 16px', background: 'none', border: 'none',
                color: REL_COLORS[type], cursor: 'pointer', textAlign: 'left', fontSize: 13,
                fontFamily: "'Georgia', serif",
              }}
            >
              Set as {REL_LABELS[type]} ↓
            </button>
          ))}
          <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0' }} />
          <button
            onClick={handleRemoveRelations}
            style={{
              display: 'block', width: '100%', padding: '6px 16px', background: 'none', border: 'none',
              color: 'var(--accent-red)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
              fontFamily: "'Georgia', serif",
            }}
          >
            Remove All Relations
          </button>
        </div>
      )}
    </div>
  );
}
