'use client';

import React, { useEffect, useMemo } from 'react';
import type { WorldEntry } from '@/lib/types';

// ── Category color mapping ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  characters: { bg: 'rgba(184,145,46,0.15)', color: 'var(--accent-gold)' },
  locations: { bg: 'rgba(74,128,88,0.15)', color: 'var(--accent-green)' },
  magic: { bg: 'rgba(122,88,160,0.15)', color: 'var(--accent-purple)' },
  lore: { bg: 'rgba(74,120,160,0.15)', color: 'var(--accent-blue)' },
  items: { bg: 'rgba(212,168,83,0.15)', color: 'var(--accent-gold-dim)' },
  factions: { bg: 'rgba(160,64,64,0.15)', color: 'var(--accent-red)' },
};

const CATEGORY_ICONS: Record<string, string> = {
  characters: '👤',
  locations: '🏰',
  magic: '✨',
  lore: '📖',
  items: '🗡',
  factions: '⚔️',
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface CodexHoverCardProps {
  entry: WorldEntry | null;
  position: { x: number; y: number };
  visible: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CodexHoverCard({ entry, position, visible }: CodexHoverCardProps) {
  // Compute fields to display (up to 5)
  const fields = useMemo(() => {
    if (!entry) return [];
    return Object.entries(entry.fields)
      .filter(([, val]) => val && val.trim().length > 0)
      .slice(0, 5);
  }, [entry]);

  // Truncated notes
  const truncatedNotes = useMemo(() => {
    if (!entry || !entry.notes) return null;
    if (entry.notes.length <= 150) return entry.notes;
    return entry.notes.slice(0, 150) + '...';
  }, [entry]);

  // Category styling
  const categoryStyle = useMemo(() => {
    if (!entry) return CATEGORY_COLORS.lore;
    return CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.lore;
  }, [entry]);

  // Clamp position to viewport
  const clampedPosition = useMemo(() => {
    if (!visible) return { x: 0, y: 0 };
    const cardWidth = 280;
    const cardHeight = 250; // approximate
    const padding = 12;

    let x = position.x - cardWidth / 2;
    let y = position.y + padding;

    // Clamp horizontal
    if (x < padding) x = padding;
    if (x + cardWidth > window.innerWidth - padding) {
      x = window.innerWidth - cardWidth - padding;
    }

    // Clamp vertical - if too close to bottom, show above
    if (y + cardHeight > window.innerHeight - padding) {
      y = position.y - cardHeight - padding - 8;
    }

    return { x, y };
  }, [position, visible]);

  if (!visible || !entry) return null;

  return (
    <div
      className="codex-hover-card"
      style={{
        position: 'fixed',
        left: clampedPosition.x,
        top: clampedPosition.y,
        width: 280,
        zIndex: 100,
        pointerEvents: 'none',
        fontFamily: "'Georgia', 'Palatino Linotype', serif",
        fontSize: 12,
      }}
    >
      {/* Arrow pointer */}
      <div
        style={{
          position: 'absolute',
          top: -6,
          left: position.x - clampedPosition.x,
          width: 12,
          height: 12,
          background: 'var(--bg-elevated)',
          borderLeft: '1px solid var(--border-color)',
          borderTop: '1px solid var(--border-color)',
          transform: 'rotate(45deg)',
          zIndex: 1,
        }}
      />

      {/* Card body */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Gold accent top line */}
        <div
          style={{
            height: 2,
            background: 'linear-gradient(90deg, transparent, var(--accent-gold), transparent)',
          }}
        />

        <div style={{ padding: '10px 12px' }}>
          {/* Header: name + category badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', flex: 1, lineHeight: 1.2 }}>
              {CATEGORY_ICONS[entry.category] || '📝'} {entry.name}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: 4,
                background: categoryStyle.bg,
                color: categoryStyle.color,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {entry.category}
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              height: 1,
              background: 'var(--border-color)',
              marginBottom: 8,
            }}
          />

          {/* Fields */}
          {fields.length > 0 && (
            <div style={{ marginBottom: truncatedNotes ? 8 : 0 }}>
              {fields.map(([key, value]) => (
                <div key={key} style={{ marginBottom: 4 }}>
                  <span
                    style={{
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}
                  >
                    {key}
                  </span>
                  <div
                    style={{
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      lineHeight: 1.4,
                      marginTop: 1,
                      wordBreak: 'break-word',
                    }}
                  >
                    {value.length > 80 ? value.slice(0, 80) + '...' : value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {truncatedNotes && (
            <div
              style={{
                color: 'var(--text-muted)',
                fontSize: 11,
                fontStyle: 'italic',
                lineHeight: 1.4,
                borderTop: '1px dashed var(--border-color)',
                paddingTop: 6,
                wordBreak: 'break-word',
              }}
            >
              {truncatedNotes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
