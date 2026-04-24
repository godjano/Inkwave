'use client';

import { useStore } from '@/lib/store';
import { Chapter } from '@/lib/types';
import React from 'react';

const statusConfig: Record<Chapter['status'], { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)' },
  outline: { label: 'Outline', color: 'var(--accent-blue)', bg: 'rgba(91,141,184,0.15)' },
  revised: { label: 'Revised', color: 'var(--accent-gold)', bg: 'rgba(212,168,83,0.15)' },
  final: { label: 'Final', color: 'var(--accent-green)', bg: 'rgba(39,174,96,0.15)' },
};

function formatWordCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

export default function GridView() {
  const project = useStore(s => {
    const pid = s.activeProjectId;
    return pid ? s.projects.find(p => p.id === pid) : undefined;
  });
  const setActiveChapter = useStore(s => s.setActiveChapter);
  const setEditorMode = useStore(s => s.setEditorMode);

  const chapters = React.useMemo(() => {
    if (!project) return [];
    return [...project.chapters].sort((a, b) => a.order - b.order);
  }, [project?.chapters]);

  const totalWords = React.useMemo(
    () => chapters.reduce((sum, c) => sum + c.wordCount, 0),
    [chapters]
  );

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
        <p>No project selected</p>
      </div>
    );
  }

  if (chapters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 animate-fade-in">
        <div
          style={{
            fontSize: 48,
            opacity: 0.3,
          }}
        >
          📖
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
          No chapters yet. Create your first chapter from the sidebar.
        </p>
      </div>
    );
  }

  const handleCardClick = (chapter: Chapter) => {
    setActiveChapter(chapter.id);
    setEditorMode('write');
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
              letterSpacing: '-0.01em',
            }}
          >
            Chapter Overview
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} &middot; {totalWords.toLocaleString()} words total
          </p>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {chapters.map((chapter, index) => {
          const status = statusConfig[chapter.status];
          const summaryPreview = chapter.summary
            ? chapter.summary.length > 120
              ? chapter.summary.slice(0, 120) + '...'
              : chapter.summary
            : null;
          const hasMetadata = chapter.pov || chapter.location || chapter.timelineEvent;

          return (
            <div
              key={chapter.id}
              onClick={() => handleCardClick(chapter)}
              className="inkweave-card"
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-gold-dim)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-lg)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              {/* Top accent line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: `linear-gradient(90deg, ${status.color}, transparent)`,
                  opacity: 0.6,
                }}
              />

              {/* Chapter number & status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--accent-gold-dim)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Chapter {index + 1}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 10px',
                    borderRadius: 999,
                    color: status.color,
                    background: status.bg,
                    border: `1px solid ${status.color}`,
                    opacity: 0.8,
                  }}
                >
                  {status.label}
                </span>
              </div>

              {/* Title */}
              <h3
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {chapter.title}
              </h3>

              {/* Summary preview */}
              {summaryPreview && (
                <p
                  style={{
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    margin: 0,
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {summaryPreview}
                </p>
              )}

              {/* Metadata pills */}
              {hasMetadata && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
                  {chapter.pov && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'rgba(160,120,48,0.15)',
                        color: 'var(--accent-gold)',
                        border: '1px solid rgba(160,120,48,0.3)',
                      }}
                    >
                      👤 {chapter.pov}
                    </span>
                  )}
                  {chapter.location && (
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: 'rgba(52,211,153,0.1)',
                        color: 'var(--accent-green)',
                        border: '1px solid rgba(52,211,153,0.2)',
                      }}
                    >
                      📍 {chapter.location}
                    </span>
                  )}
                </div>
              )}

              {/* Word count footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTop: '1px solid var(--border-color)',
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {formatWordCount(chapter.wordCount)} words
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--accent-gold-dim)',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                  className="grid-card-arrow"
                >
                  Open →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .inkweave-card:hover .grid-card-arrow {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
