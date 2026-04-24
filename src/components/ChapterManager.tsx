'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Plus,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Trash2,
  Check,
  X,
  FileText,
  ChevronDown as CaretDown,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Chapter } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_OPTIONS: Chapter['status'][] = ['outline', 'draft', 'revised', 'final'];

const STATUS_CONFIG: Record<
  Chapter['status'],
  { label: string; color: string; bg: string }
> = {
  outline: { label: 'Outline', color: '#8e6bbf', bg: 'rgba(142,107,191,0.15)' },
  draft: { label: 'Draft', color: '#8a7a66', bg: 'rgba(138,122,102,0.15)' },
  revised: { label: 'Revised', color: '#d4a853', bg: 'rgba(212,168,83,0.15)' },
  final: { label: 'Final', color: '#27ae60', bg: 'rgba(39,174,96,0.15)' },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatNumber(n: number): string {
  return n.toLocaleString();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChapterManager() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeChapterId = useStore((s) => s.activeChapterId);
  const getActiveProject = useStore((s) => s.getActiveProject);
  const setActiveChapter = useStore((s) => s.setActiveChapter);
  const addChapter = useStore((s) => s.addChapter);
  const deleteChapter = useStore((s) => s.deleteChapter);
  const updateChapter = useStore((s) => s.updateChapter);
  const reorderChapters = useStore((s) => s.reorderChapters);

  const project = getActiveProject();

  /* ---------- Local UI state ---------- */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);

  /* Focus the edit input when it appears */
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  /* Close dropdown on outside click */
  useEffect(() => {
    if (!statusDropdownId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-status-dropdown]')) {
        setStatusDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [statusDropdownId]);

  /* ---------- Handlers ---------- */

  const handleAddChapter = useCallback(() => {
    if (!activeProjectId) return;
    const id = addChapter(activeProjectId);
    setActiveChapter(id);
  }, [activeProjectId, addChapter, setActiveChapter]);

  const handleDelete = useCallback(
    (chapterId: string) => {
      if (!activeProjectId) return;
      deleteChapter(activeProjectId, chapterId);
      setDeleteConfirmId(null);
    },
    [activeProjectId, deleteChapter],
  );

  const handleStartEdit = useCallback((chapter: Chapter) => {
    setEditingId(chapter.id);
    setEditTitle(chapter.title);
  }, []);

  const handleSaveTitle = useCallback(() => {
    if (!activeProjectId || !editingId || !editTitle.trim()) {
      setEditingId(null);
      return;
    }
    updateChapter(activeProjectId, editingId, { title: editTitle.trim() });
    setEditingId(null);
  }, [activeProjectId, editingId, editTitle, updateChapter]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditTitle('');
  }, []);

  const handleReorder = useCallback(
    (currentIndex: number, direction: 'up' | 'down') => {
      if (!project || !activeProjectId) return;
      const chapters = [...project.chapters].sort((a, b) => a.order - b.order);
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= chapters.length) return;
      const ids = chapters.map((c) => c.id);
      [ids[currentIndex], ids[targetIndex]] = [ids[targetIndex], ids[currentIndex]];
      reorderChapters(activeProjectId, ids);
    },
    [project, activeProjectId, reorderChapters],
  );

  const handleStatusChange = useCallback(
    (chapterId: string, status: Chapter['status']) => {
      if (!activeProjectId) return;
      updateChapter(activeProjectId, chapterId, { status });
      setStatusDropdownId(null);
    },
    [activeProjectId, updateChapter],
  );

  const handleSummaryChange = useCallback(
    (chapterId: string, summary: string) => {
      if (!activeProjectId) return;
      updateChapter(activeProjectId, chapterId, { summary });
    },
    [activeProjectId, updateChapter],
  );

  /* ---------- Guard: no project ---------- */
  if (!project) {
    return (
      <div
        className="inkweave-panel flex items-center justify-center"
        style={{ padding: 32, color: 'var(--text-muted)', fontSize: 14 }}
      >
        No project selected
      </div>
    );
  }

  const sortedChapters = [...project.chapters].sort((a, b) => a.order - b.order);
  const totalWords = project.chapters.reduce((sum, c) => sum + c.wordCount, 0);

  /* ---------- Render ---------- */
  return (
    <div className="inkweave-panel" style={{ padding: 0 }}>
      {/* ---- Header ---- */}
      <div
        className="manuscript-header flex items-center justify-between"
        style={{
          padding: '14px 16px 12px',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--accent-gold)',
            textShadow: '0 0 12px rgba(212,173,74,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <FileText size={16} style={{ color: 'var(--accent-gold)' }} />
          Chapters
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              fontWeight: 400,
            }}
          >
            ({sortedChapters.length})
          </span>
        </h2>
        <button
          type="button"
          onClick={handleAddChapter}
          title="Add Chapter"
          aria-label="Add Chapter"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: '1px solid var(--border-color)',
            borderRadius: 6,
            background: 'var(--bg-tertiary)',
            color: 'var(--accent-gold)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--accent-gold)';
            e.currentTarget.style.color = 'var(--parchment)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
            e.currentTarget.style.color = 'var(--accent-gold)';
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      {/* ---- Chapter List ---- */}
      <div
        style={{
          maxHeight: 'calc(100vh - 180px)',
          overflowY: 'auto',
          padding: '8px 8px',
        }}
      >
        {sortedChapters.length === 0 && (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}
          >
            No chapters yet. Click + to add one.
          </div>
        )}

        {sortedChapters.map((chapter, index) => {
          const isActive = chapter.id === activeChapterId;
          const isExpanded = expandedId === chapter.id;
          const statusCfg = STATUS_CONFIG[chapter.status];
          const isEditing = editingId === chapter.id;
          const isDeleting = deleteConfirmId === chapter.id;

          return (
            <div
              key={chapter.id}
              className="animate-fade-in"
              style={{
                marginBottom: 4,
                borderRadius: 6,
                border: isActive
                  ? '1px solid var(--accent-gold-dim)'
                  : '1px solid transparent',
                borderLeft: isActive
                  ? '2px solid rgba(212,173,74,0.6)'
                  : '2px solid transparent',
                background: isActive ? 'rgba(160,128,56,0.08)' : 'transparent',
                overflow: 'hidden',
                transition: 'all 0.15s ease',
              }}
            >
              {/* ---- Chapter Row ---- */}
              <div
                className="flex items-center gap-2"
                style={{
                  padding: '8px 10px',
                  cursor: isEditing ? 'default' : 'pointer',
                  minHeight: 44,
                }}
                onClick={() => {
                  if (!isEditing && !isDeleting) {
                    setActiveChapter(chapter.id);
                  }
                }}
              >
                {/* Drag Handle */}
                <GripVertical
                  size={14}
                  style={{
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                    cursor: 'grab',
                    opacity: 0.5,
                  }}
                />

                {/* Order Number */}
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    width: 18,
                    textAlign: 'center',
                    flexShrink: 0,
                    fontWeight: 600,
                  }}
                >
                  {index + 1}
                </span>

                {/* Title (editable) */}
                {isEditing ? (
                  <div className="flex items-center gap-1" style={{ flex: 1, minWidth: 0 }}>
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="inkweave-input"
                      style={{ padding: '4px 8px', fontSize: 13, flex: 1 }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveTitle();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        border: 'none',
                        borderRadius: 4,
                        background: 'var(--accent-green)',
                        color: '#fff',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title="Save"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelEdit();
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        border: 'none',
                        borderRadius: 4,
                        background: 'var(--bg-elevated)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(chapter);
                    }}
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--accent-gold)' : 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={chapter.title}
                  >
                    {chapter.title}
                  </span>
                )}

                {/* Word Count */}
                {!isEditing && (
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      flexShrink: 0,
                      minWidth: 32,
                      textAlign: 'right',
                    }}
                  >
                    {formatNumber(chapter.wordCount)}
                  </span>
                )}

                {/* Status Badge (clickable) */}
                {!isEditing && (
                  <div
                    style={{ position: 'relative', flexShrink: 0 }}
                    data-status-dropdown
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStatusDropdownId(
                          statusDropdownId === chapter.id ? null : chapter.id,
                        );
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 8px',
                        borderRadius: 10,
                        border: `1px solid ${statusCfg.color}40`,
                        background: statusCfg.bg,
                        color: statusCfg.color,
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                      }}
                      title="Change status"
                    >
                      {statusCfg.label}
                      <CaretDown size={10} />
                    </button>

                    {/* Dropdown */}
                    {statusDropdownId === chapter.id && (
                      <div
                        className="animate-fade-in"
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          right: 0,
                          zIndex: 50,
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 6,
                          padding: 4,
                          minWidth: 110,
                          boxShadow: 'var(--shadow-lg)',
                        }}
                      >
                        {STATUS_OPTIONS.map((status) => {
                          const cfg = STATUS_CONFIG[status];
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(chapter.id, status);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                width: '100%',
                                padding: '6px 10px',
                                border: 'none',
                                borderRadius: 4,
                                background:
                                  chapter.status === status
                                    ? 'var(--bg-hover)'
                                    : 'transparent',
                                color:
                                  chapter.status === status
                                    ? cfg.color
                                    : 'var(--text-secondary)',
                                fontSize: 12,
                                cursor: 'pointer',
                                transition: 'all 0.1s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (chapter.status !== status) {
                                  e.currentTarget.style.background =
                                    'var(--bg-hover)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (chapter.status !== status) {
                                  e.currentTarget.style.background =
                                    'transparent';
                                }
                              }}
                            >
                              <span
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  background: cfg.color,
                                  flexShrink: 0,
                                }}
                              />
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {!isEditing && (
                  <div
                    className="flex items-center gap-0.5"
                    style={{ flexShrink: 0 }}
                  >
                    {/* Expand / Collapse */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(isExpanded ? null : chapter.id);
                      }}
                      title={isExpanded ? 'Collapse' : 'Expand'}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        border: 'none',
                        borderRadius: 4,
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                      }}
                    >
                      <CaretDown size={14} />
                    </button>

                    {/* Up Arrow */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(index, 'up');
                      }}
                      disabled={index === 0}
                      title="Move Up"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        border: 'none',
                        borderRadius: 4,
                        background: 'transparent',
                        color:
                          index === 0
                            ? 'var(--border-color)'
                            : 'var(--text-muted)',
                        cursor: index === 0 ? 'default' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ChevronUp size={14} />
                    </button>

                    {/* Down Arrow */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorder(index, 'down');
                      }}
                      disabled={index === sortedChapters.length - 1}
                      title="Move Down"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        border: 'none',
                        borderRadius: 4,
                        background: 'transparent',
                        color:
                          index === sortedChapters.length - 1
                            ? 'var(--border-color)'
                            : 'var(--text-muted)',
                        cursor:
                          index === sortedChapters.length - 1
                            ? 'default'
                            : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ChevronDown size={14} />
                    </button>

                    {/* Delete */}
                    {isDeleting ? (
                      <div
                        className="flex items-center gap-1"
                        style={{ marginLeft: 2 }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(chapter.id);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            border: 'none',
                            borderRadius: 4,
                            background: 'rgba(192,57,43,0.2)',
                            color: '#e74c3c',
                            cursor: 'pointer',
                          }}
                          title="Confirm Delete"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 24,
                            height: 24,
                            border: 'none',
                            borderRadius: 4,
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                          title="Cancel Delete"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(chapter.id);
                        }}
                        title="Delete Chapter"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 24,
                          height: 24,
                          border: 'none',
                          borderRadius: 4,
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#e74c3c';
                          e.currentTarget.style.background =
                            'rgba(192,57,43,0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--text-muted)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* ---- Expanded Content (Summary + Edit) ---- */}
              {isExpanded && (
                <div
                  className="animate-fade-in"
                  style={{
                    padding: '0 10px 10px 44px',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Inline Title Edit Hint */}
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginBottom: 8,
                    }}
                  >
                    Double-click title to rename &middot;{' '}
                    <span
                      style={{
                        color: 'var(--accent-gold)',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleStartEdit(chapter)}
                    >
                      Edit now
                    </span>
                  </div>

                  {/* Summary Textarea */}
                  <label
                    style={{
                      display: 'block',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      marginBottom: 4,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Chapter Summary
                  </label>
                  <textarea
                    value={chapter.summary}
                    onChange={(e) =>
                      handleSummaryChange(chapter.id, e.target.value)
                    }
                    placeholder="Brief summary of this chapter..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: 12,
                      lineHeight: 1.6,
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 6,
                      color: 'var(--text-secondary)',
                      resize: 'vertical',
                      minHeight: 60,
                      fontFamily: 'inherit',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent-gold)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  />

                  {/* Meta Info */}
                  <div
                    className="flex items-center gap-4"
                    style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}
                  >
                    <span>{formatNumber(chapter.wordCount)} words</span>
                    <span>&middot;</span>
                    <span>
                      Created{' '}
                      {new Date(chapter.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span>&middot;</span>
                    <span>
                      Updated{' '}
                      {new Date(chapter.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Footer (total word count) ---- */}
      {sortedChapters.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid rgba(212,173,74,0.12)',
            fontSize: 12,
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, rgba(160,128,56,0.03), transparent)',
          }}
        >
          <span>
            Total: <strong style={{ color: 'var(--accent-gold-dim)' }}>{formatNumber(totalWords)}</strong> words
          </span>
          <span>
            Avg:{' '}
            <strong style={{ color: 'var(--accent-gold-dim)' }}>
              {formatNumber(Math.round(totalWords / sortedChapters.length))}
            </strong>{' '}
            / chapter
          </span>
        </div>
      )}
    </div>
  );
}
