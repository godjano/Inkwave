'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useStore } from '@/lib/store';
import {
  Plus,
  Trash2,
  Upload,
  BookOpen,
  FileText,
  X,
  ImagePlus,
  Eye,
} from 'lucide-react';
import { IconSparkles } from './icons';

const GENRES = [
  'High Fantasy',
  'Dark Fantasy',
  'Epic Fantasy',
  'Sword & Sorcery',
  'Mythic Fantasy',
  'Other',
];

/* ────────────────────────────────────────────
   Dashboard — Inkweave original design
   ──────────────────────────────────────────── */

export default function Dashboard() {
  const projects = useStore(s => s.projects);
  const addProject = useStore(s => s.addProject);
  const deleteProject = useStore(s => s.deleteProject);
  const setActiveProject = useStore(s => s.setActiveProject);
  const importProject = useStore(s => s.importProject);

  /* ── Theme sync with editor ── */
  useEffect(() => {
    try {
      const stored = localStorage.getItem('inkweave-theme');
      if (stored) {
        const val = JSON.parse(stored);
        if (!val) document.body.classList.add('dark-theme');
      }
    } catch { /* ignore */ }
    const handler = (e: StorageEvent) => {
      if (e.key === 'inkweave-theme' && e.newValue !== null) {
        const val = JSON.parse(e.newValue);
        if (!val) document.body.classList.add('dark-theme');
        else document.body.classList.remove('dark-theme');
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newGenre, setNewGenre] = useState(GENRES[0]);
  const [newSynopsis, setNewSynopsis] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  /* Check if user has completed onboarding (first-time detection) */
  useEffect(() => {
    try {
      const done = localStorage.getItem('inkweave-onboarding-done');
      if (!done) {
        setIsFirstVisit(true);
      }
    } catch { /* noop */ }
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [editingCoverId, setEditingCoverId] = useState<string | null>(null);
  const [generatingCover, setGeneratingCover] = useState<string | null>(null);
  const [previewCoverUrl, setPreviewCoverUrl] = useState<string | null>(null);

  /* ── Helpers ── */
  const parseDescription = (desc: string) => {
    if (!desc) return { synopsis: '', author: '' };
    const authorMatch = desc.match(/\s*—\s*by\s+(.+)$/);
    if (authorMatch) {
      return {
        synopsis: desc.replace(/\s*—\s*by\s+.+$/, '').trim(),
        author: authorMatch[1].trim(),
      };
    }
    return { synopsis: desc.trim(), author: '' };
  };

  const totalWords = projects.reduce(
    (sum, p) => sum + p.chapters.reduce((cs, c) => {
      const plain = (c.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
      return cs + plain.split(/\s+/).filter(Boolean).length;
    }, 0),
    0,
  );
  const totalChapters = projects.reduce((s, p) => s + p.chapters.length, 0);

  /* ── Create project ── */
  const handleCreate = useCallback(() => {
    const title = newTitle.trim();
    if (!title) return;
    // Encode author into description: "Synopsis text — by Author"
    const desc = newSynopsis.trim()
      ? (newAuthor.trim() ? `${newSynopsis.trim()} — by ${newAuthor.trim()}` : newSynopsis.trim())
      : (newAuthor.trim() ? `— by ${newAuthor.trim()}` : '');
    addProject(title, newGenre, desc);
    setNewTitle('');
    setNewAuthor('');
    setNewGenre(GENRES[0]);
    setNewSynopsis('');
    setShowModal(false);
  }, [newTitle, newAuthor, newGenre, newSynopsis, addProject]);

  /* ── Delete project ── */
  const handleDelete = useCallback(
    (id: string) => {
      deleteProject(id);
      setDeleteConfirm(null);
    },
    [deleteProject],
  );

  /* ── Import project ── */
  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setImportError(null);
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.endsWith('.json')) {
        setImportError('Please select a valid JSON backup file.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const text = ev.target?.result as string;
          const parsed = JSON.parse(text);
          if (!parsed.id || !parsed.name) {
            setImportError('Invalid backup: missing required fields (id, name).');
            return;
          }
          importProject(text);
        } catch {
          setImportError('Failed to parse JSON file. Check the file format.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [importProject],
  );

  /* ── Cover image upload ── */
  const handleCoverClick = useCallback((projectId: string) => {
    setEditingCoverId(projectId);
    coverInputRef.current?.click();
  }, []);

  const handleCoverChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editingCoverId) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useStore.getState().updateProject(editingCoverId, { coverImage: dataUrl } as any);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
      setEditingCoverId(null);
    },
    [editingCoverId],
  );

  /* ── AI Cover Generation ── */
  const handleAiCover = useCallback(
    async (e: React.MouseEvent, projectId: string) => {
      e.stopPropagation();
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      setGeneratingCover(projectId);
      const { synopsis } = parseDescription(project.description);

      // Extract chapter content for unique cover generation
      const chapters = project.chapters || [];
      let chapterText = '';
      if (chapters.length > 0) {
        chapterText = chapters.map(ch => {
          const text = ch.content.replace(/<[^>]*>/g, '');
          return `Chapter: "${ch.title}" - ${text.slice(0, 300)}`;
        }).join('\n');
      }

      try {
        const aiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_key') || '') : '';
        const aiProv = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_provider') || 'openrouter') : 'openrouter';
        const res = await fetch('/api/ai/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate-cover',
            data: {
              title: project.name,
              genre: project.genre,
              synopsis,
              chapterContent: chapterText,
            },
            apiKey: aiKey,
            provider: aiProv,
          }),
        });
        const data = await res.json();
        if (data.error) {
          alert(`Cover generation failed: ${data.error}`);
        } else if (data.content) {
          const dataUrl = `data:image/png;base64,${data.content}`;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          useStore.getState().updateProject(projectId, { coverImage: dataUrl } as any);
        }
      } catch (err) {
        alert(`Cover generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setGeneratingCover(null);
      }
    },
    [projects],
  );

  return (
    <main
      className="flex-1 overflow-y-auto relative"
      style={{
        background:
          'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(150,120,36,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 50% 10%, rgba(150,120,36,0.04) 0%, transparent 50%), linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)',
        minHeight: '100%',
      }}
    >
      {/* ── Background embossed decorative pattern ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5 L35 15 L45 15 L37 22 L40 32 L30 26 L20 32 L23 22 L15 15 L25 15 Z' fill='%23d4ad4a'/%3E%3C/svg%3E")`,
          backgroundSize: '120px 120px',
        }}
      />
      {/* Radial gold glow behind logo */}
      <div
        className="pointer-events-none absolute"
        style={{
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '600px',
          background: 'radial-gradient(ellipse at center, rgba(212,173,74,0.08) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="animate-fade-in max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
        {/* ═══════════════════════════════════════
            EPIC HERO SECTION
            ═══════════════════════════════════════ */}
        <header className="text-center mb-14 sm:mb-20 pt-6 sm:pt-10">
          {/* Decorative top ornament */}
          <div className="flex items-center justify-center mb-6 opacity-40">
            <div style={{ width: 80, height: 1, background: 'linear-gradient(90deg, transparent, #d4ad4a)' }} />
            <svg width="20" height="20" viewBox="0 0 20 20" className="mx-3" style={{ fill: '#d4ad4a' }}>
              <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z"/>
            </svg>
            <div style={{ width: 80, height: 1, background: 'linear-gradient(90deg, #d4ad4a, transparent)' }} />
          </div>

          {/* Large AI-generated logo */}
          <div className="flex flex-col items-center gap-5 mb-5">
            <div
              className="relative"
              style={{
                filter: 'drop-shadow(0 0 40px rgba(212,173,74,0.25)) drop-shadow(0 0 80px rgba(212,173,74,0.10))',
              }}
            >
              {/* Ornate ring behind logo */}
              <div
                className="absolute -inset-4 rounded-full"
                style={{
                  border: '1px solid rgba(212,173,74,0.12)',
                  animation: 'spin 60s linear infinite',
                }}
              />
              <div
                className="absolute -inset-8 rounded-full"
                style={{
                  border: '1px dashed rgba(212,173,74,0.06)',
                  animation: 'spin 90s linear infinite reverse',
                }}
              />
              <Image
                src="/logo-feather.svg"
                alt="Inkweave Logo"
                width={140}
                height={140}
                priority
                className="relative z-10"
                style={{ borderRadius: 16 }}
              />
            </div>
            <h1
              style={{
                fontFamily: '"Cinzel", Georgia, "Times New Roman", serif',
                fontSize: 'clamp(2.8rem, 6vw, 4.5rem)',
                fontWeight: 400,
                color: '#d4ad4a',
                letterSpacing: '8px',
                textShadow:
                  '0 0 40px rgba(212,173,74,0.3), 0 0 80px rgba(212,173,74,0.12), 0 2px 4px rgba(0,0,0,0.5)',
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              Inkweave
            </h1>
          </div>

          {/* Tagline */}
          <p
            style={{
              fontFamily: 'Georgia, "Times New Roman", serif',
              fontStyle: 'italic',
              fontSize: '1.15rem',
              color: '#bfb08a',
              margin: '0 0 20px 0',
              letterSpacing: '1px',
              textShadow: '0 0 20px rgba(191,176,138,0.15)',
            }}
          >
            Weave your world. Write your legend.
          </p>

          {/* Ornate divider */}
          <div className="flex items-center justify-center gap-3 opacity-50">
            <div style={{ width: 120, height: 1, background: 'linear-gradient(90deg, transparent, #a08038, transparent)' }} />
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ fill: '#a08038' }}>
              <path d="M8 0 L9.5 6.5 L16 8 L9.5 9.5 L8 16 L6.5 9.5 L0 8 L6.5 6.5 Z"/>
            </svg>
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: '#a08038', opacity: 0.6 }}>
              <circle cx="5" cy="5" r="3"/>
            </svg>
            <svg width="16" height="16" viewBox="0 0 16 16" style={{ fill: '#a08038' }}>
              <path d="M8 0 L9.5 6.5 L16 8 L9.5 9.5 L8 16 L6.5 9.5 L0 8 L6.5 6.5 Z"/>
            </svg>
            <div style={{ width: 120, height: 1, background: 'linear-gradient(90deg, transparent, #a08038, transparent)' }} />
          </div>
        </header>

        {/* ═══════════════════════════════════════
            FEATURE BANNERS
            ═══════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 sm:mb-16">
          {/* Feature 1 - AI Writing */}
          <div
            className="relative rounded-xl overflow-hidden p-5 text-center feature-card"
            style={{
              background: 'linear-gradient(135deg, rgba(212,173,74,0.06) 0%, rgba(160,128,56,0.03) 100%)',
              border: '1px solid rgba(212,173,74,0.1)',
            }}
          >
            <div className="text-2xl mb-2 flex items-center justify-center" style={{ color: '#d4ad4a', filter: 'drop-shadow(0 0 8px rgba(212,173,74,0.3))' }}>
              <IconSparkles size={24} />
            </div>
            <h4 style={{ fontFamily: 'Georgia, serif', color: '#d4ad4a', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>AI-Powered Writing</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>Deepen prose, enhance dialogue, generate world lore with intelligent AI assistance</p>
          </div>
          {/* Feature 2 - World Building */}
          <div
            className="relative rounded-xl overflow-hidden p-5 text-center feature-card"
            style={{
              background: 'linear-gradient(135deg, rgba(212,173,74,0.06) 0%, rgba(160,128,56,0.03) 100%)',
              border: '1px solid rgba(212,173,74,0.1)',
            }}
          >
            <div className="text-2xl mb-2">
              <BookOpen size={24} style={{ color: '#d4ad4a', display: 'inline', filter: 'drop-shadow(0 0 8px rgba(212,173,74,0.3))' }} />
            </div>
            <h4 style={{ fontFamily: 'Georgia, serif', color: '#d4ad4a', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>World Bible</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>Track characters, locations, magic systems, factions and lore in one living encyclopedia</p>
          </div>
          {/* Feature 3 - AI Covers */}
          <div
            className="relative rounded-xl overflow-hidden p-5 text-center feature-card"
            style={{
              background: 'linear-gradient(135deg, rgba(212,173,74,0.06) 0%, rgba(160,128,56,0.03) 100%)',
              border: '1px solid rgba(212,173,74,0.1)',
            }}
          >
            <div className="text-2xl mb-2">
              <ImagePlus size={24} style={{ color: '#d4ad4a', display: 'inline', filter: 'drop-shadow(0 0 8px rgba(212,173,74,0.3))' }} />
            </div>
            <h4 style={{ fontFamily: 'Georgia, serif', color: '#d4ad4a', fontSize: 14, fontWeight: 600, marginBottom: 4 }}>AI Cover Art</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.5 }}>Generate stunning book covers instantly with AI, crafted to match your story\'s genre</p>
          </div>
        </div>

        {/* ═══════════════════════════════════════
            FIRST-TIME WELCOME BANNER
            ═══════════════════════════════════════ */}
        {isFirstVisit && projects.length > 0 && (
          <div
            className="animate-fade-in rounded-xl p-5 sm:p-6 mb-8 sm:mb-12 text-center relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(212,173,74,0.08) 0%, rgba(160,128,56,0.04) 100%)',
              border: '1px solid rgba(212,173,74,0.15)',
            }}
          >
            {/* Subtle decorative glow */}
            <div
              className="pointer-events-none absolute"
              style={{
                top: -40,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 300,
                height: 200,
                background: 'radial-gradient(ellipse, rgba(212,173,74,0.1) 0%, transparent 70%)',
                filter: 'blur(30px)',
              }}
            />
            <div className="relative z-10">
              <div style={{ fontSize: 28, marginBottom: 8 }}>🖋️</div>
              <h3
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: '1.15rem',
                  fontWeight: 600,
                  color: '#d4ad4a',
                  margin: '0 0 8px 0',
                  letterSpacing: '0.5px',
                }}
              >
                Welcome to Inkweave — Your Fantasy Writing Studio
              </h3>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.875rem',
                  lineHeight: 1.7,
                  margin: '0 0 16px 0',
                  maxWidth: 480,
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                Craft rich fantasy worlds with a powerful manuscript editor, interactive world map,
                family tree builder, AI writing assistant, and more. Everything you need to bring
                your story to life.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, #a08038 0%, #d4ad4a 50%, #f0c850 100%)',
                    color: 'var(--text-primary)',
                    border: '1px solid rgba(240,200,80,0.3)',
                    boxShadow: '0 2px 12px rgba(212,173,74,0.25)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(212,173,74,0.4)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(212,173,74,0.25)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                  }}
                >
                  Create Your First Project
                </button>
                <span
                  style={{ fontSize: 12, color: 'var(--text-muted)' }}
                >
                  A quick tour awaits after creating your project
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            ACTION BUTTONS
            ═══════════════════════════════════════ */}
        {projects.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-10 sm:mb-14">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #a08038 0%, #d4ad4a 50%, #f0c850 100%)',
              color: 'var(--text-primary)',
              border: '1px solid rgba(240,200,80,0.3)',
              boxShadow: '0 2px 12px rgba(212,173,74,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 4px 20px rgba(212,173,74,0.4), inset 0 1px 0 rgba(255,255,255,0.15)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow =
                '0 2px 12px rgba(212,173,74,0.25), inset 0 1px 0 rgba(255,255,255,0.1)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            New Book
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            aria-label="Import project JSON file"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm transition-all duration-200"
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
            }}
          >
            <Upload size={16} />
            Import Backup
          </button>
        </div>
        )}

        {/* ── Import error ── */}
        {importError && (
          <div
            className="animate-fade-in rounded-lg px-4 py-3 mb-6 flex items-center justify-between gap-3"
            style={{
              background: 'rgba(160,72,72,0.1)',
              border: '1px solid rgba(160,72,72,0.3)',
            }}
          >
            <span className="text-sm" style={{ color: 'var(--accent-red)' }}>
              {importError}
            </span>
            <button
              onClick={() => setImportError(null)}
              style={{ color: 'var(--text-muted)' }}
              aria-label="Dismiss error"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════
            PROJECT CARDS GRID
            ═══════════════════════════════════════ */}
        {/* ═══════════════════════════════════════
            SECTION HEADER - YOUR LIBRARY
            ═══════════════════════════════════════ */}
        {projects.length > 0 && (
          <div className="flex items-center gap-4 mb-8">
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, var(--border-color))' }} />
            <h2
              style={{
                fontFamily: 'Georgia, "Times New Roman", serif',
                fontSize: '1.1rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Your Library
            </h2>
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, var(--border-color), transparent)' }} />
          </div>
        )}

        {projects.length === 0 ? (
          /* ── Empty State with decorative imagery ── */
          <div className="text-center py-16">
            
        {/* Ornamental divider */}
        <div className="ornamental-divider">
          <span className="ornament">{'✦'}</span>
        </div>

        {/* Decorative fantasy imagery */}
            <div className="flex items-center justify-center gap-6 mb-8">
              <div
                className="relative"
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid rgba(212,173,74,0.15)',
                  filter: 'drop-shadow(0 0 20px rgba(212,173,74,0.15))',
                  opacity: 0.7,
                }}
              >
                <Image src="/deco-dragon.png" alt="" fill style={{ objectFit: 'cover' }} />
              </div>
              <div
                className="relative"
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid rgba(212,173,74,0.2)',
                  filter: 'drop-shadow(0 0 30px rgba(212,173,74,0.2))',
                }}
              >
                <Image src="/logo-feather.svg" alt="" fill style={{ objectFit: 'cover' }} />
              </div>
              <div
                className="relative"
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  overflow: 'hidden',
                  border: '2px solid rgba(212,173,74,0.15)',
                  filter: 'drop-shadow(0 0 20px rgba(212,173,74,0.15))',
                  opacity: 0.7,
                }}
              >
                <Image src="/deco-tree.png" alt="" fill style={{ objectFit: 'cover' }} />
              </div>
            </div>
            <h3
              className="text-xl font-semibold mb-2"
              style={{
                fontFamily: 'Georgia, serif',
                color: 'var(--text-secondary)',
              }}
            >
              Your shelf is empty
            </h3>
            <p
              className="mb-8 max-w-sm mx-auto text-sm"
              style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}
            >
              Every legend begins with a single word. Create your first book
              and start weaving your tale.
            </p>
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg text-sm font-semibold transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #a08038 0%, #d4ad4a 50%, #f0c850 100%)',
                  color: 'var(--text-primary)',
                  border: '1px solid rgba(240,200,80,0.3)',
                  boxShadow: '0 2px 12px rgba(212,173,74,0.25)',
                }}
              >
                <Plus size={18} strokeWidth={2.5} />
                Begin Your Story
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs transition-all duration-200"
                style={{
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-color)',
                  background: 'transparent',
                }}
              >
                <Upload size={14} />
                or import an existing project
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {projects
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((project) => {
                const { synopsis, author } = parseDescription(project.description);
                const chapterCount = project.chapters.length;
                const wordCount = project.chapters.reduce(
                  (s, c) => {
                    const plain = (c.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                    return s + plain.split(/\s+/).filter(Boolean).length;
                  },
                  0,
                );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const coverImage = (project as any).coverImage as string | undefined;

                return (
                  <div
                    key={project.id}
                    className="animate-fade-in group relative rounded-lg overflow-hidden cursor-pointer"
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      transition:
                        'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform = 'translateY(-4px)';
                      el.style.boxShadow =
                        '0 12px 40px rgba(0,0,0,0.3), 0 0 30px rgba(212,173,74,0.06)';
                      el.style.borderColor = 'var(--border-light)';
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.transform = 'translateY(0)';
                      el.style.boxShadow = 'none';
                      el.style.borderColor = 'var(--border-color)';
                    }}
                    onClick={() => setActiveProject(project.id)}
                  >
                    {/* Gold top-line accent on hover */}
                    <div
                      className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                      style={{
                        background:
                          'linear-gradient(90deg, transparent 0%, #d4ad4a 30%, #f0c850 50%, #d4ad4a 70%, transparent 100%)',
                        boxShadow: '0 0 10px rgba(212,173,74,0.3)',
                      }}
                    />

                    {/* Cover image upload area */}
                    <div
                      className="relative overflow-hidden"
                      style={{
                        height: 220,
                        background: coverImage
                          ? 'var(--bg-primary)'
                          : 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-primary) 100%)',
                        borderBottom: coverImage
                          ? 'none'
                          : '1px solid var(--border-color)',
                        cursor: coverImage ? 'pointer' : undefined,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (coverImage) setPreviewCoverUrl(coverImage);
                      }}
                    >
                      {coverImage ? (
                        <Image
                          src={coverImage}
                          alt={`${project.name} cover`}
                          fill
                          className="object-cover"
                          style={{ opacity: 0.85 }}
                        />
                      ) : (
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                          style={{ opacity: 0.5 }}
                        >
                          <ImagePlus size={28} style={{ color: 'var(--text-muted)' }} />
                          <span
                            className="text-xs"
                            style={{
                              color: 'var(--text-muted)',
                              letterSpacing: '1px',
                            }}
                          >
                            Add Cover
                          </span>
                        </div>
                      )}

                      {/* Cover action buttons — appear on hover */}
                      <div
                        className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        style={{ background: 'rgba(0,0,0,0.25)' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs"
                          style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCoverClick(project.id);
                          }}
                          title="Upload image"
                        >
                          <ImagePlus size={14} />
                          Upload
                        </button>
                        <button
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs"
                          style={{
                            background: generatingCover === project.id
                              ? 'var(--bg-elevated)'
                              : 'linear-gradient(135deg, #a08038, #d4ad4a)',
                            border: '1px solid rgba(240,200,80,0.3)',
                            color: 'var(--text-primary)',
                            cursor: generatingCover === project.id ? 'wait' : 'pointer',
                            fontWeight: 600,
                          }}
                          onClick={(e) => handleAiCover(e, project.id)}
                          disabled={generatingCover === project.id}
                          title={coverImage ? 'Regenerate cover with AI' : 'Generate cover with AI'}
                        >
                          <IconSparkles size={14} />
                          {generatingCover === project.id
                            ? 'Generating...'
                            : coverImage
                              ? 'Regenerate'
                              : 'AI Cover'}
                        </button>
                        {coverImage && (
                          <button
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs"
                            style={{
                              background: 'var(--bg-tertiary)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewCoverUrl(coverImage);
                            }}
                            title="Preview cover"
                          >
                            <Eye size={14} />
                            Preview
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Card content */}
                    <div className="p-5 pb-6">
                      {/* Book title — gold serif */}
                      <h3
                        className="text-lg font-medium mb-1.5 leading-snug"
                        style={{
                          fontFamily: 'Georgia, "Times New Roman", serif',
                          color: '#d4ad4a',
                          letterSpacing: '0.3px',
                        }}
                      >
                        {project.name}
                      </h3>

                      {/* Meta line: author · genre · chapters */}
                      <p
                        className="text-xs mb-3 flex items-center gap-1 flex-wrap"
                        style={{
                          color: 'var(--text-muted)',
                          letterSpacing: '0.3px',
                        }}
                      >
                        {[
                          author || 'Unknown Author',
                          project.genre,
                          `${chapterCount} chapter${chapterCount !== 1 ? 's' : ''}`,
                        ]
                          .filter(Boolean)
                          .map((item, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && (
                                <span
                                  style={{
                                    color: 'var(--border-light)',
                                    margin: '0 2px',
                                  }}
                                >
                                  ·
                                </span>
                              )}
                              {item}
                            </span>
                          ))}
                      </p>

                      {/* Synopsis — serif font, clamped */}
                      {synopsis && (
                        <p
                          className="text-sm mb-4"
                          style={{
                            fontFamily: 'Georgia, "Times New Roman", serif',
                            color: 'var(--text-secondary)',
                            lineHeight: 1.65,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            fontStyle: 'italic',
                            fontSize: '0.85rem',
                          }}
                        >
                          {synopsis}
                        </p>
                      )}

                      {/* Stats */}
                      <div
                        className="flex items-center gap-4 text-xs"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        <span className="flex items-center gap-1.5">
                          <FileText size={13} style={{ color: 'var(--accent-gold-dim)' }} />
                          {wordCount.toLocaleString()} words
                        </span>
                        <span className="flex items-center gap-1.5">
                          <BookOpen size={13} style={{ color: 'var(--accent-gold-dim)' }} />
                          {chapterCount} ch.
                        </span>
                      </div>
                    </div>

                    {/* Delete button — appears on hover */}
                    <button
                      className="absolute top-3 right-3 rounded-md p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid rgba(160,72,72,0.4)',
                        backdropFilter: 'blur(4px)',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (deleteConfirm === project.id) {
                          handleDelete(project.id);
                        } else {
                          setDeleteConfirm(project.id);
                          setTimeout(() => setDeleteConfirm(null), 3000);
                        }
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          'rgba(160,72,72,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background =
                          'var(--bg-secondary)';
                      }}
                      aria-label={
                        deleteConfirm === project.id
                          ? `Confirm delete ${project.name}`
                          : `Delete ${project.name}`
                      }
                    >
                      {deleteConfirm === project.id ? (
                        <X
                          size={14}
                          style={{ color: '#c06060' }}
                        />
                      ) : (
                        <Trash2
                          size={14}
                          style={{ color: 'var(--text-muted)' }}
                        />
                      )}
                    </button>
                  </div>
                );
              })}
          </div>
        )}

        {/* ═══════════════════════════════════════
            FOOTER
            ═══════════════════════════════════════ */}
        {projects.length > 0 && (
          <footer
            className="mt-16 pt-8 pb-8 text-center"
            style={{ borderTop: '1px solid var(--border-color)' }}
          >
            {/* Ornate footer divider */}
            <div className="flex items-center justify-center gap-2 mb-4 opacity-40">
              <div style={{ width: 60, height: 1, background: 'linear-gradient(90deg, transparent, #a08038)' }} />
              <svg width="12" height="12" viewBox="0 0 12 12" style={{ fill: '#a08038' }}>
                <path d="M6 0 L7 5 L12 6 L7 7 L6 12 L5 7 L0 6 L5 5 Z"/>
              </svg>
              <div style={{ width: 60, height: 1, background: 'linear-gradient(90deg, #a08038, transparent)' }} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              {projects.length} book{projects.length !== 1 ? 's' : ''} ·{' '}
              {totalWords.toLocaleString()} words · {totalChapters} chapters
            </p>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)', opacity: 0.5, letterSpacing: '1px' }}>
              Crafted with passion for fantasy authors
            </p>
          </footer>
        )}
      </div>

      {/* ═══════════════════════════════════════
          NEW PROJECT MODAL — Backdrop Blur
          ═══════════════════════════════════════ */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="animate-fade-in w-full max-w-lg rounded-xl overflow-hidden"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 40px rgba(212,173,74,0.05)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header with gold accent */}
            <div
              className="px-6 py-4 flex items-center justify-between"
              style={{
                borderBottom: '1px solid var(--border-color)',
                background:
                  'linear-gradient(180deg, rgba(212,173,74,0.04) 0%, transparent 100%)',
              }}
            >
              <h3
                className="text-base font-semibold flex items-center gap-2"
                style={{
                  fontFamily: 'Georgia, "Times New Roman", serif',
                  color: '#d4ad4a',
                  letterSpacing: '0.5px',
                }}
              >
                <Plus size={18} strokeWidth={2.5} />
                New Book
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 transition-colors duration-200"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                }}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label
                  htmlFor="new-title"
                  className="block text-sm font-medium mb-2"
                  style={{
                    fontFamily: 'Georgia, serif',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.3px',
                  }}
                >
                  Title
                </label>
                <input
                  id="new-title"
                  type="text"
                  className="inkweave-input"
                  placeholder="e.g. The Ember Chronicles"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                  style={{
                    fontSize: '0.95rem',
                    padding: '10px 14px',
                  }}
                />
              </div>

              {/* Author */}
              <div>
                <label
                  htmlFor="new-author"
                  className="block text-sm font-medium mb-2"
                  style={{
                    fontFamily: 'Georgia, serif',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.3px',
                  }}
                >
                  Author
                </label>
                <input
                  id="new-author"
                  type="text"
                  className="inkweave-input"
                  placeholder="Your pen name"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                  }}
                  style={{
                    fontSize: '0.95rem',
                    padding: '10px 14px',
                  }}
                />
              </div>

              {/* Genre */}
              <div>
                <label
                  htmlFor="new-genre"
                  className="block text-sm font-medium mb-2"
                  style={{
                    fontFamily: 'Georgia, serif',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.3px',
                  }}
                >
                  Genre
                </label>
                <select
                  id="new-genre"
                  className="inkweave-input"
                  value={newGenre}
                  onChange={(e) => setNewGenre(e.target.value)}
                  style={{
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    padding: '10px 14px',
                  }}
                >
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* Synopsis */}
              <div>
                <label
                  htmlFor="new-synopsis"
                  className="block text-sm font-medium mb-2"
                  style={{
                    fontFamily: 'Georgia, serif',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.3px',
                  }}
                >
                  Synopsis{' '}
                  <span
                    style={{
                      color: 'var(--text-muted)',
                      fontWeight: 400,
                      fontStyle: 'italic',
                    }}
                  >
                    (optional)
                  </span>
                </label>
                <textarea
                  id="new-synopsis"
                  className="inkweave-input"
                  placeholder="A brief premise for your story..."
                  value={newSynopsis}
                  onChange={(e) => setNewSynopsis(e.target.value)}
                  rows={4}
                  style={{
                    resize: 'vertical',
                    minHeight: 90,
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    padding: '10px 14px',
                    fontFamily: 'Georgia, "Times New Roman", serif',
                  }}
                />
              </div>

              {/* Modal actions */}
              <div
                className="flex items-center justify-end gap-3 pt-2"
                style={{ borderTop: '1px solid var(--border-color)' }}
              >
                <button
                  className="inkweave-btn text-sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={{
                    background: newTitle.trim()
                      ? 'linear-gradient(135deg, #a08038 0%, #d4ad4a 50%, #f0c850 100%)'
                      : 'var(--bg-tertiary)',
                    color: newTitle.trim() ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: newTitle.trim()
                      ? '1px solid rgba(240,200,80,0.3)'
                      : '1px solid var(--border-color)',
                    cursor: newTitle.trim() ? 'pointer' : 'not-allowed',
                    opacity: newTitle.trim() ? 1 : 0.6,
                  }}
                  onClick={handleCreate}
                  disabled={!newTitle.trim()}
                >
                  <Plus size={16} strokeWidth={2.5} />
                  Create Book
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden cover image input */}
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverChange}
        aria-label="Upload cover image"
      />

      {/* ═══════════════════════════════════════
          COVER PREVIEW MODAL — Book-like frame
          ═══════════════════════════════════════ */}
      {previewCoverUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setPreviewCoverUrl(null)}
        >
          <div className="animate-fade-in relative" style={{ maxWidth: 480, width: '100%' }}>
            {/* Book-like frame with shadow and spine effect */}
            <div style={{
              boxShadow: '-8px 0 20px rgba(0,0,0,0.4), 0 20px 60px rgba(0,0,0,0.5)',
              borderRadius: '2px 8px 8px 2px',
              overflow: 'hidden',
              border: '3px solid rgba(0,0,0,0.2)',
              position: 'relative',
            }}>
              {/* Book spine effect on left */}
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 12,
                background: 'linear-gradient(90deg, rgba(0,0,0,0.15), transparent)',
                zIndex: 2,
              }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewCoverUrl} alt="Book cover preview" style={{ width: '100%', display: 'block' }} />
            </div>
            {/* Close button */}
            <button
              onClick={() => setPreviewCoverUrl(null)}
              style={{
                position: 'absolute', top: -12, right: -12,
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                color: 'var(--text-primary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
