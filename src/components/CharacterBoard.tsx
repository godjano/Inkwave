'use client';

import { useState, useMemo, useCallback } from 'react';
import { useStore } from '@/lib/store';
import type { WorldEntry } from '@/lib/types';

interface CharacterTier {
  name: string;
  characters: (WorldEntry & { chapterCount: number })[];
}

const STATUS_COLORS: Record<string, string> = {
  Active: '#4a8058',
  Deceased: '#c04040',
  Missing: '#d4870e',
  Unknown: '#888888',
};

const INITIAL_COLORS = ['#a78bfa', '#f59e0b', '#34d399', '#f87171', '#60a5fa', '#fb923c', '#c084fc', '#2dd4bf'];

export default function CharacterBoard() {
  const activeProjectId = useStore(s => s.activeProjectId);
  const getActiveProject = useStore(s => s.getActiveProject);
  const project = getActiveProject();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const characters = useMemo(() => {
    if (!project) return [];
    return project.worldBible.filter(e => e.category === 'characters');
  }, [project]);

  const chaptersContent = useMemo(() => {
    if (!project) return [];
    return project.chapters.map(ch => ({
      id: ch.id,
      title: ch.title,
      text: ch.content.replace(/<[^>]+>/g, '').toLowerCase(),
    }));
  }, [project]);

  const tieredCharacters = useMemo((): CharacterTier[] => {
    const withCounts = characters.map(char => {
      const nameLower = char.name.toLowerCase();
      const count = chaptersContent.filter(ch => ch.text.includes(nameLower)).length;
      return { ...char, chapterCount: count };
    });

    const primary = withCounts.filter(c => c.chapterCount >= 3).sort((a, b) => b.chapterCount - a.chapterCount);
    const secondary = withCounts.filter(c => c.chapterCount === 2).sort((a, b) => a.name.localeCompare(b.name));
    const minor = withCounts.filter(c => c.chapterCount <= 1).sort((a, b) => a.name.localeCompare(b.name));

    return [
      { name: 'Primary Characters', characters: primary },
      { name: 'Secondary Characters', characters: secondary },
      { name: 'Minor / Mentioned', characters: minor },
    ];
  }, [characters, chaptersContent]);

  const getInitialColor = useCallback((name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return INITIAL_COLORS[Math.abs(hash) % INITIAL_COLORS.length];
  }, []);

  if (!project) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
        Select a project to view the Character Board
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="animate-fade-in" style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{String.fromCodePoint(0x1F464)}</div>
        <h2 style={{ color: 'var(--accent-gold)', fontFamily: "'Cinzel', serif", fontSize: 20, marginBottom: 8 }}>No Characters Yet</h2>
        <p style={{ fontSize: 14 }}>Add characters to your World Bible to see them here.</p>
        <p style={{ fontSize: 13, marginTop: 8 }}>Use the World Bible panel {String.fromCodePoint(0x2192)} Characters {String.fromCodePoint(0x2192)} Inscribe or Divine</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--accent-gold)', fontFamily: "'Cinzel', serif", textShadow: '0 0 16px rgba(212,173,74,0.15)' }}>
            Character Board
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            {characters.length} character{characters.length !== 1 ? 's' : ''} across {chaptersContent.length} chapter{chaptersContent.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tiers */}
      {tieredCharacters.map(tier => {
        if (tier.characters.length === 0) return null;
        const isPrimary = tier.name.includes('Primary');
        const isMinor = tier.name.includes('Minor');
        const cardSize = isPrimary ? 200 : isMinor ? 140 : 170;
        const portraitSize = isPrimary ? 80 : isMinor ? 40 : 60;

        return (
          <div key={tier.name} style={{ marginBottom: 32 }}>
            {/* Tier header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, var(--accent-gold), transparent)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {tier.name}
              </span>
              <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, transparent, var(--accent-gold))' }} />
            </div>

            {/* Cards grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMinor ? 8 : 16 }}>
              {tier.characters.map(char => {
                const status = (char.fields?.status as string) || 'Unknown';
                const statusColor = STATUS_COLORS[status] || STATUS_COLORS.Unknown;
                const portrait = char.fields?.portrait as string | undefined;
                const role = (char.fields?.class as string) || (char.fields?.race as string) || '';
                const isExpanded = expandedId === char.id;

                if (isMinor) {
                  // Minor characters: compact pills
                  return (
                    <div
                      key={char.id}
                      onClick={() => setExpandedId(isExpanded ? null : char.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 12px', borderRadius: 20,
                        background: 'var(--bg-secondary)',
                        border: '1px solid rgba(212,173,74,0.15)',
                        cursor: 'pointer', fontSize: 13,
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{
                        width: portraitSize, height: portraitSize, borderRadius: '50%',
                        background: portrait ? 'none' : getInitialColor(char.name),
                        backgroundImage: portrait ? `url(${portrait})` : 'none',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 16, fontWeight: 700, flexShrink: 0,
                      }}>
                        {!portrait && char.name[0]}
                      </div>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{char.name}</span>
                      {char.chapterCount > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ch.{char.chapterCount}</span>
                      )}
                    </div>
                  );
                }

                // Primary / Secondary cards
                return (
                  <div key={char.id} style={{ width: cardSize }}>
                    <div
                      onClick={() => setExpandedId(isExpanded ? null : char.id)}
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid rgba(212,173,74,0.2)',
                        borderRadius: 12, padding: 16,
                        cursor: 'pointer', transition: 'all 0.2s',
                        textAlign: 'center',
                        boxShadow: isExpanded ? '0 4px 20px rgba(212,173,74,0.15)' : '0 2px 8px rgba(45,36,24,0.08)',
                      }}
                    >
                      {/* Portrait */}
                      <div style={{
                        width: portraitSize, height: portraitSize, borderRadius: '50%',
                        margin: '0 auto 12px',
                        background: portrait ? 'none' : getInitialColor(char.name),
                        backgroundImage: portrait ? `url(${portrait})` : 'none',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: isPrimary ? 28 : 22, fontWeight: 700,
                        border: '2px solid rgba(212,173,74,0.3)',
                      }}>
                        {!portrait && char.name[0]}
                      </div>

                      {/* Name */}
                      <div style={{ fontFamily: "'Cinzel', serif", fontSize: isPrimary ? 15 : 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {char.name}
                      </div>

                      {/* Role */}
                      {role && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
                          {role}
                        </div>
                      )}

                      {/* Status + chapters */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 10, color: statusColor, fontWeight: 600,
                        }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                          {status}
                        </span>
                        {char.chapterCount > 0 && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {char.chapterCount} ch.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div style={{
                        marginTop: 8, padding: 12, borderRadius: 8,
                        background: 'var(--bg-primary)',
                        border: '1px solid rgba(212,173,74,0.12)',
                        fontSize: 12, color: 'var(--text-secondary)',
                        textAlign: 'left',
                      }}>
                        {char.fields?.description && (
                          <p style={{ margin: '0 0 8px', lineHeight: 1.5 }}>{String(char.fields.description)}</p>
                        )}
                        {char.fields?.personality && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                            {String(char.fields.personality).split(/[,;\n]/).filter(Boolean).map((trait, i) => (
                              <span key={i} style={{
                                padding: '2px 8px', borderRadius: 10, fontSize: 10,
                                background: 'rgba(212,173,74,0.1)', color: 'var(--accent-gold)',
                                border: '1px solid rgba(212,173,74,0.2)',
                              }}>{trait.trim()}</span>
                            ))}
                          </div>
                        )}
                        {char.fields?.relationships && (
                          <p style={{ margin: 0, fontSize: 11, fontStyle: 'italic' }}>{String(char.fields.relationships)}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
