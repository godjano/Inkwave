'use client';

import { useStore } from '@/lib/store';
import React, { useMemo, useCallback, useEffect } from 'react';

export default function ReadingMode() {
  const project = useStore(s => {
    const pid = s.activeProjectId;
    return pid ? s.projects.find(p => p.id === pid) : undefined;
  });
  const activeChapterId = useStore(s => s.activeChapterId);
  const setActiveChapter = useStore(s => s.setActiveChapter);

  const chapters = useMemo(() => {
    if (!project) return [];
    return [...project.chapters].sort((a, b) => a.order - b.order);
  }, [project?.chapters]);

  const activeIndex = useMemo(
    () => chapters.findIndex(c => c.id === activeChapterId),
    [chapters, activeChapterId]
  );

  const currentChapter = activeIndex >= 0 ? chapters[activeIndex] : chapters[0] ?? null;

  const goToChapter = useCallback(
    (id: string) => {
      setActiveChapter(id);
    },
    [setActiveChapter]
  );

  const goNext = useCallback(() => {
    if (activeIndex < chapters.length - 1) {
      setActiveChapter(chapters[activeIndex + 1].id);
    }
  }, [activeIndex, chapters, setActiveChapter]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) {
      setActiveChapter(chapters[activeIndex - 1].id);
    }
  }, [activeIndex, chapters, setActiveChapter]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  // Scroll to top when chapter changes
  useEffect(() => {
    const container = document.getElementById('reading-content');
    if (container) container.scrollTop = 0;
  }, [activeChapterId]);

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
        <div style={{ fontSize: 48, opacity: 0.3 }}>📖</div>
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
          No chapters to read. Create chapters and write content first.
        </p>
      </div>
    );
  }

  if (!currentChapter) return null;

  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < chapters.length - 1;

  return (
    <div
      className="animate-fade-in"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--parchment)',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          borderBottom: '1px solid var(--parchment-dark)',
          background: 'rgba(244, 232, 209, 0.95)',
          flexShrink: 0,
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Previous button */}
        <button
          className="inkweave-btn"
          onClick={goPrev}
          disabled={!hasPrev}
          style={{
            opacity: hasPrev ? 1 : 0.4,
            cursor: hasPrev ? 'pointer' : 'not-allowed',
            padding: '6px 14px',
            fontSize: 13,
            background: 'var(--parchment-dark)',
            border: '1px solid #d4c9b0',
            color: '#5a4e3c',
          }}
        >
          ← Previous
        </button>

        {/* Chapter selector */}
        <select
          className="inkweave-input"
          value={currentChapter.id}
          onChange={e => goToChapter(e.target.value)}
          style={{
            width: 'auto',
            minWidth: 200,
            maxWidth: 400,
            textAlign: 'center',
            fontWeight: 600,
            background: 'var(--parchment)',
            border: '1px solid #d4c9b0',
            color: '#3a2e1e',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {chapters.map((ch, i) => (
            <option key={ch.id} value={ch.id}>
              Chapter {i + 1}: {ch.title}
            </option>
          ))}
        </select>

        {/* Next button */}
        <button
          className="inkweave-btn"
          onClick={goNext}
          disabled={!hasNext}
          style={{
            opacity: hasNext ? 1 : 0.4,
            cursor: hasNext ? 'pointer' : 'not-allowed',
            padding: '6px 14px',
            fontSize: 13,
            background: 'var(--parchment-dark)',
            border: '1px solid #d4c9b0',
            color: '#5a4e3c',
          }}
        >
          Next →
        </button>
      </div>

      {/* Reading content */}
      <div
        id="reading-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <article
          style={{
            maxWidth: 700,
            width: '100%',
          }}
        >
          {/* Chapter heading */}
          <header style={{ marginBottom: 40, textAlign: 'center' }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#8a7a66',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Chapter {activeIndex + 1}
            </p>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: '#2a1e0e',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {currentChapter.title}
            </h1>
            <div
              style={{
                width: 60,
                height: 2,
                background: '#c9b896',
                margin: '16px auto 0',
                borderRadius: 1,
              }}
            />
          </header>

          {/* Chapter content */}
          <div
            style={{
              fontSize: 18,
              lineHeight: 2.0,
              color: '#3a2e1e',
              fontFamily: "'Georgia', 'Times New Roman', 'Palatino', serif",
            }}
          >
            {currentChapter.content ? (
              <div
                dangerouslySetInnerHTML={{ __html: currentChapter.content }}
              />
            ) : (
              <p style={{ color: '#b8a88e', fontStyle: 'italic', textAlign: 'center' }}>
                This chapter has no content yet.
              </p>
            )}
          </div>
        </article>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 24px',
          borderTop: '1px solid var(--parchment-dark)',
          background: 'rgba(244, 232, 209, 0.95)',
          flexShrink: 0,
          backdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ fontSize: 12, color: '#8a7a66' }}>
          {currentChapter.wordCount.toLocaleString()} words
        </span>
        <span style={{ fontSize: 12, color: '#8a7a66' }}>
          {activeIndex + 1} of {chapters.length}
        </span>
        <span style={{ fontSize: 12, color: '#8a7a66' }}>
          Use ← → arrow keys to navigate
        </span>
      </div>
    </div>
  );
}
