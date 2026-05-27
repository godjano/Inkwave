'use client';

import { useState, useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import { worldSchemas } from '@/lib/schemas';
import { WorldCategory, WorldEntry } from '@/lib/types';
import CharacterCard from '@/components/CharacterCard';

export { WorldBiblePanel };

/* ─── Simple Category Icons ─── */
const categoryIcons: Record<WorldCategory, React.ReactNode> = {
  characters: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="7" r="3.5" stroke="var(--accent-gold)" strokeWidth="1.2" />
      <path d="M4 20c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="var(--accent-gold)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
  locations: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 2C7.5 2 5 4.5 5 7.5c0 5.5 6 12.5 6 12.5s6-7 6-12.5C17 4.5 14.5 2 11 2z" stroke="var(--accent-gold)" strokeWidth="1.2" />
      <circle cx="11" cy="7.5" r="2" stroke="var(--accent-gold)" strokeWidth="1" />
    </svg>
  ),
  magic: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 1l1.8 5.2L18 8l-5.2 1.8L11 15l-1.8-5.2L4 8l5.2-1.8z" stroke="var(--accent-gold)" strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M11 7l0.8 2.2L14 10l-2.2 0.8L11 13l-0.8-2.2L8 10l2.2-0.8z" fill="var(--accent-gold)" opacity="0.3" />
    </svg>
  ),
  lore: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M4 3h14a1 1 0 011 1v14a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="var(--accent-gold)" strokeWidth="1.2" />
      <path d="M7 7h8M7 10h5M7 13h8" stroke="var(--accent-gold)" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
    </svg>
  ),
  items: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M6 3l5 8-5 8h10l-5-8 5-8z" stroke="var(--accent-gold)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M11 11l0-8" stroke="var(--accent-gold)" strokeWidth="0.8" strokeLinecap="round" opacity="0.4" />
    </svg>
  ),
  factions: (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path d="M11 2L3 7v4c0 5.5 3.4 10.6 8 12 4.6-1.4 8-6.5 8-12V7L11 2z" stroke="var(--accent-gold)" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8 11l2 2 4-4" stroke="var(--accent-gold)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════
   Main World Bible Panel — Standard Inkweave Theme
   ═══════════════════════════════════════════════════════════ */
function WorldBiblePanel() {
  const activeProjectId = useStore(s => s.activeProjectId);
  const getActiveProject = useStore(s => s.getActiveProject);
  const addWorldEntry = useStore(s => s.addWorldEntry);
  const deleteWorldEntry = useStore(s => s.deleteWorldEntry);
  const updateWorldEntry = useStore(s => s.updateWorldEntry);

  const project = getActiveProject();
  const worldBible = useMemo(() => project?.worldBible ?? [], [project?.worldBible]);

  const [activeTab, setActiveTab] = useState<WorldCategory>('characters');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [generatingEntry, setGeneratingEntry] = useState(false);

  const activeChapter = useStore(s => s.getActiveChapter());

  const countsByCategory = useMemo(() => {
    const counts: Record<WorldCategory, number> = { characters: 0, locations: 0, magic: 0, lore: 0, items: 0, factions: 0 };
    for (const entry of worldBible) { counts[entry.category]++; }
    return counts;
  }, [worldBible]);

  const filteredEntries = useMemo(() => {
    return worldBible
      .filter(e => e.category === activeTab)
      .filter(e => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return e.name.toLowerCase().includes(q) || e.notes.toLowerCase().includes(q) || Object.values(e.fields).some(v => v.toLowerCase().includes(q));
      });
  }, [worldBible, activeTab, searchQuery]);

  const activeSchema = useMemo(() => worldSchemas.find(s => s.category === activeTab), [activeTab]);

  const handleAddEntry = useCallback(() => {
    if (!activeProjectId) return;
    const id = addWorldEntry(activeProjectId, activeTab, 'New Entry');
    setExpandedId(id);
  }, [activeProjectId, activeTab, addWorldEntry]);

  const handleDeleteEntry = useCallback(
    (entryId: string) => {
      if (!activeProjectId) return;
      if (deleteConfirmId === entryId) { deleteWorldEntry(activeProjectId, entryId); setDeleteConfirmId(null); if (expandedId === entryId) setExpandedId(null); }
      else { setDeleteConfirmId(entryId); setTimeout(() => setDeleteConfirmId(null), 3000); }
    },
    [activeProjectId, deleteConfirmId, expandedId, deleteWorldEntry]
  );

  const handleFieldChange = useCallback((entry: WorldEntry, fieldKey: string, value: string) => {
    if (!activeProjectId) return;
    updateWorldEntry(activeProjectId, entry.id, { fields: { ...entry.fields, [fieldKey]: value } });
  }, [activeProjectId, updateWorldEntry]);

  const handleNameChange = useCallback((entry: WorldEntry, name: string) => {
    if (!activeProjectId) return;
    updateWorldEntry(activeProjectId, entry.id, { name });
  }, [activeProjectId, updateWorldEntry]);

  const handleNotesChange = useCallback((entry: WorldEntry, notes: string) => {
    if (!activeProjectId) return;
    updateWorldEntry(activeProjectId, entry.id, { notes });
  }, [activeProjectId, updateWorldEntry]);

  const handleToggleExpand = useCallback((entryId: string) => { setExpandedId(prev => (prev === entryId ? null : entryId)); }, []);

  /* ── AI Generate ── */
  const handleAiGenerate = useCallback(async () => {
    if (!activeProjectId || !project) return;
    setGeneratingEntry(true);
    try {
      const aiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_key') || '') : '';
      const aiProv = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_provider') || 'openrouter') : 'openrouter';
      const aiModel = aiProv === 'openrouter' ? 'google/gemma-3-27b-it:free' : aiProv === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
      const existingEntries = worldBible.filter(e => e.category === activeTab).map(e => ({ name: e.name, notes: e.notes }));
      const chapters = project?.chapters || [];
      let chapterText = '';
      if (chapters.length > 0) { chapterText = chapters.map(ch => { const p = ch.content.replace(/<[^>]*>/g, ''); return `--- Chapter: "${ch.title}" ---\n${p}`; }).join('\n\n'); }
      const res = await fetch('/api/ai/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate-entry', data: { genre: project.genre, synopsis: project.description, category: activeTab, existingEntries, schemaFields: activeSchema?.fields.map(f => ({ key: f.key, label: f.label })), chapterContent: chapterText }, apiKey: aiKey, provider: aiProv, model: aiModel }) });
      const data = await res.json();
      if (data.content) {
        try {
          const cleaned = data.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const generated = JSON.parse(cleaned);
          const entryName = generated.name || 'Generated Entry';
          // Don't create entry if AI says everything is already catalogued or no chapters exist
          if (entryName === 'All known entries catalogued' || entryName === 'Write chapters first') {
            const msg = generated.notes || (entryName === 'Write chapters first' ? 'Please write at least one chapter before using AI generation.' : 'All known entries from your chapters have already been catalogued. Write more chapters and try again.');
            alert(msg);
          } else {
            const newFields: Record<string, string> = {};
            const newNotes: string[] = [];
            for (const [key, value] of Object.entries(generated)) { if (key === 'name') continue; if (key === 'notes' || key === 'note') { newNotes.push(String(value)); } else if (typeof value === 'string' && value.trim()) { newFields[key] = value; } }
            const id = addWorldEntry(activeProjectId, activeTab, entryName);
            updateWorldEntry(activeProjectId, id, { fields: newFields, notes: newNotes.join('\n') });
            setExpandedId(id);
          }
        } catch { const id = addWorldEntry(activeProjectId, activeTab, 'AI Generated Entry'); updateWorldEntry(activeProjectId, id, { notes: data.content }); setExpandedId(id); }
      } else if (data.error) { alert(`AI generation failed: ${data.error}`); }
    } catch { alert('AI generation failed. Please try again.'); } finally { setGeneratingEntry(false); }
  }, [activeProjectId, project, worldBible, activeTab, activeSchema, addWorldEntry, updateWorldEntry]);

  /* ── AI Enrich ── */
  const handleEnrichEntry = useCallback(async (entry: WorldEntry) => {
    if (!activeProjectId) return;
    setEnrichingId(entry.id);
    const chapterText = activeChapter?.content ? activeChapter.content.replace(/<[^>]*>/g, '').slice(0, 2000) : '';
    const worldContext = worldBible.filter(e => e.id !== entry.id).map(e => `${e.name} (${e.category}): ${e.notes || Object.values(e.fields).filter(Boolean).join(', ')}`).slice(0, 500).join('\n');
    try {
      const aiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_key') || '') : '';
      const aiProv = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_provider') || 'openrouter') : 'openrouter';
      const aiModel = aiProv === 'openrouter' ? 'google/gemma-3-27b-it:free' : aiProv === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
      const res = await fetch('/api/ai/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'enrich-entry', data: { entryName: entry.name, category: entry.category, existingFields: entry.fields, chapterContext: chapterText, worldContext }, apiKey: aiKey, provider: aiProv, model: aiModel }) });
      const data = await res.json();
      if (data.content) {
        try {
          const cleaned = data.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const enriched = JSON.parse(cleaned);
          const newFields: Record<string, string> = {};
          const newNotes: string[] = [];
          for (const [key, value] of Object.entries(enriched)) { if (key === 'name') continue; if (key === 'notes' || key === 'note') { newNotes.push(String(value)); } else if (typeof value === 'string' && value.trim()) { newFields[key] = value; } }
          updateWorldEntry(activeProjectId, entry.id, { fields: { ...entry.fields, ...newFields }, notes: newNotes.length > 0 ? newNotes.join('\n') : entry.notes });
        } catch { updateWorldEntry(activeProjectId, entry.id, { notes: entry.notes ? `${entry.notes}\n\n--- AI Suggestion ---\n${data.content}` : data.content }); }
      }
    } catch { /* silent */ } finally { setEnrichingId(null); }
  }, [activeProjectId, activeChapter, worldBible, updateWorldEntry]);

  if (!project) {
    return (
      <div className="inkweave-panel flex items-center justify-center" style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
        Select a project to view the World Bible
      </div>
    );
  }

  const serif = { fontFamily: "'Georgia', 'Palatino Linotype', 'Book Antiqua', serif" };

  return (
    <div className="inkweave-panel flex flex-col" style={{ height: '100%' }}>
      {/* ─── Title Section ─── */}
      <div style={{ padding: '16px 18px 0' }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: 'var(--accent-gold)', flexShrink: 0 }}>
            <path d="M4 3c0 0 2 3 6 3s6-3 6-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <path d="M7 8h6M7 11h4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
          </svg>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--accent-gold)', letterSpacing: 1, ...serif }}>
            World Bible
          </h2>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            onClick={handleAddEntry}
            className="inkweave-btn"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 10px', fontSize: 11, fontWeight: 600 }}
            title={`Inscribe a new ${activeSchema?.label ?? 'entry'}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="var(--accent-gold)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Inscribe
          </button>
          <button
            onClick={handleAiGenerate}
            disabled={generatingEntry}
            className="inkweave-btn-primary"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '6px 10px', fontSize: 11, fontWeight: 600,
              opacity: generatingEntry ? 0.6 : 1, cursor: generatingEntry ? 'wait' : 'pointer',
            }}
            title={`AI-scribe a new ${activeSchema?.label ?? 'entry'}`}
          >
            {generatingEntry ? (
              <>
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', border: '2px solid var(--accent-gold)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                <span>Inscribing...</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5Z" fill="var(--accent-gold)" />
                </svg>
                Divine
              </>
            )}
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0.35 }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="var(--text-muted)" strokeWidth="1" />
            <path d="M8.5 8.5L12 12" stroke="var(--text-muted)" strokeWidth="1" strokeLinecap="round" />
          </svg>
          <input
            className="inkweave-input"
            type="text"
            placeholder="Search entries..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ fontSize: 12, paddingLeft: 26 }}
          />
        </div>

        {/* Thin divider */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,173,74,0.15), transparent)', marginBottom: 6 }} />
      </div>

      {/* ─── Category Grid ─── */}
      <div style={{ padding: '4px 14px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
          {worldSchemas.map(schema => {
            const isActive = activeTab === schema.category;
            const count = countsByCategory[schema.category];
            return (
              <button
                key={schema.category}
                onClick={() => { setActiveTab(schema.category); setExpandedId(null); setSearchQuery(''); }}
                title={schema.label}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 0, padding: '8px 2px 5px',
                  background: isActive ? 'rgba(160,128,56,0.1)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(212,173,74,0.3)' : 'rgba(212,173,74,0.08)'}`,
                  borderRadius: 3, cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                <div style={{ opacity: isActive ? 1 : 0.45, transition: 'opacity 0.2s' }}>
                  {categoryIcons[schema.category]}
                </div>
                <span style={{
                  fontSize: 8.5, fontWeight: 600, lineHeight: 1.3, whiteSpace: 'nowrap',
                  ...serif, letterSpacing: 0.3,
                  color: isActive ? 'var(--accent-gold)' : 'var(--text-muted)',
                  marginTop: 1,
                }}>
                  {schema.label.length > 9 ? schema.label.split(' ')[0] : schema.label}
                </span>
                {count > 0 && (
                  <span style={{
                    fontSize: 7.5, lineHeight: 1, fontWeight: 700, ...serif,
                    background: isActive ? 'var(--accent-gold-dim)' : 'var(--bg-tertiary)',
                    color: isActive ? 'var(--bg-primary)' : 'var(--text-muted)',
                    padding: '0px 4px', borderRadius: 6, marginTop: 1,
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,173,74,0.12), transparent)', margin: '4px 14px' }} />

      {/* ─── Entry List ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 6px' }}>
        {filteredEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)' }}>
            <div style={{ marginBottom: 8, opacity: 0.2 }}>{categoryIcons[activeTab]}</div>
            <div style={{ ...serif, fontStyle: 'italic', fontSize: 11, lineHeight: 1.6 }}>
              {searchQuery
                ? 'No entries found...'
                : 'No entries yet.\nPress Inscribe to add one.'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {filteredEntries.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                schema={activeSchema!}
                isExpanded={expandedId === entry.id}
                isDeleting={deleteConfirmId === entry.id}
                isEnriching={enrichingId === entry.id}
                onToggle={() => handleToggleExpand(entry.id)}
                onNameChange={v => handleNameChange(entry, v)}
                onFieldChange={(key, val) => handleFieldChange(entry, key, val)}
                onNotesChange={v => handleNotesChange(entry, v)}
                onDelete={() => handleDeleteEntry(entry.id)}
                onEnrich={() => handleEnrichEntry(entry)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Footer ─── */}
      <div style={{
        padding: '6px 18px 8px', borderTop: '1px solid rgba(212,173,74,0.1)',
        fontSize: 10, ...serif, color: 'var(--text-muted)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', letterSpacing: 0.3,
      }}>
        <span>{filteredEntries.length} of {worldBible.length} entries</span>
        <span style={{ fontStyle: 'italic', color: 'rgba(212,173,74,0.3)' }}>{activeSchema?.label}</span>
      </div>
    </div>
  );
}

/* ─────────────────────── Entry Card ─────────────────────── */

interface EntryCardProps {
  entry: WorldEntry;
  schema: { category: WorldCategory; label: string; icon: string; color: string; fields: { key: string; label: string; type: 'text' | 'textarea' | 'select'; options?: string[] }[] };
  isExpanded: boolean;
  isDeleting: boolean;
  isEnriching: boolean;
  onToggle: () => void;
  onNameChange: (name: string) => void;
  onFieldChange: (key: string, value: string) => void;
  onNotesChange: (notes: string) => void;
  onDelete: () => void;
  onEnrich: () => void;
}

function EntryCard({ entry, schema, isExpanded, isDeleting, isEnriching, onToggle, onNameChange, onFieldChange, onNotesChange, onDelete, onEnrich }: EntryCardProps) {
  const preview = useMemo(() => {
    for (const f of schema.fields) {
      const val = entry.fields[f.key];
      if (val && val.trim()) { const s = val.trim().replace(/\n/g, ' '); return s.length > 55 ? s.slice(0, 55) + '...' : s; }
    }
    if (entry.notes.trim()) { const s = entry.notes.trim().replace(/\n/g, ' '); return s.length > 55 ? s.slice(0, 55) + '...' : s; }
    return null;
  }, [entry.fields, entry.notes, schema.fields]);

  const serif = { fontFamily: "'Georgia', 'Palatino Linotype', 'Book Antiqua', serif" };
  const initial = (entry.name || 'U')[0].toUpperCase();

  return (
    <div className="inkweave-card ink-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', gap: 8 }}>
        {/* Initial badge */}
        <div style={{
          width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, ...serif,
          color: isExpanded ? 'var(--accent-gold)' : 'var(--text-muted)',
          background: isExpanded ? 'rgba(160,128,56,0.12)' : 'var(--bg-tertiary)',
          border: `1px solid ${isExpanded ? 'rgba(212,173,74,0.3)' : 'var(--border-color)'}`,
          borderRadius: 3, flexShrink: 0,
        }}>
          {initial}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, ...serif, letterSpacing: 0.2,
            color: isExpanded ? 'var(--accent-gold)' : 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {entry.name || 'Untitled'}
          </div>
          {preview && !isExpanded && (
            <div style={{
              fontSize: 10.5, color: 'var(--text-muted)', fontStyle: 'italic', ...serif,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1, opacity: 0.7,
            }}>
              {preview}
            </div>
          )}
        </div>

        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          stroke={isExpanded ? 'var(--accent-gold)' : 'var(--text-muted)'}
          strokeWidth="1.5" strokeLinecap="round"
          style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0, opacity: 0.6 }}>
          <path d="M4 1L9 6L4 11" />
        </svg>
      </div>

      {/* Expanded form */}
      {isExpanded && (
        <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {entry.category === 'characters' ? (
            <CharacterCard entry={entry} projectId={''} chapters={[]} allCharacters={[]} onFieldChange={(k, v) => onFieldChange(entry, k, v)} />
          ) : (<>
          {/* Thin divider */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,173,74,0.15), transparent)' }} />

          {/* Name */}
          <div>
            <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1.2, ...serif }}>
              Entry Name
            </label>
            <input className="inkweave-input" type="text" value={entry.name} onChange={e => onNameChange(e.target.value)} placeholder="Name this entry..." style={{ fontSize: 13, fontWeight: 600 } } />
          </div>

          {/* Schema fields */}
          {schema.fields.map(field => (
            <div key={field.key}>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1.2, ...serif }}>
                {field.label}
              </label>
              {field.type === 'select' && field.options ? (
                <select className="inkweave-input" value={entry.fields[field.key] ?? ''} onChange={e => onFieldChange(field.key, e.target.value)} style={{ fontSize: 12, cursor: 'pointer', appearance: 'auto' }}>
                  <option value="">-- Select --</option>
                  {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea className="inkweave-input" value={entry.fields[field.key] ?? ''} onChange={e => onFieldChange(field.key, e.target.value)} placeholder={`Describe the ${field.label.toLowerCase()}...`} rows={3} style={{ fontSize: 12, resize: 'vertical', minHeight: 52, lineHeight: 1.7 }} />
              ) : (
                <input className="inkweave-input" type="text" value={entry.fields[field.key] ?? ''} onChange={e => onFieldChange(field.key, e.target.value)} placeholder={field.label + '...'} style={{ fontSize: 12 }} />
              )}
            </div>
          ))}

          {/* Notes */}
          <div>
            <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1.2, ...serif }}>
              Notes
            </label>
            <textarea className="inkweave-input" value={entry.notes} onChange={e => onNotesChange(e.target.value)} placeholder="Additional notes..." rows={3} style={{ fontSize: 12, resize: 'vertical', minHeight: 52, lineHeight: 1.7 }} />
          </div>

          {/* Thin divider */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,173,74,0.15), transparent)' }} />

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={e => { e.stopPropagation(); onEnrich(); }}
              disabled={isEnriching}
              className="inkweave-btn-primary"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', fontSize: 10.5, fontWeight: 600, ...serif,
                opacity: isEnriching ? 0.6 : 1, cursor: isEnriching ? 'wait' : 'pointer',
              }}
            >
              {isEnriching ? (
                <>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', border: '1.5px solid var(--accent-gold)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
                  Enchanting...
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M6 0L7.5 4.5L12 6L7.5 7.5L6 12L4.5 7.5L0 6L4.5 4.5Z" fill="var(--accent-gold)" />
                  </svg>
                  Enrich
                </>
              )}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              style={{
                padding: '5px 11px', fontSize: 10.5, fontWeight: 600, ...serif, letterSpacing: 0.3,
                background: isDeleting ? 'var(--accent-red)' : 'transparent',
                border: `1px solid ${isDeleting ? 'var(--accent-red)' : 'rgba(160,72,72,0.3)'}`,
                color: isDeleting ? '#fff' : 'var(--accent-red)',
                borderRadius: 3, cursor: 'pointer',
              }}
            >
              {isDeleting ? 'Confirm Erasure' : 'Erase'}
            </button>
          </div>
        </>)}
          </div>
      )}
    </div>
  );
}
