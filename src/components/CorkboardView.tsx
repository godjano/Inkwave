'use client';

import React, { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Chapter, WorldEntry } from '@/lib/types';

/* ════════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════════ */

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function findCharacterMentions(chapters: Chapter[], characters: WorldEntry[]): Map<string, number[]> {
  const mentions = new Map<string, number[]>();
  for (const char of characters) {
    const name = char.name.toLowerCase();
    const chaptersWithMention: number[] = [];
    chapters.forEach((ch, idx) => {
      const text = (ch.content || '').replace(/<[^>]*>/g, '').toLowerCase();
      if (name.length > 1 && text.includes(name)) chaptersWithMention.push(idx);
    });
    mentions.set(char.name, chaptersWithMention);
  }
  return mentions;
}

/* ── Status colour map ── */
const STATUS_COLORS: Record<string, string> = {
  draft: '#a09484',
  writing: '#4a78a0',
  revised: '#d4a030',
  final: '#4a8058',
  outline: '#7a58a0',
};

/* ── Deterministic pseudo-random rotation per chapter ── */
function cardRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return ((hash % 200) / 100) - 1; // -1 to 1
}

/* ════════════════════════════════════════════════════════════════
   Corkboard Card
   ════════════════════════════════════════════════════════════════ */

interface CorkboardCardProps {
  chapter: Chapter;
  index: number;
  charMentionCount: number;
  onClick: () => void;
}

function CorkboardCard({ chapter, index, charMentionCount, onClick }: CorkboardCardProps) {
  const rotation = cardRotation(chapter.id);
  const preview = stripHtml(chapter.content || '').slice(0, 100);
  const statusColor = STATUS_COLORS[chapter.status] || '#a09484';

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Chapter ${index + 1}: ${chapter.title}`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{
        background: '#faf6ee',
        border: '1px solid rgba(150,120,36,0.2)',
        boxShadow: '2px 3px 8px rgba(0,0,0,0.1)',
        borderRadius: 2,
        padding: 16,
        cursor: 'pointer',
        transform: `rotate(${rotation}deg)`,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = `rotate(0deg) translateY(-4px)`;
        (e.currentTarget as HTMLElement).style.boxShadow = '4px 6px 16px rgba(0,0,0,0.18)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = `rotate(${rotation}deg)`;
        (e.currentTarget as HTMLElement).style.boxShadow = '2px 3px 8px rgba(0,0,0,0.1)';
      }}
    >
      {/* Pin */}
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 40%, #e8c84a, #b8912e)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          margin: '-8px auto 8px',
          position: 'relative',
          top: -4,
        }}
      />

      {/* Chapter number + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#8a7e6e',
            background: 'rgba(150,120,36,0.08)',
            padding: '1px 5px',
            borderRadius: 2,
            flexShrink: 0,
          }}
        >
          Ch {index + 1}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#3a3020',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={chapter.title}
        >
          {chapter.title}
        </span>
      </div>

      {/* Status badge + word count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: 0.5,
            color: '#fff',
            background: statusColor,
            padding: '1px 6px',
            borderRadius: 2,
          }}
        >
          {chapter.status}
        </span>
        <span style={{ fontSize: 10, color: '#8a7e6e' }}>
          {chapter.wordCount.toLocaleString()} words
        </span>
      </div>

      {/* POV + Location */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
        {chapter.pov && (
          <div style={{ fontSize: 10, color: '#6a6050' }}>
            <span style={{ fontWeight: 600 }}>POV:</span> {chapter.pov}
          </div>
        )}
        {chapter.location && (
          <div style={{ fontSize: 10, color: '#6a6050' }}>
            <span style={{ fontWeight: 600 }}>Location:</span> {chapter.location}
          </div>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div
          style={{
            fontSize: 11,
            color: '#7a7060',
            lineHeight: 1.4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            borderTop: '1px solid rgba(150,120,36,0.1)',
            paddingTop: 6,
            marginTop: 'auto',
          }}
        >
          {preview}...
        </div>
      )}

      {/* Character mentions */}
      {charMentionCount > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 6,
            fontSize: 9,
            color: '#8a7e6e',
            background: 'rgba(150,120,36,0.1)',
            padding: '1px 5px',
            borderRadius: 2,
          }}
          title={`${charMentionCount} character(s) mentioned`}
        >
          {charMentionCount} character{charMentionCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Expanded Card Modal
   ════════════════════════════════════════════════════════════════ */

interface ExpandedCardProps {
  chapter: Chapter;
  index: number;
  charMentionCount: number;
  onClose: () => void;
}

function ExpandedCard({ chapter, index, charMentionCount, onClose }: ExpandedCardProps) {
  const fullPreview = stripHtml(chapter.content || '').slice(0, 500);
  const statusColor = STATUS_COLORS[chapter.status] || '#a09484';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#faf6ee',
          border: '1px solid rgba(150,120,36,0.3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          borderRadius: 4,
          padding: 24,
          maxWidth: 480,
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#8a7e6e',
            fontSize: 18,
            lineHeight: 1,
          }}
          aria-label="Close"
        >
          ✕
        </button>

        {/* Pin */}
        <div
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 40%, #e8c84a, #b8912e)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            margin: '-4px auto 12px',
          }}
        />

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#8a7e6e',
              background: 'rgba(150,120,36,0.08)',
              padding: '2px 8px',
              borderRadius: 2,
            }}
          >
            Chapter {index + 1}
          </span>
          <h3 style={{ margin: '8px 0 4px', fontSize: 18, fontWeight: 700, color: '#3a3020' }}>
            {chapter.title}
          </h3>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: 0.5,
                color: '#fff',
                background: statusColor,
                padding: '2px 8px',
                borderRadius: 2,
              }}
            >
              {chapter.status}
            </span>
            <span style={{ fontSize: 12, color: '#8a7e6e' }}>
              {chapter.wordCount.toLocaleString()} words
            </span>
            {charMentionCount > 0 && (
              <span style={{ fontSize: 11, color: '#8a7e6e' }}>
                &middot; {charMentionCount} character{charMentionCount > 1 ? 's' : ''} mentioned
              </span>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {chapter.pov && (
            <div style={{ fontSize: 12, color: '#6a6050' }}>
              <span style={{ fontWeight: 600 }}>POV Character:</span> {chapter.pov}
            </div>
          )}
          {chapter.location && (
            <div style={{ fontSize: 12, color: '#6a6050' }}>
              <span style={{ fontWeight: 600 }}>Location:</span> {chapter.location}
            </div>
          )}
          {chapter.timelineEvent && (
            <div style={{ fontSize: 12, color: '#6a6050' }}>
              <span style={{ fontWeight: 600 }}>Timeline Event:</span> {chapter.timelineEvent}
            </div>
          )}
        </div>

        {/* Full preview */}
        {fullPreview && (
          <div
            style={{
              fontSize: 12,
              color: '#5a5040',
              lineHeight: 1.7,
              borderTop: '1px solid rgba(150,120,36,0.15)',
              paddingTop: 12,
            }}
          >
            {fullPreview}
            {stripHtml(chapter.content || '').length > 500 ? '...' : ''}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Character Threads Sidebar
   ════════════════════════════════════════════════════════════════ */

interface CharacterThreadsProps {
  characters: WorldEntry[];
  mentions: Map<string, number[]>;
  totalChapters: number;
}

function CharacterThreads({ characters, mentions, totalChapters }: CharacterThreadsProps) {
  const [expandedChar, setExpandedChar] = useState<string | null>(null);

  if (characters.length === 0) {
    return (
      <div style={{ padding: 16, color: '#8a7e6e', fontSize: 12, textAlign: 'center' }}>
        No characters in World Bible yet.<br />
        Add characters to track their appearances.
      </div>
    );
  }

  // Sort characters: ones missing for 3+ chapters first (warned)
  const sorted = [...characters].sort((a, b) => {
    const aChaps = mentions.get(a.name) || [];
    const bChaps = mentions.get(b.name) || [];
    const aLast = aChaps.length > 0 ? aChaps[aChaps.length - 1] : -1;
    const bLast = bChaps.length > 0 ? bChaps[bChaps.length - 1] : -1;
    const aMissing = totalChapters - 1 - aLast >= 3;
    const bMissing = totalChapters - 1 - bLast >= 3;
    if (aMissing && !bMissing) return -1;
    if (!aMissing && bMissing) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{ maxHeight: '100%', overflow: 'auto', padding: '0 4px' }}>
      {sorted.map((char) => {
        const charChapters = mentions.get(char.name) || [];
        const lastAppearance = charChapters.length > 0 ? charChapters[charChapters.length - 1] : -1;
        const chaptersSinceLast = totalChapters - 1 - lastAppearance;
        const isMissing = charChapters.length > 0 && chaptersSinceLast >= 3;
        const neverAppeared = charChapters.length === 0;
        const isExpanded = expandedChar === char.name;

        return (
          <div key={char.id}>
            <button
              onClick={() => setExpandedChar(isExpanded ? null : char.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '8px 10px',
                background: isExpanded ? 'rgba(150,120,36,0.08)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid rgba(150,120,36,0.1)',
                cursor: 'pointer',
                color: isMissing || neverAppeared ? '#a04040' : '#5a5040',
                fontSize: 12,
                fontWeight: 500,
                textAlign: 'left' as const,
                transition: 'background 0.15s',
              }}
              title={
                neverAppeared
                  ? 'Never mentioned in any chapter'
                  : isMissing
                    ? `Missing for ${chaptersSinceLast} chapter(s)`
                    : `Appears in ${charChapters.length} chapter(s)`
              }
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                {(isMissing || neverAppeared) && (
                  <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {char.name}
                </span>
              </span>
              <span style={{ fontSize: 9, flexShrink: 0, color: '#8a7e6e' }}>
                {charChapters.length}/{totalChapters}
              </span>
            </button>

            {/* Expanded: show chapter bar */}
            {isExpanded && totalChapters > 0 && (
              <div style={{ padding: '6px 10px 10px', background: 'rgba(150,120,36,0.04)' }}>
                <div
                  style={{
                    display: 'flex',
                    gap: 3,
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
                >
                  {Array.from({ length: totalChapters }, (_, i) => {
                    const isMentioned = charChapters.includes(i);
                    return (
                      <div
                        key={i}
                        title={`Chapter ${i + 1}${isMentioned ? ' (mentioned)' : ''}`}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 2,
                          background: isMentioned ? '#4a8058' : 'rgba(150,120,36,0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 7,
                          color: isMentioned ? '#fff' : '#8a7e6e',
                          fontWeight: 600,
                        }}
                      >
                        {i + 1}
                      </div>
                    );
                  })}
                </div>
                {isMissing && (
                  <div style={{ fontSize: 10, color: '#a04040', marginTop: 4 }}>
                    Missing for {chaptersSinceLast} chapter{chaptersSinceLast !== 1 ? 's' : ''}
                  </div>
                )}
                {neverAppeared && (
                  <div style={{ fontSize: 10, color: '#a04040', marginTop: 4 }}>
                    Never appeared in any chapter
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Timeline View
   ════════════════════════════════════════════════════════════════ */

interface TimelineViewProps {
  chapters: Chapter[];
  onChapterClick: (chapterId: string) => void;
}

function TimelineViewInner({ chapters, onChapterClick }: TimelineViewProps) {
  if (chapters.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a7e6e', fontSize: 14 }}>
        No chapters yet. Create your first chapter to see the timeline.
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'auto',
        padding: '30px 40px 40px',
        background: 'linear-gradient(135deg, #d4c4a0, #c8b88a, #d0c090)',
      }}
    >
      {/* Milestones row (above the line) */}
      <div style={{ position: 'relative', minHeight: 200, minWidth: chapters.length * 140 }}>
        {/* Horizontal line */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 3,
            background: 'var(--accent-gold-dim, #b8912e)',
            borderRadius: 2,
            opacity: 0.6,
          }}
        />

        {/* Chapter nodes */}
        {chapters.map((chapter, idx) => {
          const statusColor = STATUS_COLORS[chapter.status] || '#a09484';
          const x = idx * 140 + 70;

          return (
            <div
              key={chapter.id}
              style={{
                position: 'absolute',
                left: x,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 120,
              }}
            >
              {/* Timeline event label (above) */}
              {chapter.timelineEvent && (
                <div
                  style={{
                    position: 'absolute',
                    top: -70,
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#5a3e28',
                    background: 'rgba(255,255,255,0.85)',
                    padding: '2px 8px',
                    borderRadius: 3,
                    border: '1px solid rgba(150,120,36,0.25)',
                    whiteSpace: 'nowrap',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  }}
                  title={chapter.timelineEvent}
                >
                  {chapter.timelineEvent}
                </div>
              )}

              {/* Milestone connector */}
              {chapter.timelineEvent && (
                <div
                  style={{
                    position: 'absolute',
                    top: -42,
                    width: 1,
                    height: 18,
                    background: 'rgba(150,120,36,0.4)',
                  }}
                />
              )}

              {/* Node circle */}
              <button
                onClick={() => onChapterClick(chapter.id)}
                title={`Go to Chapter ${idx + 1}: ${chapter.title}`}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: statusColor,
                  border: '2px solid rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  zIndex: 2,
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.4)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
                }}
              />

              {/* Label below */}
              <div
                style={{
                  position: 'absolute',
                  top: 26,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#5a3e28',
                    marginBottom: 2,
                  }}
                >
                  Ch {idx + 1}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: '#3a3020',
                    maxWidth: 110,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={chapter.title}
                >
                  {chapter.title}
                </div>
                <div style={{ fontSize: 9, color: '#7a7060', marginTop: 2 }}>
                  {chapter.wordCount.toLocaleString()}w
                </div>
                {(chapter.pov || chapter.location) && (
                  <div style={{ fontSize: 8, color: '#8a7e6e', marginTop: 1 }}>
                    {chapter.pov && <span>👤 {chapter.pov}</span>}
                    {chapter.pov && chapter.location && <span> · </span>}
                    {chapter.location && <span>📍 {chapter.location}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   Main CorkboardView Component
   ════════════════════════════════════════════════════════════════ */

type SubView = 'corkboard' | 'timeline';

export default function CorkboardView() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const projects = useStore((s) => s.projects);
  const setActiveChapter = useStore((s) => s.setActiveChapter);
  const setEditorMode = useStore((s) => s.setEditorMode);

  const [subView, setSubView] = useState<SubView>('corkboard');
  const [expandedChapter, setExpandedChapter] = useState<Chapter | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number>(0);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId),
    [projects, activeProjectId]
  );

  const sortedChapters = useMemo(
    () => (activeProject?.chapters || []).sort((a, b) => a.order - b.order),
    [activeProject]
  );

  const characters = useMemo(
    () => (activeProject?.worldBible || []).filter((e) => e.category === 'characters'),
    [activeProject]
  );

  const mentions = useMemo(
    () => findCharacterMentions(sortedChapters, characters),
    [sortedChapters, characters]
  );

  const charMentionCountPerChapter = useMemo(() => {
    const counts = new Map<string, number>();
    for (const chapter of sortedChapters) {
      let count = 0;
      for (const [, chs] of mentions) {
        if (chs.includes(sortedChapters.indexOf(chapter))) count++;
      }
      counts.set(chapter.id, count);
    }
    return counts;
  }, [sortedChapters, mentions]);

  const handleCardClick = (chapter: Chapter, index: number) => {
    setExpandedChapter(chapter);
    setExpandedIndex(index);
  };

  const handleTimelineClick = (chapterId: string) => {
    setActiveChapter(chapterId);
    setEditorMode('write');
  };

  const emptyState = sortedChapters.length === 0 && (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8a7e6e',
        gap: 12,
        textAlign: 'center',
        padding: 40,
      }}
    >
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#b0a490" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#7a6e5e' }}>Your Corkboard is Empty</div>
      <div style={{ fontSize: 13, maxWidth: 320, lineHeight: 1.5 }}>
        Create chapters and start writing to see your story visually mapped out. Track character threads, spot pacing issues, and plan your narrative.
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#c8b88a' }}>
      {/* ── Tab bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '0 16px',
          height: 38,
          background: 'rgba(90,70,40,0.15)',
          borderBottom: '1px solid rgba(90,70,40,0.2)',
          flexShrink: 0,
        }}
      >
        {(['corkboard', 'timeline'] as SubView[]).map((view) => (
          <button
            key={view}
            onClick={() => setSubView(view)}
            style={{
              padding: '6px 16px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'Georgia', serif",
              letterSpacing: 0.5,
              textTransform: 'uppercase' as const,
              color: subView === view ? '#5a3e28' : '#8a7e6e',
              background: subView === view ? 'rgba(255,255,255,0.6)' : 'transparent',
              border: subView === view ? '1px solid rgba(150,120,36,0.3)' : '1px solid transparent',
              borderBottom: subView === view ? '2px solid #b8912e' : '2px solid transparent',
              borderRadius: '4px 4px 0 0',
              cursor: 'pointer',
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {view === 'corkboard' ? '📋 Corkboard' : '📊 Timeline'}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#8a7e6e' }}>
          {sortedChapters.length} chapter{sortedChapters.length !== 1 ? 's' : ''} · {characters.length} character{characters.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Content area ── */}
      {subView === 'corkboard' ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Corkboard grid */}
          <div
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #d4c4a0, #c8b88a, #d0c090)',
              padding: 24,
              overflow: 'auto',
            }}
          >
            {emptyState || (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: 20,
                  maxWidth: 960,
                }}
              >
                {sortedChapters.map((chapter, idx) => (
                  <CorkboardCard
                    key={chapter.id}
                    chapter={chapter}
                    index={idx}
                    charMentionCount={charMentionCountPerChapter.get(chapter.id) || 0}
                    onClick={() => handleCardClick(chapter, idx)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Character Threads Sidebar */}
          {characters.length > 0 && (
            <div
              style={{
                width: 220,
                background: 'rgba(250,246,238,0.92)',
                borderLeft: '1px solid rgba(150,120,36,0.2)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid rgba(150,120,36,0.15)',
                  flexShrink: 0,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#5a3e28', fontFamily: "'Georgia', serif" }}>
                  Character Threads
                </div>
                <div style={{ fontSize: 9, color: '#8a7e6e', marginTop: 2 }}>
                  ⚠ = Missing 3+ chapters
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto' }}>
                <CharacterThreads
                  characters={characters}
                  mentions={mentions}
                  totalChapters={sortedChapters.length}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <TimelineViewInner chapters={sortedChapters} onChapterClick={handleTimelineClick} />
      )}

      {/* Expanded card modal */}
      {expandedChapter && (
        <ExpandedCard
          chapter={expandedChapter}
          index={expandedIndex}
          charMentionCount={charMentionCountPerChapter.get(expandedChapter.id) || 0}
          onClose={() => setExpandedChapter(null)}
        />
      )}
    </div>
  );
}
