'use client';

import { useStore } from '@/lib/store';
import { Chapter } from '@/lib/types';
import React, { useMemo } from 'react';

const statusColors: Record<Chapter['status'], string> = {
  draft: 'var(--text-muted)',
  outline: 'var(--accent-blue)',
  revised: 'var(--accent-gold)',
  final: 'var(--accent-green)',
};

export default function TimelineView() {
  const project = useStore(s => {
    const pid = s.activeProjectId;
    return pid ? s.projects.find(p => p.id === pid) : undefined;
  });
  const setActiveChapter = useStore(s => s.setActiveChapter);
  const setEditorMode = useStore(s => s.setEditorMode);

  const chapters = useMemo(() => {
    if (!project) return [];
    return [...project.chapters].sort((a, b) => a.order - b.order);
  }, [project?.chapters]);

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
        <div style={{ fontSize: 48, opacity: 0.3 }}>⏳</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
          No chapters yet. Create chapters and add timeline events to see them here.
        </p>
      </div>
    );
  }

  const handleNodeClick = (chapter: Chapter) => {
    setActiveChapter(chapter.id);
    setEditorMode('write');
  };

  return (
    <div className="animate-fade-in" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Timeline
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Chronological view of your story events
        </p>
      </div>

      {/* Timeline */}
      <div
        style={{
          position: 'relative',
          paddingLeft: 40,
          maxWidth: 700,
        }}
      >
        {/* Vertical line */}
        <div
          style={{
            position: 'absolute',
            left: 15,
            top: 8,
            bottom: 8,
            width: 2,
            background: 'linear-gradient(180deg, var(--accent-gold-dim), var(--border-color), var(--accent-gold-dim))',
            borderRadius: 1,
          }}
        />

        {chapters.map((chapter, index) => {
          const statusColor = statusColors[chapter.status];
          const hasEvent = !!chapter.timelineEvent;
          const hasMeta = chapter.pov || chapter.location;
          const isLast = index === chapters.length - 1;

          return (
            <div
              key={chapter.id}
              style={{
                position: 'relative',
                paddingBottom: isLast ? 0 : 32,
              }}
            >
              {/* Node circle */}
              <div
                onClick={() => handleNodeClick(chapter)}
                role="button"
                tabIndex={0}
                aria-label={`Chapter ${index + 1}: ${chapter.title}`}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNodeClick(chapter); } }}
                style={{
                  position: 'absolute',
                  left: -33,
                  top: 4,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: hasEvent ? 'var(--bg-primary)' : 'var(--bg-tertiary)',
                  border: `2px solid ${hasEvent ? statusColor : 'var(--border-light)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  zIndex: 1,
                  boxShadow: hasEvent
                    ? `0 0 0 3px ${statusColor}33`
                    : 'none',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.2)';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 4px ${statusColor}44`;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  (e.currentTarget as HTMLElement).style.boxShadow = hasEvent
                    ? `0 0 0 3px ${statusColor}33`
                    : 'none';
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: hasEvent ? statusColor : 'var(--border-light)',
                  }}
                />
              </div>

              {/* Content card */}
              <div
                onClick={() => handleNodeClick(chapter)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleNodeClick(chapter); } }}
                style={{
                  marginLeft: 16,
                  padding: '16px 20px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-gold-dim)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)';
                }}
              >
                {/* Chapter number */}
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--accent-gold-dim)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Chapter {index + 1}
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: '0 0 8px 0',
                  }}
                >
                  {chapter.title}
                </h3>

                {/* Timeline event */}
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: hasEvent ? 'var(--text-secondary)' : 'var(--text-muted)',
                    fontStyle: hasEvent ? 'normal' : 'italic',
                    marginBottom: hasMeta ? 10 : 0,
                  }}
                >
                  {hasEvent ? chapter.timelineEvent : 'No timeline event set'}
                </div>

                {/* Metadata */}
                {hasMeta && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      flexWrap: 'wrap',
                      paddingTop: 10,
                      borderTop: '1px solid var(--border-color)',
                    }}
                  >
                    {chapter.pov && (
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--accent-gold)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 13 }}>👤</span>
                        {chapter.pov}
                      </span>
                    )}
                    {chapter.location && (
                      <span
                        style={{
                          fontSize: 12,
                          color: 'var(--accent-green)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 13 }}>📍</span>
                        {chapter.location}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span style={{ fontSize: 13 }}>📝</span>
                      {chapter.wordCount.toLocaleString()} words
                    </span>
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
