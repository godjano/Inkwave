'use client';

import { useStore } from '@/lib/store';
import { Chapter } from '@/lib/types';
import React, { useState, useCallback, useMemo } from 'react';

const statusConfig: Record<Chapter['status'], { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'var(--text-secondary)', bg: 'var(--bg-tertiary)' },
  outline: { label: 'Outline', color: 'var(--accent-blue)', bg: 'rgba(91,141,184,0.15)' },
  revised: { label: 'Revised', color: 'var(--accent-gold)', bg: 'rgba(212,168,83,0.15)' },
  final: { label: 'Final', color: 'var(--accent-green)', bg: 'rgba(39,174,96,0.15)' },
};

interface ChapterRowProps {
  chapter: Chapter;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSummaryChange: (value: string) => void;
  isFirst: boolean;
  isLast: boolean;
}

function ChapterRow({
  chapter,
  index,
  isExpanded,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onSummaryChange,
  isFirst,
  isLast,
}: ChapterRowProps) {
  const status = statusConfig[chapter.status];

  return (
    <div
      className="animate-fade-in"
      style={{
        borderBottom: '1px solid var(--border-color)',
        background: isExpanded ? 'var(--bg-tertiary)' : 'transparent',
        transition: 'background 0.2s',
      }}
    >
      {/* Main row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          cursor: 'pointer',
          minHeight: 52,
        }}
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand(); } }}
      >
        {/* Reorder buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            flexShrink: 0,
          }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="inkweave-btn"
            disabled={isFirst}
            onClick={onMoveUp}
            aria-label="Move chapter up"
            style={{
              padding: '2px 6px',
              fontSize: 11,
              lineHeight: 1,
              opacity: isFirst ? 0.3 : 0.6,
              cursor: isFirst ? 'not-allowed' : 'pointer',
            }}
          >
            ▲
          </button>
          <button
            className="inkweave-btn"
            disabled={isLast}
            onClick={onMoveDown}
            aria-label="Move chapter down"
            style={{
              padding: '2px 6px',
              fontSize: 11,
              lineHeight: 1,
              opacity: isLast ? 0.3 : 0.6,
              cursor: isLast ? 'not-allowed' : 'pointer',
            }}
          >
            ▼
          </button>
        </div>

        {/* Expand/collapse chevron */}
        <span
          style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            transition: 'transform 0.2s',
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            flexShrink: 0,
            width: 16,
            textAlign: 'center',
          }}
        >
          ›
        </span>

        {/* Chapter number */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--accent-gold-dim)',
            minWidth: 80,
            flexShrink: 0,
          }}
        >
          Ch. {index + 1}
        </span>

        {/* Title */}
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {chapter.title}
        </span>

        {/* Status badge */}
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
            flexShrink: 0,
          }}
        >
          {status.label}
        </span>

        {/* Word count */}
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            minWidth: 70,
            textAlign: 'right',
            flexShrink: 0,
          }}
        >
          {chapter.wordCount.toLocaleString()} words
        </span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div
          style={{
            padding: '0 16px 16px 16px',
            paddingLeft: 72, // Align with content after chevron + number
          }}
        >
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-muted)',
              display: 'block',
              marginBottom: 6,
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            Chapter Summary
          </label>
          <textarea
            className="inkweave-input"
            value={chapter.summary}
            onChange={e => onSummaryChange(e.target.value)}
            placeholder="Write a summary for this chapter..."
            rows={4}
            style={{
              resize: 'vertical',
              minHeight: 80,
              lineHeight: 1.6,
              fontSize: 13,
            }}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
          />
          {/* Metadata row */}
          <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
            {chapter.pov && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-muted)' }}>POV:</span> {chapter.pov}
              </div>
            )}
            {chapter.location && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Location:</span> {chapter.location}
              </div>
            )}
            {chapter.timelineEvent && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Timeline:</span> {chapter.timelineEvent}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OutlineView() {
  const project = useStore(s => {
    const pid = s.activeProjectId;
    return pid ? s.projects.find(p => p.id === pid) : undefined;
  });
  const updateChapter = useStore(s => s.updateChapter);
  const reorderChapters = useStore(s => s.reorderChapters);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const chapters = useMemo(() => {
    if (!project) return [];
    return [...project.chapters].sort((a, b) => a.order - b.order);
  }, [project?.chapters]);

  const totalWords = useMemo(
    () => chapters.reduce((sum, c) => sum + c.wordCount, 0),
    [chapters]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedIds(new Set(chapters.map(c => c.id)));
  }, [chapters]);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const handleSummaryChange = useCallback(
    (chapterId: string, value: string) => {
      if (project) {
        updateChapter(project.id, chapterId, { summary: value });
      }
    },
    [project, updateChapter]
  );

  const handleMoveUp = useCallback(
    (currentIndex: number) => {
      if (currentIndex === 0 || !project) return;
      const ids = chapters.map(c => c.id);
      const temp = ids[currentIndex];
      ids[currentIndex] = ids[currentIndex - 1];
      ids[currentIndex - 1] = temp;
      reorderChapters(project.id, ids);
    },
    [project, chapters, reorderChapters]
  );

  const handleMoveDown = useCallback(
    (currentIndex: number) => {
      if (currentIndex >= chapters.length - 1 || !project) return;
      const ids = chapters.map(c => c.id);
      const temp = ids[currentIndex];
      ids[currentIndex] = ids[currentIndex + 1];
      ids[currentIndex + 1] = temp;
      reorderChapters(project.id, ids);
    },
    [project, chapters, reorderChapters]
  );

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
        <p>No project selected</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Outline
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} &middot;{' '}
            {totalWords.toLocaleString()} words total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="inkweave-btn" onClick={expandAll} style={{ fontSize: 12, padding: '6px 12px' }}>
            Expand All
          </button>
          <button className="inkweave-btn" onClick={collapseAll} style={{ fontSize: 12, padding: '6px 12px' }}>
            Collapse All
          </button>
        </div>
      </div>

      {/* Chapter list */}
      {chapters.length === 0 ? (
        <div className="flex flex-col items-center justify-center" style={{ padding: '60px 0' }}>
          <div style={{ fontSize: 48, opacity: 0.3 }}>📝</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 12 }}>
            No chapters yet. Create your first chapter from the sidebar.
          </p>
        </div>
      ) : (
        <div
          className="inkweave-card"
          style={{
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {chapters.map((chapter, index) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              index={index}
              isExpanded={expandedIds.has(chapter.id)}
              onToggleExpand={() => toggleExpand(chapter.id)}
              onMoveUp={() => handleMoveUp(index)}
              onMoveDown={() => handleMoveDown(index)}
              onSummaryChange={value => handleSummaryChange(chapter.id, value)}
              isFirst={index === 0}
              isLast={index === chapters.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
