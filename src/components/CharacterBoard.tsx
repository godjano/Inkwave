'use client';

import { useState, useMemo, useCallback } from 'react';
import { useStore } from '@/lib/store';
import type { WorldEntry } from '@/lib/types';

interface CharacterTier {
  id: 'primary' | 'secondary' | 'minor';
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

const TAG_COLORS = ['#b8912e', '#4a8058', '#60a5fa', '#a78bfa', '#f87171'];

export default function CharacterBoard() {
  const activeProjectId = useStore(s => s.activeProjectId);
  const getActiveProject = useStore(s => s.getActiveProject);
  const updateWorldEntry = useStore(s => s.updateWorldEntry);
  const project = getActiveProject();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragOverTier, setDragOverTier] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

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

  const getTier = useCallback((char: WorldEntry & { chapterCount: number }): 'primary' | 'secondary' | 'minor' => {
    const override = char.fields?.tierOverride as string | undefined;
    if (override === 'primary' || override === 'secondary' || override === 'minor') return override;
    if (char.chapterCount >= 3) return 'primary';
    if (char.chapterCount === 2) return 'secondary';
    return 'minor';
  }, []);

  const tieredCharacters = useMemo((): CharacterTier[] => {
    const withCounts = characters.map(char => {
      const nameLower = char.name.toLowerCase();
      const count = chaptersContent.filter(ch => ch.text.includes(nameLower)).length;
      return { ...char, chapterCount: count };
    });

    const primary = withCounts.filter(c => getTier(c) === 'primary').sort((a, b) => b.chapterCount - a.chapterCount);
    const secondary = withCounts.filter(c => getTier(c) === 'secondary').sort((a, b) => a.name.localeCompare(b.name));
    const minor = withCounts.filter(c => getTier(c) === 'minor').sort((a, b) => a.name.localeCompare(b.name));

    return [
      { id: 'primary', name: 'Primary Characters', characters: primary },
      { id: 'secondary', name: 'Secondary Characters', characters: secondary },
      { id: 'minor', name: 'Minor / Mentioned', characters: minor },
    ];
  }, [characters, chaptersContent, getTier]);

  const getInitialColor = useCallback((name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return INITIAL_COLORS[Math.abs(hash) % INITIAL_COLORS.length];
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, charId: string) => {
    e.dataTransfer.setData('text/plain', charId);
    setDraggingId(charId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverTier(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, tierId: string) => {
    e.preventDefault();
    setDragOverTier(tierId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTier(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, tierId: string) => {
    e.preventDefault();
    setDragOverTier(null);
    setDraggingId(null);
    const charId = e.dataTransfer.getData('text/plain');
    if (!charId || !activeProjectId) return;
    const char = characters.find(c => c.id === charId);
    if (!char) return;
    updateWorldEntry(activeProjectId, charId, { fields: { ...char.fields, tierOverride: tierId } });
  }, [activeProjectId, characters, updateWorldEntry]);

  const handlePromote = useCallback((char: WorldEntry & { chapterCount: number }) => {
    if (!activeProjectId) return;
    const current = getTier(char);
    const newTier = current === 'minor' ? 'secondary' : current === 'secondary' ? 'primary' : 'primary';
    updateWorldEntry(activeProjectId, char.id, { fields: { ...char.fields, tierOverride: newTier } });
  }, [activeProjectId, getTier, updateWorldEntry]);

  const handleDemote = useCallback((char: WorldEntry & { chapterCount: number }) => {
    if (!activeProjectId) return;
    const current = getTier(char);
    const newTier = current === 'primary' ? 'secondary' : current === 'secondary' ? 'minor' : 'minor';
    updateWorldEntry(activeProjectId, char.id, { fields: { ...char.fields, tierOverride: newTier } });
  }, [activeProjectId, getTier, updateWorldEntry]);

  const handleResetTier = useCallback((char: WorldEntry) => {
    if (!activeProjectId) return;
    const newFields = { ...char.fields };
    delete newFields.tierOverride;
    updateWorldEntry(activeProjectId, char.id, { fields: newFields });
  }, [activeProjectId, updateWorldEntry]);

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
            {characters.length} character{characters.length !== 1 ? 's' : ''} | Drag to rearrange tiers
          </p>
        </div>
      </div>

      {/* Tiers */}
      {tieredCharacters.map(tier => {
        const isPrimary = tier.id === 'primary';
        const isMinor = tier.id === 'minor';
        const cardSize = isPrimary ? 200 : isMinor ? 160 : 170;
        const portraitSize = isPrimary ? 80 : isMinor ? 40 : 60;
        const isDropTarget = dragOverTier === tier.id;

        return (
          <div
            key={tier.id}
            onDragOver={(e) => handleDragOver(e, tier.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, tier.id)}
            style={{
              marginBottom: 32,
              padding: 16,
              borderRadius: 12,
              border: isDropTarget ? '2px dashed var(--accent-gold)' : '2px dashed transparent',
              background: isDropTarget ? 'rgba(212,173,74,0.05)' : 'transparent',
              transition: 'all 0.2s',
              minHeight: 80,
            }}
          >
            {/* Tier header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, var(--accent-gold), transparent)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {tier.name} ({tier.characters.length})
              </span>
              <div style={{ height: 1, flex: 1, background: 'linear-gradient(90deg, transparent, var(--accent-gold))' }} />
            </div>

            {tier.characters.length === 0 && (
              <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>
                Drop characters here
              </div>
            )}

            {/* Cards grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: isMinor ? 8 : 16 }}>
              {tier.characters.map(char => {
                const status = (char.fields?.status as string) || 'Unknown';
                const statusColor = STATUS_COLORS[status] || STATUS_COLORS.Unknown;
                const portrait = char.fields?.portrait as string | undefined;
                const role = (char.fields?.class as string) || (char.fields?.race as string) || '';
                const isExpanded = expandedId === char.id;
                const hasOverride = !!char.fields?.tierOverride;
                const isDragging = draggingId === char.id;

                return (
                  <div key={char.id} style={{ width: isMinor ? 'auto' : cardSize }}>
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, char.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setExpandedId(isExpanded ? null : char.id)}
                      style={{
                        position: 'relative',
                        background: 'var(--bg-secondary)',
                        border: isExpanded ? '1px solid var(--accent-gold)' : '1px solid rgba(212,173,74,0.2)',
                        borderRadius: isMinor ? 20 : 12,
                        padding: isMinor ? '6px 14px' : 16,
                        cursor: 'grab',
                        transition: 'all 0.2s',
                        textAlign: isMinor ? 'left' : 'center',
                        opacity: isDragging ? 0.5 : 1,
                        boxShadow: isExpanded ? '0 4px 20px rgba(212,173,74,0.15)' : '0 2px 8px rgba(45,36,24,0.08)',
                        display: isMinor ? 'flex' : 'block',
                        alignItems: isMinor ? 'center' : undefined,
                        gap: isMinor ? 8 : undefined,
                      }}
                    >
                      {/* Pin icon for manual override */}
                      {hasOverride && (
                        <div
                          onClick={(e) => { e.stopPropagation(); handleResetTier(char); }}
                          title="Manually pinned - click to reset"
                          style={{ position: 'absolute', top: 4, left: 6, fontSize: 10, cursor: 'pointer', color: 'var(--accent-gold)' }}
                        >{String.fromCodePoint(0x1F4CC)}</div>
                      )}

                      {/* Hover action buttons */}
                      <div className="char-actions" style={{
                        position: 'absolute', top: 6, right: 6,
                        display: 'flex', gap: 4,
                        opacity: 0, transition: 'opacity 0.2s',
                      }}>
                        {tier.id !== 'primary' && (
                          <button onClick={(e) => { e.stopPropagation(); handlePromote(char); }} title="Promote"
                            style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(212,173,74,0.8)', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {String.fromCodePoint(0x2191)}
                          </button>
                        )}
                        {tier.id !== 'minor' && (
                          <button onClick={(e) => { e.stopPropagation(); handleDemote(char); }} title="Demote"
                            style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', background: 'rgba(212,173,74,0.8)', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {String.fromCodePoint(0x2193)}
                          </button>
                        )}
                      </div>

                      {/* Portrait */}
                      <div style={{
                        width: portraitSize, height: portraitSize, borderRadius: '50%',
                        margin: isMinor ? '0' : '0 auto 12px',
                        background: portrait ? 'none' : getInitialColor(char.name),
                        backgroundImage: portrait ? `url(${portrait})` : 'none',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: isPrimary ? 28 : isMinor ? 16 : 22, fontWeight: 700,
                        border: isMinor ? 'none' : '2px solid rgba(212,173,74,0.3)',
                        flexShrink: 0,
                      }}>
                        {!portrait && char.name[0]}
                      </div>

                      {/* Name + info */}
                      {isMinor ? (
                        <>
                          <span style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: 13 }}>{char.name}</span>
                          {char.chapterCount > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ch.{char.chapterCount}</span>}
                        </>
                      ) : (
                        <>
                          <div style={{ fontFamily: "'Cinzel', serif", fontSize: isPrimary ? 15 : 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                            {char.name}
                          </div>
                          {role && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>{role}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: statusColor, fontWeight: 600 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                              {status}
                            </span>
                            {char.chapterCount > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{char.chapterCount} ch.</span>}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div style={{
                        marginTop: 8, padding: 14, borderRadius: 8,
                        background: 'var(--bg-primary)',
                        borderLeft: '3px solid var(--accent-gold)',
                        border: '1px solid rgba(212,173,74,0.12)',
                        fontSize: 12, color: 'var(--text-secondary)',
                        textAlign: 'left', animation: 'fadeIn 0.2s ease',
                      }}>
                        {char.fields?.description && (
                          <p style={{ margin: '0 0 10px', lineHeight: 1.6, fontSize: 13 }}>{String(char.fields.description)}</p>
                        )}
                        {char.fields?.personality && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Personality</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {String(char.fields.personality).split(/[,;\n]/).filter(Boolean).map((trait, i) => (
                                <span key={i} style={{
                                  padding: '2px 8px', borderRadius: 10, fontSize: 10,
                                  background: `${TAG_COLORS[i % TAG_COLORS.length]}22`,
                                  color: TAG_COLORS[i % TAG_COLORS.length],
                                  border: `1px solid ${TAG_COLORS[i % TAG_COLORS.length]}44`,
                                }}>{trait.trim()}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {char.fields?.backstory && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Backstory</div>
                            <p style={{ margin: 0, lineHeight: 1.5, fontStyle: 'italic' }}>{String(char.fields.backstory)}</p>
                          </div>
                        )}
                        {char.fields?.goals && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Goals</div>
                            <p style={{ margin: 0, lineHeight: 1.5 }}>{String(char.fields.goals)}</p>
                          </div>
                        )}
                        {char.fields?.relationships && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Relationships</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {String(char.fields.relationships).split(/[,;\n]/).filter(Boolean).map((rel, i) => (
                                <span key={i} style={{
                                  padding: '2px 8px', borderRadius: 10, fontSize: 10,
                                  background: 'rgba(167,139,250,0.1)', color: '#a78bfa',
                                  border: '1px solid rgba(167,139,250,0.3)',
                                }}>{rel.trim()}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {char.fields?.abilities && (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-gold)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Abilities</div>
                            <p style={{ margin: 0, lineHeight: 1.5 }}>{String(char.fields.abilities)}</p>
                          </div>
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

      {/* Inline styles for hover effect */}
      <style>{`
        [draggable]:hover .char-actions { opacity: 1 !important; }
        [draggable]:active { cursor: grabbing !important; }
      `}</style>
    </div>
  );
}
