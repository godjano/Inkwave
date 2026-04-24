'use client';

import { useState, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { Note } from '@/lib/types';

const NOTE_COLORS = [
  { name: 'yellow', value: '#fbbf24' },
  { name: 'green', value: '#34d399' },
  { name: 'blue', value: '#60a5fa' },
  { name: 'red', value: '#f87171' },
  { name: 'purple', value: '#a78bfa' },
];

export function NotesPanel() {
  const project = useStore(s => s.getActiveProject());
  const addNote = useStore(s => s.addNote);
  const deleteNote = useStore(s => s.deleteNote);
  const updateNote = useStore(s => s.updateNote);

  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const notes = project?.notes || [];

  const handleAddNote = useCallback(() => {
    if (!project) return;
    const id = addNote(project.id, 'New Note');
    setExpandedNoteId(id);
  }, [project, addNote]);

  const handleDelete = useCallback(
    (noteId: string) => {
      if (!project) return;
      deleteNote(project.id, noteId);
      if (expandedNoteId === noteId) setExpandedNoteId(null);
    },
    [project, deleteNote, expandedNoteId],
  );

  const handleColorChange = useCallback(
    (noteId: string, color: string) => {
      if (!project) return;
      updateNote(project.id, noteId, { color });
    },
    [project, updateNote],
  );

  const handleTitleClick = useCallback((note: Note) => {
    setEditingTitleId(note.id);
    setTitleDraft(note.title);
  }, []);

  const handleTitleBlur = useCallback(
    (noteId: string) => {
      if (!project) return;
      if (titleDraft.trim()) {
        updateNote(project.id, noteId, { title: titleDraft.trim() });
      }
      setEditingTitleId(null);
    },
    [project, updateNote, titleDraft],
  );

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent, noteId: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleTitleBlur(noteId);
      }
      if (e.key === 'Escape') {
        setEditingTitleId(null);
      }
    },
    [handleTitleBlur],
  );

  const handleContentBlur = useCallback(
    (noteId: string) => {
      if (!project || !contentRef.current) return;
      const content = contentRef.current.value;
      updateNote(project.id, noteId, { content });
    },
    [project, updateNote],
  );

  const handleCardClick = useCallback((noteId: string) => {
    setExpandedNoteId(prev => (prev === noteId ? null : noteId));
  }, []);

  const expandedNote = expandedNoteId ? notes.find(n => n.id === expandedNoteId) : null;

  return (
    <div className="inkweave-panel flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="manuscript-header flex items-center justify-between" style={{ padding: '12px 16px 10px' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '18px' }}>📝</span>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--accent-gold)', textShadow: '0 0 12px rgba(212,173,74,0.15)' }}>Notes</h2>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            {notes.length}
          </span>
        </div>
        <button className="inkweave-btn inkweave-btn-primary text-xs px-2 py-1" onClick={handleAddNote}>
          + New
        </button>
      </div>

      {/* Expanded Note Editor */}
      {expandedNote && (
        <div
          className="px-4 py-3 border-b animate-fade-in"
          style={{ borderColor: 'rgba(212,173,74,0.12)', background: 'rgba(160,128,56,0.06)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-6 rounded-full" style={{ background: expandedNote.color }} />
            {editingTitleId === expandedNote.id ? (
              <input
                className="inkweave-input text-sm font-semibold flex-1"
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onBlur={() => handleTitleBlur(expandedNote.id)}
                onKeyDown={e => handleTitleKeyDown(e, expandedNote.id)}
                autoFocus
              />
            ) : (
              <span
                className="text-sm font-semibold cursor-pointer flex-1"
                style={{ color: 'var(--text-primary)' }}
                onClick={() => handleTitleClick(expandedNote)}
              >
                {expandedNote.title}
              </span>
            )}
            <button
              className="inkweave-btn text-xs px-2 py-1"
              onClick={() => setExpandedNoteId(null)}
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Color picker in expanded view */}
          <div className="flex items-center gap-1.5 mb-3">
            {NOTE_COLORS.map(c => (
              <button
                key={c.name}
                className="w-5 h-5 rounded-full transition-all cursor-pointer"
                style={{
                  background: c.value,
                  border: expandedNote.color === c.value ? '2px solid var(--text-primary)' : '2px solid transparent',
                  transform: expandedNote.color === c.value ? 'scale(1.2)' : 'scale(1)',
                }}
                onClick={() => handleColorChange(expandedNote.id, c.value)}
                title={c.name}
              />
            ))}
          </div>

          {/* Content editor */}
          <textarea
            ref={contentRef}
            className="inkweave-input text-sm resize-none"
            style={{ minHeight: '120px', maxHeight: '300px' }}
            defaultValue={expandedNote.content}
            placeholder="Write your note..."
            onBlur={() => handleContentBlur(expandedNote.id)}
          />
        </div>
      )}

      {/* Notes Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
            <span style={{ fontSize: '32px' }}>📝</span>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No notes yet. Click + New to add one.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {notes.map(note => {
              const isExpanded = expandedNoteId === note.id;
              return (
                <div
                  key={note.id}
                  className={`rounded-lg p-3 cursor-pointer transition-all duration-200 animate-fade-in ${
                    isExpanded ? 'ring-1' : ''
                  }`}
                  style={{
                    background: isExpanded ? 'rgba(160,128,56,0.06)' : 'linear-gradient(135deg, rgba(160,128,56,0.06), rgba(26,30,28,0.9))',
                    border: '1px solid rgba(212,173,74,0.15)',
                    borderLeft: `3px solid ${note.color}`,
                    boxShadow: isExpanded ? '0 0 0 1px var(--accent-gold)' : undefined,
                    opacity: isExpanded ? 0.6 : 1,
                  }}
                  onClick={() => !isExpanded && handleCardClick(note.id)}
                >
                  {/* Title */}
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    {editingTitleId === note.id && !isExpanded ? (
                      <input
                        className="inkweave-input text-xs font-semibold"
                        style={{ padding: '2px 6px' }}
                        value={titleDraft}
                        onChange={e => setTitleDraft(e.target.value)}
                        onBlur={() => handleTitleBlur(note.id)}
                        onKeyDown={e => handleTitleKeyDown(e, note.id)}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="text-xs font-semibold truncate"
                        style={{ color: 'var(--text-primary)' }}
                        onClick={e => {
                          e.stopPropagation();
                          handleTitleClick(note);
                        }}
                      >
                        {note.title}
                      </span>
                    )}
                    <button
                      className="shrink-0 text-xs px-1 cursor-pointer transition-colors"
                      style={{ color: 'var(--text-muted)', background: 'none', border: 'none', lineHeight: '1' }}
                      onClick={e => {
                        e.stopPropagation();
                        handleDelete(note.id);
                      }}
                      title="Delete note"
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Content preview */}
                  <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>
                    {note.content
                      ? note.content.length > 100
                        ? note.content.slice(0, 100) + '...'
                        : note.content
                      : 'Empty note'}
                  </p>

                  {/* Color picker */}
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    {NOTE_COLORS.map(c => (
                      <button
                        key={c.name}
                        className="w-3.5 h-3.5 rounded-full transition-transform cursor-pointer"
                        style={{
                          background: c.value,
                          border: note.color === c.value ? '1.5px solid var(--text-primary)' : '1.5px solid transparent',
                          transform: note.color === c.value ? 'scale(1.2)' : 'scale(1)',
                          opacity: note.color === c.value ? 1 : 0.5,
                        }}
                        onClick={() => handleColorChange(note.id, c.value)}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
