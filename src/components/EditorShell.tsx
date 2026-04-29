'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useStore } from '@/lib/store';
import type { EditorMode, SidePanel } from '@/lib/types';
import { writingPrompts } from '@/lib/schemas';

import React from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from 'docx';
import { saveAs } from 'file-saver';
import RichTextEditor from '@/components/RichTextEditor';
import GridView from '@/components/GridView';
import OutlineView from '@/components/OutlineView';
import TimelineView from '@/components/TimelineView';
import ReadingMode from '@/components/ReadingMode';
import { StatsView } from '@/components/StatsView';
import GeneratorsView from '@/components/GeneratorsView';
import ChapterManager from '@/components/ChapterManager';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Dashboard from '@/components/Dashboard';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Sidebar from '@/components/Sidebar';
import { WorldBiblePanel } from '@/components/WorldBiblePanel';
import { MasterBiblePanel } from '@/components/MasterBiblePanel';
import { AiAssistant } from '@/components/AiAssistant';
import { NotesPanel } from '@/components/NotesPanel';
import MapCreatorPanel from '@/components/MapCreatorPanel';
import FamilyTreePanel from '@/components/FamilyTreePanel';
import SceneBreakdownPanel from '@/components/SceneBreakdownPanel';
import AiMusePanel from '@/components/AiMusePanel';
import OnboardingTour from '@/components/OnboardingTour';
import {
  IconChapters,
  IconWorldBible,
  IconMasterBible,
  IconNotes,
  IconAI,
  IconFocus,
  IconSearch,
  IconMusic,
  IconSparkles,
  IconSun,
  IconMoon,
  IconX,
  IconKeyboard,
  IconCamera,
  IconRestore,
  IconBookmark,
  IconTrash,
  IconTimeline,
  IconWrite,
  IconRead,
  IconWorldMap,
  IconFamilyTree,
  IconScenes,
  IconMuse,
} from './icons';

/* ── Local types ── */
interface SearchResult {
  chapterId: string;
  chapterTitle: string;
  matchCount: number;
  snippet: string;
}

interface Bookmark {
  id: string;
  chapterId: string;
  chapterTitle: string;
  label: string;
  createdAt: number;
}

interface ChapterSnapshot {
  id: string;
  chapterId: string;
  chapterTitle: string;
  content: string;
  createdAt: number;
}

/* ── Storage keys ── */
const STORAGE = {
  bookmarks: 'inkweave-bookmarks',
  snapshots: 'inkweave-snapshots',
  theme: 'inkweave-theme',
} as const;

/* ── Spotify presets ── */
const SPOTIFY_PRESETS = [
  { label: 'Fantasy Epic', id: '37i9dQZF1DX0AMssoUKCz7' },
  { label: 'Ambient', id: '37i9dQZF1DX4PP3DA4J0N8' },
  { label: 'Medieval', id: '37i9dQZF1DWWQRwui0ExPn' },
  { label: 'Lo-Fi', id: '37i9dQZF1DX8Uebhn9wzrS' },
];

/* ── Ambient sound definitions ── */
const AMBIENT_SOUNDS = [
  { id: 'rain', label: 'Rain', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg> },
  { id: 'fireplace', label: 'Fireplace', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c-4-3-8-6-8-11a8 8 0 0 1 16 0c0 5-4 8-8 11"/><path d="M12 12c-1-1-3-2-3-5 2 0 3 2 3 5Z"/><path d="M12 12c1-1 3-2 3-5-2 0-3 2-3 5Z"/></svg> },
  { id: 'forest', label: 'Forest', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 20H7l5-16 5 16Z"/><path d="M12 20V4"/><path d="M8 20l-4-8h8l-4 8Z"/></svg> },
  { id: 'wind', label: 'Wind', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg> },
  { id: 'thunder', label: 'Thunder', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><path d="M13 11l-4 6h6l-4 6"/></svg> },
];

/* ── Editor mode component map ── */
const editorComponents: Record<EditorMode, React.ComponentType> = {
  write: RichTextEditor,
  grid: GridView,
  outline: OutlineView,
  timeline: TimelineView,
  read: ReadingMode,
  stats: StatsView,
  generators: GeneratorsView,
  'world-map': MapCreatorPanel,
  'family-tree': FamilyTreePanel,
  'scenes': SceneBreakdownPanel,
};

/* ── Side panel component map ── */
const panelComponents: Record<string, React.ComponentType> = {
  chapters: ChapterManager,
  'world-bible': WorldBiblePanel,
  'master-bible': MasterBiblePanel,
  ai: AiAssistant,
  notes: NotesPanel,
  'ai-muse': AiMusePanel,
};

/* ── Panel toggle definitions ── */
interface PanelToggle {
  key: SidePanel;
  icon: React.ReactNode;
  label: string;
}

const panelToggles: PanelToggle[] = [
  { key: 'chapters', icon: <IconChapters size={14} />, label: 'Chapters' },
  { key: 'world-bible', icon: <IconWorldBible size={14} />, label: 'World Bible' },
  { key: 'master-bible', icon: <IconMasterBible size={14} />, label: 'Master Bible' },
  { key: 'notes', icon: <IconNotes size={14} />, label: 'Notes' },
  { key: 'ai', icon: <IconAI size={14} />, label: 'AI Assistant' },
  { key: 'ai-muse' as SidePanel, icon: <IconMuse size={14} />, label: 'AI Muse' },
];

/* ── Helpers ── */
const uid = () => Math.random().toString(36).slice(2, 11);

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatWordCount(n: number): string {
  return n.toLocaleString();
}



function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, data: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* storage full */ }
}

/* ── Writing mode type ── */
type WritingMode = 'light' | 'dark' | 'sepia' | 'typewriter';

const WRITING_MODES: WritingMode[] = ['light', 'dark', 'sepia', 'typewriter'];

/* ── Ambient Sound Manager ── */
class AmbientSoundManager {
  private ctx: AudioContext | null = null;
  private active = new Map<string, { source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode }>();

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private createNoise(ctx: AudioContext): AudioBufferSourceNode {
    const size = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  playKeystroke() {
    const ctx = this.getCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.03, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.02);
  }

  play(id: string) {
    if (this.active.has(id)) return;
    const ctx = this.getCtx();
    const source = this.createNoise(ctx);
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    switch (id) {
      case 'rain':
        filter.type = 'highpass'; filter.frequency.value = 4000;
        gain.gain.value = 0.12;
        break;
      case 'fireplace':
        filter.type = 'lowpass'; filter.frequency.value = 500;
        gain.gain.value = 0.20;
        break;
      case 'forest':
        filter.type = 'bandpass'; filter.frequency.value = 1500; filter.Q.value = 0.3;
        gain.gain.value = 0.08;
        break;
      case 'wind':
        filter.type = 'lowpass'; filter.frequency.value = 300;
        gain.gain.value = 0.15;
        break;
      case 'thunder':
        filter.type = 'lowpass'; filter.frequency.value = 100;
        gain.gain.value = 0.22;
        break;
      default:
        filter.type = 'lowpass'; filter.frequency.value = 1000;
        gain.gain.value = 0.10;
    }

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    this.active.set(id, { source, gain, filter });
  }

  stop(id: string) {
    const entry = this.active.get(id);
    if (!entry) return;
    entry.gain.gain.linearRampToValueAtTime(0, entry.gain.context.currentTime + 0.5);
    setTimeout(() => {
      try { entry.source.stop(); } catch { /* already stopped */ }
      this.active.delete(id);
    }, 600);
  }

  isPlaying(id: string): boolean {
    return this.active.has(id);
  }

  stopAll() {
    for (const key of Array.from(this.active.keys())) this.stop(key);
  }

  isCtxReady(): boolean {
    return this.ctx !== null;
  }
}

/* ── Sprint Timer sub-component ── */
function SprintTimer() {
  const sprintActive = useStore((s) => s.sprintActive);
  const sprintStartTime = useStore((s) => s.sprintStartTime);
  const sprintWordGoal = useStore((s) => s.sprintWordGoal);
  const sprintWordsWritten = useStore((s) => s.sprintWordsWritten);
  const endSprint = useStore((s) => s.endSprint);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!sprintActive) return;
    const interval = setInterval(() => {
      setElapsed(Date.now() - sprintStartTime);
    }, 1000);
    return () => clearInterval(interval);
  }, [sprintActive, sprintStartTime]);

  const progress = Math.min((sprintWordsWritten / Math.max(sprintWordGoal, 1)) * 100, 100);
  const isComplete = sprintWordsWritten >= sprintWordGoal;

  if (!sprintActive) return null;

  return (
    <div
      className="flex items-center gap-2 rounded-md px-2 py-1"
      style={{
        background: isComplete ? 'rgba(39, 174, 96, 0.15)' : 'rgba(212, 168, 83, 0.12)',
        border: `1px solid ${isComplete ? 'var(--accent-green, #27ae60)' : 'var(--accent-gold-dim)'}`,
      }}
    >
      <div className="shrink-0 rounded-full overflow-hidden" style={{ width: 60, height: 5, background: 'var(--bg-tertiary)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: isComplete ? 'var(--accent-green, #27ae60)' : 'var(--accent-gold)' }}
        />
      </div>
      <span className="tabular-nums font-mono text-xs" style={{ color: isComplete ? 'var(--accent-green, #27ae60)' : 'var(--accent-gold)', minWidth: 40 }}>
        {formatElapsed(elapsed)}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {formatWordCount(sprintWordsWritten)}/{formatWordCount(sprintWordGoal)}w
      </span>
      <button
        onClick={endSprint}
        className="flex items-center justify-center rounded transition-colors"
        style={{ width: 20, height: 20, background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        aria-label="End sprint" title="End sprint"
      ><IconX size={11} /></button>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   Main EditorShell component
   ════════════════════════════════════════════════════ */
export default function EditorShell() {
  /* ── Store selectors ── */
  const editorMode = useStore((s) => s.editorMode);
  const setEditorMode = useStore((s) => s.setEditorMode);
  const sidePanel = useStore((s) => s.sidePanel);
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeChapterId = useStore((s) => s.activeChapterId);
  const projects = useStore((s) => s.projects);
  const focusMode = useStore((s) => s.focusMode);
  const sprintActive = useStore((s) => s.sprintActive);
  const setSidePanel = useStore((s) => s.setSidePanel);
  const setFocusMode = useStore((s) => s.setFocusMode);
  const setActiveChapter = useStore((s) => s.setActiveChapter);
  const updateChapter = useStore((s) => s.updateChapter);
  const exportProject = useStore((s) => s.exportProject);

  /* ── Derived data ── */
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId),
    [projects, activeProjectId]
  );
  const activeChapter = useMemo(
    () => activeProject?.chapters.find((c) => c.id === activeChapterId),
    [activeProject, activeChapterId]
  );
  // Calculate total words by stripping HTML from actual content (not stored wordCount which may be stale)
  const totalWords = useMemo(
    () => {
      if (!activeProject) return 0;
      return activeProject.chapters.reduce((s, c) => {
        const plain = (c.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        return s + plain.split(/\s+/).filter(Boolean).length;
      }, 0);
    },
    [activeProject]
  );

  /* ── Status bar computed values ── */
  const { projectGoalPct, dailyGoalPct } = useMemo(() => {
    if (!activeProject) return { projectGoalPct: 0, dailyGoalPct: 0 };

    const weeklyGoal = activeProject.stats.weeklyGoal || 7000;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekWords = activeProject.stats.sessions
      .filter((s) => new Date(s.date) >= weekStart)
      .reduce((sum, s) => sum + s.words, 0);

    const today = new Date().toISOString().split('T')[0];
    const todayWords = activeProject.stats.sessions.find((s) => s.date === today)?.words || 0;
    const dailyGoal = activeProject.writingGoals.dailyWords || 1000;

    return {
      projectGoalPct: Math.min(Math.round((weekWords / weeklyGoal) * 100), 100),
      dailyGoalPct: Math.min(Math.round((todayWords / dailyGoal) * 100), 100),
    };
  }, [activeProject]);

  /* ── Panel visibility state ── */
  const [showSearch, setShowSearch] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [showWritingTools, setShowWritingTools] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  /* ── Search state ── */
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Session timer state ── */
  const [sessionRunning, setSessionRunning] = useState(false);
  const [sessionElapsed, setSessionElapsed] = useState(0);
  const [sessionWordsWritten, setSessionWordsWritten] = useState<number | null>(null);
  const sessionStartRef = useRef<number>(0);
  const sessionWordsStartRef = useRef<number>(0);
  const sessionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Music player state ── */
  const [spotifyUrl, setSpotifyUrl] = useState('');
  const [spotifyEmbedUrl, setSpotifyEmbedUrl] = useState('');

  /* ── Writing tools state (initialized from localStorage) ── */
  const [toolsTab, setToolsTab] = useState<'prompts' | 'ambient' | 'snapshots' | 'bookmarks'>('prompts');
  const [currentPrompt, setCurrentPrompt] = useState(() => writingPrompts[Math.floor(Math.random() * writingPrompts.length)]);
  const [activeSounds, setActiveSounds] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<ChapterSnapshot[]>(() => loadJson(STORAGE.snapshots, []));
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => loadJson(STORAGE.bookmarks, []));

  /* ── Theme state (initialized from localStorage) ── */
  const [writingMode, setWritingMode] = useState<WritingMode>(() => loadJson<WritingMode>(STORAGE.theme, 'light'));
  const [typewriterSounds, setTypewriterSounds] = useState(() => loadJson<boolean>('inkweave-typewriter-sounds', false));

  /* ── Onboarding state ── */
  const [showOnboarding, setShowOnboarding] = useState(false);

  /* Check localStorage on mount: show tour if not completed */
  useEffect(() => {
    try {
      const done = localStorage.getItem('inkweave-onboarding-done');
      if (!done && activeProjectId) {
        setShowOnboarding(true);
      }
    } catch { /* noop */ }
  }, [activeProjectId]);

  /* ── Save status ── */
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Audio manager ref ── */
  const audioRef = useRef<AmbientSoundManager | null>(null);

  /* ── Mobile detection ── */
  const [isMobile, setIsMobile] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* Close export menu on outside click */
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu]);

  /* ── Editor / Panel components ── */
  const EditorComponent = editorComponents[editorMode];
  const PanelComponent = sidePanel !== 'none' ? panelComponents[sidePanel] : null;

  /* ──────────── Panel conflict resolution ──────────── */
  const closeAllOverlays = useCallback(() => {
    setShowSearch(false);
    setShowMusic(false);
    setShowWritingTools(false);
    setSidePanel('none');
  }, [setSidePanel]);

  const openSearch = useCallback(() => {
    setShowMusic(false);
    setShowWritingTools(false);
    setSidePanel('none');
    setShowSearch((v) => !v);
  }, [setSidePanel]);

  const openMusic = useCallback(() => {
    setShowSearch(false);
    setShowWritingTools(false);
    setSidePanel('none');
    setShowMusic((v) => !v);
  }, [setSidePanel]);

  const openWritingTools = useCallback(() => {
    setShowSearch(false);
    setShowMusic(false);
    setSidePanel('none');
    setShowWritingTools((v) => !v);
  }, [setSidePanel]);

  const handlePanelToggle = useCallback(
    (key: SidePanel) => {
      setShowSearch(false);
      setShowMusic(false);
      setShowWritingTools(false);
      setSidePanel(sidePanel === key ? 'none' : key);
    },
    [sidePanel, setSidePanel]
  );

  /* ──────────── Search logic ──────────── */
  const performSearch = useCallback(
    (query: string) => {
      if (!query.trim() || !activeProject) {
        setSearchResults([]);
        return;
      }
      const q = query.toLowerCase();
      const results: SearchResult[] = [];

      for (const chapter of activeProject.chapters) {
        const fullText = (chapter.title + ' ' + chapter.content).toLowerCase();
        let count = 0;
        let idx = 0;
        while ((idx = fullText.indexOf(q, idx)) >= 0) {
          count++;
          idx += q.length;
        }
        if (count === 0) continue;

        const contentIdx = chapter.content.toLowerCase().indexOf(q);
        let snippet = '';
        if (contentIdx >= 0) {
          const start = Math.max(0, contentIdx - 30);
          const end = Math.min(chapter.content.length, contentIdx + query.length + 50);
          snippet = (start > 0 ? '...' : '') + chapter.content.slice(start, end).replace(/\n/g, ' ').trim() + (end < chapter.content.length ? '...' : '');
        } else {
          snippet = 'Found in title';
        }

        results.push({ chapterId: chapter.id, chapterTitle: chapter.title, matchCount: count, snippet });
      }

      setSearchResults(results);
    },
    [activeProject]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => performSearch(value), 300);
    },
    [performSearch]
  );

  /* ──────────── Session timer logic ──────────── */
  const toggleSession = useCallback(() => {
    if (sessionRunning) {
      // Stop session
      if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
      sessionIntervalRef.current = null;
      setSessionRunning(false);
      setSessionWordsWritten(totalWords - sessionWordsStartRef.current);
    } else {
      // Start session
      setSessionRunning(true);
      setSessionElapsed(0);
      setSessionWordsWritten(null);
      sessionStartRef.current = Date.now();
      sessionWordsStartRef.current = totalWords;
      sessionIntervalRef.current = setInterval(() => {
        setSessionElapsed(Date.now() - sessionStartRef.current);
      }, 1000);
    }
  }, [sessionRunning, totalWords]);

  /* ──────────── Save status flash ──────────── */
  const flashSaveStatus = useCallback(() => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => setSaveStatus('saved'), 1500);
  }, []);

  /* ──────────── Export functions ──────────── */
  const downloadFile = useCallback((filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    flashSaveStatus();
  }, [flashSaveStatus]);

  const exportTxt = useCallback(() => {
    if (!activeProject) return;
    const text = activeProject.chapters
      .sort((a, b) => a.order - b.order)
      .map((c) => `--- ${c.title} ---\n\n${stripHtml(c.content).trim()}`)
      .join('\n\n');
    downloadFile(`${activeProject.name}.txt`, text, 'text/plain');
  }, [activeProject, downloadFile]);

  const exportHtml = useCallback(() => {
    if (!activeProject) return;
    const chapters = activeProject.chapters
      .sort((a, b) => a.order - b.order)
      .map((c) => `  <section>\n    <h2>${escapeHtml(c.title)}</h2>\n    <div>${c.content || '<p></p>'}</div>\n  </section>`)
      .join('\n');
    const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${escapeHtml(activeProject.name)}</title>\n  <style>body{font-family:Georgia,serif;max-width:700px;margin:2rem auto;padding:0 1rem;line-height:1.8;color:#333}h1,h2{color:#5a3e28}section{margin-bottom:2em}</style>\n</head>\n<body>\n  <h1>${escapeHtml(activeProject.name)}</h1>\n${chapters}\n</body>\n</html>`;
    downloadFile(`${activeProject.name}.html`, html, 'text/html');
  }, [activeProject, downloadFile]);

  const exportJson = useCallback(() => {
    if (!activeProjectId) return;
    const data = exportProject(activeProjectId);
    if (!data) return;
    const name = activeProject?.name || 'project';
    downloadFile(`${name}.json`, data, 'application/json');
  }, [activeProjectId, activeProject, exportProject, downloadFile]);

  const exportDocx = useCallback(async () => {
    if (!activeProject) return;
    const sorted = activeProject.chapters.sort((a, b) => a.order - b.order);
    const children: (Paragraph)[] = [
      new Paragraph({
        children: [new TextRun({ text: activeProject.name, font: 'Georgia', size: 48, bold: true })],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
      }),
    ];
    for (let i = 0; i < sorted.length; i++) {
      const ch = sorted[i];
      children.push(
        new Paragraph({
          children: [new TextRun({ text: ch.title, font: 'Georgia', size: 32, bold: true })],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 360, after: 200 },
        }),
      );
      const plainText = stripHtml(ch.content).trim();
      if (plainText) {
        const paragraphs = plainText.split(/\n\n+/);
        for (const p of paragraphs) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: p.replace(/\n/g, ' '), font: 'Georgia', size: 22 })],
              spacing: { line: 276, after: 200 },
            }),
          );
        }
      }
      if (i < sorted.length - 1) {
        children.push(
          new Paragraph({
            children: [new PageBreak()],
          }),
        );
      }
    }
    const doc = new Document({
      creator: 'Inkweave',
      title: activeProject.name,
      description: `Exported from Inkweave`,
      sections: [{ children }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${activeProject.name}.docx`);
    flashSaveStatus();
  }, [activeProject, flashSaveStatus]);

  const exportPdf = useCallback(() => {
    if (!activeProject) return;
    const sorted = activeProject.chapters.sort((a, b) => a.order - b.order);
    const chapterSections = sorted.map((ch) => {
      const plainText = stripHtml(ch.content).trim();
      const paragraphs = plainText
        ? plainText.split(/\n\n+/).map((p) => `<p>${escapeHtml(p.replace(/\n/g, ' '))}</p>`).join('\n')
        : '<p></p>';
      return `  <section class="chapter">\n    <h2>${escapeHtml(ch.title)}</h2>\n    ${paragraphs}\n  </section>`;
    }).join('\n');
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(activeProject.name)}</title>
  <style>
    @page { margin: 1in; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #1a1a1a;
    }
    .title-page {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      page-break-after: always;
    }
    .title-page h1 {
      font-size: 28pt;
      color: #3a3a3a;
      text-align: center;
    }
    .chapter {
      page-break-before: always;
      margin-bottom: 2em;
    }
    .chapter:first-of-type {
      page-break-before: avoid;
    }
    .chapter h2 {
      font-size: 20pt;
      color: #2a2a2a;
      margin-bottom: 0.5em;
    }
    .chapter p {
      text-indent: 0.5in;
      margin-bottom: 0.3em;
    }
    @media print {
      .title-page { min-height: auto; padding-top: 3in; }
    }
  </style>
</head>
<body>
  <div class="title-page"><h1>${escapeHtml(activeProject.name)}</h1></div>
${chapterSections}
</body>
</html>`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 500);
    };
  }, [activeProject]);

  /* ──────────── Theme toggle ──────────── */
  const toggleTheme = useCallback(() => {
    setWritingMode((prev) => {
      const idx = WRITING_MODES.indexOf(prev);
      const next = WRITING_MODES[(idx + 1) % WRITING_MODES.length];
      document.body.classList.remove('dark-theme', 'sepia-theme', 'typewriter-theme');
      if (next === 'dark') document.body.classList.add('dark-theme');
      else if (next === 'sepia') document.body.classList.add('sepia-theme');
      else if (next === 'typewriter') document.body.classList.add('typewriter-theme');
      saveJson(STORAGE.theme, next);
      return next;
    });
  }, []);

  /* ──────────── Typewriter sound toggle ──────────── */
  const toggleTypewriterSounds = useCallback(() => {
    setTypewriterSounds((prev) => {
      const next = !prev;
      saveJson('inkweave-typewriter-sounds', next);
      return next;
    });
  }, []);

  /* ──────────── Writing prompts ──────────── */
  const rollPrompt = useCallback(() => {
    setCurrentPrompt(writingPrompts[Math.floor(Math.random() * writingPrompts.length)]);
  }, []);

  /* ──────────── Ambient sound toggle ──────────── */
  const toggleSound = useCallback((id: string) => {
    const mgr = audioRef.current!;
    if (mgr.isPlaying(id)) {
      mgr.stop(id);
      setActiveSounds((prev) => prev.filter((s) => s !== id));
    } else {
      mgr.play(id);
      setActiveSounds((prev) => [...prev, id]);
    }
  }, []);

  /* ──────────── Snapshots ──────────── */
  const saveSnapshot = useCallback(() => {
    if (!activeProjectId || !activeChapter) return;
    const snap: ChapterSnapshot = {
      id: uid(),
      chapterId: activeChapter.id,
      chapterTitle: activeChapter.title,
      content: activeChapter.content,
      createdAt: Date.now(),
    };
    const updated = [snap, ...snapshots].slice(0, 10);
    setSnapshots(updated);
    saveJson(STORAGE.snapshots, updated);
  }, [activeProjectId, activeChapter, snapshots]);

  const restoreSnapshot = useCallback(
    (snap: ChapterSnapshot) => {
      if (!activeProjectId) return;
      updateChapter(activeProjectId, snap.chapterId, { content: snap.content });
      setActiveChapter(snap.chapterId);
    },
    [activeProjectId, updateChapter, setActiveChapter]
  );

  const deleteSnapshot = useCallback(
    (id: string) => {
      const updated = snapshots.filter((s) => s.id !== id);
      setSnapshots(updated);
      saveJson(STORAGE.snapshots, updated);
    },
    [snapshots]
  );

  /* ──────────── Bookmarks ──────────── */
  const addBookmark = useCallback(() => {
    if (!activeChapter) return;
    const bm: Bookmark = {
      id: uid(),
      chapterId: activeChapter.id,
      chapterTitle: activeChapter.title,
      label: activeChapter.title,
      createdAt: Date.now(),
    };
    const updated = [bm, ...bookmarks];
    setBookmarks(updated);
    saveJson(STORAGE.bookmarks, updated);
  }, [activeChapter, bookmarks]);

  const deleteBookmark = useCallback(
    (id: string) => {
      const updated = bookmarks.filter((b) => b.id !== id);
      setBookmarks(updated);
      saveJson(STORAGE.bookmarks, updated);
    },
    [bookmarks]
  );

  /* ──────────── Spotify helpers ──────────── */
  const buildEmbedUrl = useCallback((playlistId: string) => {
    return `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;
  }, []);

  const loadSpotifyUrl = useCallback(() => {
    let playlistId = '';
    // Try to extract from URL
    const match = spotifyUrl.match(/playlist\/([a-zA-Z0-9]+)/);
    if (match) {
      playlistId = match[1];
    } else if (spotifyUrl.match(/^[a-zA-Z0-9]+$/)) {
      playlistId = spotifyUrl;
    }
    if (playlistId) {
      setSpotifyEmbedUrl(buildEmbedUrl(playlistId));
    }
  }, [spotifyUrl, buildEmbedUrl]);

  const loadPreset = useCallback((presetId: string) => {
    setSpotifyEmbedUrl(buildEmbedUrl(presetId));
    setSpotifyUrl('');
  }, [buildEmbedUrl]);

  /* ──────────── Keyboard shortcuts ──────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Esc — exit focus / close overlays
      if (e.key === 'Escape') {
        if (showShortcuts) { setShowShortcuts(false); return; }
        if (showSearch) { setShowSearch(false); return; }
        if (showMusic) { setShowMusic(false); return; }
        if (showWritingTools) { setShowWritingTools(false); return; }
        if (sidePanel !== 'none') { setSidePanel('none'); return; }
        if (focusMode) { setFocusMode(false); return; }
      }
      // Ctrl/Cmd combos
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        flashSaveStatus();
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        openSearch();
      }
      if (editorMode === 'write') {
        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          document.execCommand('bold');
        }
        if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          document.execCommand('italic');
        }
        if (e.key === 'u' || e.key === 'U') {
          e.preventDefault();
          document.execCommand('underline');
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showShortcuts, showSearch, showMusic, showWritingTools, sidePanel, focusMode, editorMode, setFocusMode, setSidePanel, openSearch, flashSaveStatus]);

  /* ── Recalculate stale word counts from stored content ── */
  useEffect(() => {
    let needsUpdate = false;
    const updates: Array<{ projectId: string; chapterId: string; wordCount: number }> = [];
    for (const p of projects) {
      for (const c of p.chapters) {
        const plain = (c.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
        const correct = plain.split(/\s+/).filter(Boolean).length;
        if (c.wordCount !== correct) {
          needsUpdate = true;
          updates.push({ projectId: p.id, chapterId: c.id, wordCount: correct });
        }
      }
    }
    if (needsUpdate) {
      for (const u of updates) {
        useStore.getState().updateChapter(u.projectId, u.chapterId, { content: useStore.getState().projects.find(p => p.id === u.projectId)?.chapters.find(c => c.id === u.chapterId)?.content || '' });
      }
    }
  }, []); // run once on mount

  /* ──────────── Mount side effects (no setState) ──────────── */
  useEffect(() => {
    document.body.classList.remove('dark-theme', 'sepia-theme', 'typewriter-theme');
    if (writingMode === 'dark') document.body.classList.add('dark-theme');
    else if (writingMode === 'sepia') document.body.classList.add('sepia-theme');
    else if (writingMode === 'typewriter') document.body.classList.add('typewriter-theme');
    if (!audioRef.current) audioRef.current = new AmbientSoundManager();
  }, [writingMode]);

  /* ──────────── Typewriter keystroke sound ──────────── */
  useEffect(() => {
    if (writingMode !== 'typewriter' || !typewriterSounds) return;
    const handler = (e: KeyboardEvent) => {
      // Only play for printable characters in the editor
      const target = e.target as HTMLElement;
      if (!target.closest('.editor-content') && !target.closest('[contenteditable]')) return;
      if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Tab') {
        audioRef.current?.playKeystroke();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [writingMode, typewriterSounds]);

  /* ──────────── Cleanup on unmount ──────────── */
  useEffect(() => {
    return () => {
      if (sessionIntervalRef.current) clearInterval(sessionIntervalRef.current);
      if (audioRef.current) audioRef.current.stopAll();
    };
  }, []);

  /* ══════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════ */
  const anyOverlay = showSearch || showMusic || showWritingTools || sidePanel !== 'none';

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden animate-fade-in" style={{ position: 'relative' }}>

      {/* ── Onboarding Tour Overlay ── */}
      {showOnboarding && (
        <OnboardingTour
          onComplete={() => { setShowOnboarding(false); saveJson('inkweave-onboarding-done', true); }}
          onSkip={() => setShowOnboarding(false)}
        />
      )}

      {/* ════════════════════════════════════════
          MODE BAR (always visible)
          ════════════════════════════════════════ */}
      <header
        className="flex items-center gap-1 px-3 shrink-0 select-none"
        style={{
          height: 44,
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          zIndex: 10,
          fontFamily: "'Georgia', serif",
        }}
      >
        {/* ── Panel toggles ── */}
        <div className="flex items-center gap-0.5 shrink-0">
          {panelToggles.map((pt) => {
            const isActive = sidePanel === pt.key;
            return (
              <button
                key={pt.key}
                onClick={() => handlePanelToggle(pt.key)}
                className="flex items-center justify-center rounded-md transition-colors"
                style={{
                  width: 28,
                  height: 28,
                  background: isActive ? 'var(--bg-elevated)' : 'transparent',
                  border: isActive ? '1px solid var(--border-light)' : '1px solid transparent',
                  cursor: 'pointer',
                  }}
                aria-label={pt.label}
                aria-pressed={isActive}
                title={pt.label}
              >
                {pt.icon}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-6 mx-1 shrink-0" style={{ background: 'var(--border-color)' }} />

        {/* ── Focus, Search, World Map, Family Tree ── */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => { setFocusMode(!focusMode); if (!focusMode) closeAllOverlays(); }}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{
              width: 28, height: 28,
              background: focusMode ? 'rgba(212,168,83,0.15)' : 'transparent',
              border: focusMode ? '1px solid var(--accent-gold-dim)' : '1px solid transparent',
              cursor: 'pointer', fontSize: 14, color: focusMode ? 'var(--accent-gold)' : 'var(--text-muted)',
            }}
            title="Focus Mode (Esc to exit)"
          ><IconFocus size={14} /></button>
          <button
            onClick={openSearch}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{
              width: 28, height: 28,
              background: showSearch ? 'var(--bg-elevated)' : 'transparent',
              border: showSearch ? '1px solid var(--border-light)' : '1px solid transparent',
              cursor: 'pointer', fontSize: 14, color: showSearch ? 'var(--accent-gold)' : 'var(--text-muted)',
            }}
            title="Search (Ctrl+F)"
          ><IconSearch size={14} /></button>
          {/* World Map toggle */}
          <button
            onClick={() => setEditorMode(editorMode === 'world-map' ? 'write' : 'world-map')}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{
              width: 28, height: 28,
              background: editorMode === 'world-map' ? 'rgba(212,168,83,0.15)' : 'transparent',
              border: editorMode === 'world-map' ? '1px solid var(--accent-gold-dim)' : '1px solid transparent',
              cursor: 'pointer', color: editorMode === 'world-map' ? 'var(--accent-gold)' : 'var(--text-muted)',
            }}
            title="World Map"
          ><IconWorldMap size={14} /></button>
          {/* Family Tree toggle */}
          <button
            onClick={() => setEditorMode(editorMode === 'family-tree' ? 'write' : 'family-tree')}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{
              width: 28, height: 28,
              background: editorMode === 'family-tree' ? 'rgba(212,168,83,0.15)' : 'transparent',
              border: editorMode === 'family-tree' ? '1px solid var(--accent-gold-dim)' : '1px solid transparent',
              cursor: 'pointer', color: editorMode === 'family-tree' ? 'var(--accent-gold)' : 'var(--text-muted)',
            }}
            title="Family Tree"
          ><IconFamilyTree size={14} /></button>
          {/* Scenes & Beats toggle */}
          <button
            onClick={() => setEditorMode(editorMode === 'scenes' ? 'write' : 'scenes')}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{
              width: 28, height: 28,
              background: editorMode === 'scenes' ? 'rgba(212,168,83,0.15)' : 'transparent',
              border: editorMode === 'scenes' ? '1px solid var(--accent-gold-dim)' : '1px solid transparent',
              cursor: 'pointer', color: editorMode === 'scenes' ? 'var(--accent-gold)' : 'var(--text-muted)',
            }}
            title="Scenes & Beats"
          ><IconScenes size={14} /></button>
        </div>

        {/* ── Export buttons ── */}
        {isMobile ? (
          /* Mobile: compact dropdown */
          <div className="shrink-0 ml-1 relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              className="flex items-center justify-center rounded-md transition-colors"
              style={{
                width: 28, height: 28,
                background: showExportMenu ? 'var(--bg-elevated)' : 'transparent',
                border: showExportMenu ? '1px solid var(--border-light)' : '1px solid transparent',
                cursor: 'pointer', color: 'var(--text-muted)',
              }}
              title="Export"
              aria-label="Export"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            {showExportMenu && (
              <div
                className="absolute right-0 top-full mt-1 rounded-lg shadow-lg z-50 py-1"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-light)',
                  minWidth: 120,
                }}
              >
                {(['TXT', 'HTML', 'DOCX', 'PDF', 'JSON'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => {
                      const handler = fmt === 'TXT' ? exportTxt : fmt === 'HTML' ? exportHtml : fmt === 'DOCX' ? exportDocx : fmt === 'PDF' ? exportPdf : exportJson;
                      handler();
                      setShowExportMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs transition-colors"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontFamily: "'Georgia', serif",
                      letterSpacing: 0.3,
                    }}
                  >
                    Export {fmt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Desktop: inline buttons */
          <div className="flex items-center gap-0.5 shrink-0 ml-1">
            {(['TXT', 'HTML', 'DOCX', 'PDF', 'JSON'] as const).map((fmt) => {
              const handler = fmt === 'TXT' ? exportTxt : fmt === 'HTML' ? exportHtml : fmt === 'DOCX' ? exportDocx : fmt === 'PDF' ? exportPdf : exportJson;
              const isDocx = fmt === 'DOCX';
              const isPdf = fmt === 'PDF';
              return (
                <button
                  key={fmt}
                  onClick={handler}
                  className="rounded px-1.5 py-0.5 text-xs transition-colors"
                  style={{
                    background: isDocx
                      ? 'linear-gradient(180deg, rgba(56,117,188,0.12), rgba(56,117,188,0.04))'
                      : isPdf
                        ? 'linear-gradient(180deg, rgba(188,56,56,0.12), rgba(188,56,56,0.04))'
                        : 'linear-gradient(180deg, rgba(160,128,56,0.1), rgba(160,128,56,0.04))',
                    border: isDocx
                      ? '1px solid rgba(56,117,188,0.25)'
                      : isPdf
                        ? '1px solid rgba(188,56,56,0.25)'
                        : '1px solid rgba(212,173,74,0.15)',
                    color: isDocx
                      ? 'rgba(56,117,188,0.8)'
                      : isPdf
                        ? 'rgba(188,56,56,0.8)'
                        : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: 600, fontSize: 10,
                    fontFamily: "'Georgia', serif",
                    letterSpacing: 0.5,
                  }}
                  title={`Export as ${fmt}`}
                >{fmt}</button>
              );
            })}
          </div>
        )}

        {/* ── Spacer ── */}
        <div className="flex-1 min-w-0" />

        {/* ── Right section ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Sprint timer */}
          {sprintActive && <SprintTimer />}

          {/* Session timer */}
          <button
            onClick={toggleSession}
            className="flex items-center gap-1 rounded-md px-2 py-1 transition-colors"
            style={{
              background: sessionRunning ? 'rgba(212,168,83,0.12)' : 'var(--bg-tertiary)',
              border: `1px solid ${sessionRunning ? 'var(--accent-gold-dim)' : 'var(--border-color)'}`,
              cursor: 'pointer',
            }}
            title={sessionRunning ? 'Stop session timer' : 'Start session timer'}
          >
            <IconTimeline size={11} />
            <span className="font-mono text-xs tabular-nums" style={{ color: sessionRunning ? 'var(--accent-gold)' : 'var(--text-secondary)', minWidth: 40 }}>
              {formatElapsed(sessionElapsed)}
            </span>
            {!sessionRunning && sessionWordsWritten !== null && sessionWordsWritten > 0 && (
              <span className="text-xs" style={{ color: 'var(--accent-green)' }}>+{sessionWordsWritten}w</span>
            )}
          </button>

          {/* Word count */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <IconWrite size={11} />
            <span className="text-xs font-mono tabular-nums" style={{ color: 'var(--text-secondary)' }}>
              {formatWordCount(totalWords)}w
            </span>
          </div>

          {/* Save status */}
          <div className="mobile-hide flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}>
            <span
              className="inline-block rounded-full"
              style={{ width: 6, height: 6, background: saveStatus === 'saved' ? 'var(--accent-green)' : 'var(--accent-gold)' }}
            />
            <span className="text-xs" style={{ color: saveStatus === 'saved' ? 'var(--text-muted)' : 'var(--accent-gold)' }}>
              {saveStatus === 'saved' ? 'Saved' : 'Saving...'}
            </span>
          </div>

          {/* Typewriter sound toggle (only visible in typewriter mode) */}
          {writingMode === 'typewriter' && (
            <button
              onClick={toggleTypewriterSounds}
              className="flex items-center justify-center rounded-md transition-colors"
              style={{
                width: 28, height: 28,
                background: typewriterSounds ? 'rgba(138,170,110,0.15)' : 'transparent',
                border: typewriterSounds ? '1px solid rgba(138,170,110,0.3)' : '1px solid transparent',
                cursor: 'pointer',
              }}
              title={typewriterSounds ? 'Mute typewriter sounds' : 'Enable typewriter sounds'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: typewriterSounds ? 'var(--accent-gold)' : 'var(--text-muted)' }}>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {typewriterSounds ? (
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                ) : (
                  <line x1="23" y1="9" x2="17" y2="15" />
                )}
                {typewriterSounds ? (
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                ) : (
                  <line x1="17" y1="9" x2="23" y2="15" />
                )}
              </svg>
            </button>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center rounded-md transition-colors"
            style={{ width: 28, height: 28, background: 'transparent', border: '1px solid transparent', cursor: 'pointer', fontSize: 15 }}
            title={`Writing mode: ${writingMode} (click to cycle)`}
          >
            {writingMode === 'light' && <IconSun size={14} />}
            {writingMode === 'dark' && <IconMoon size={14} />}
            {writingMode === 'sepia' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#b8912e' }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a10 10 0 0 1 0 20 7 7 0 0 0 0-14 4.5 4.5 0 0 1 0-6" />
              </svg>
            )}
            {writingMode === 'typewriter' && (
              <span style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, fontSize: 14, color: 'var(--accent-gold)' }}>T</span>
            )}
          </button>

          {/* Guided Tour button */}
          <button
            onClick={() => setShowOnboarding(true)}
            className="mobile-hide flex items-center justify-center rounded-md transition-colors"
            style={{
              width: 28, height: 28,
              background: 'transparent',
              border: '1px solid transparent',
              cursor: 'pointer',
              fontSize: 14,
              color: 'var(--text-muted)',
            }}
            title="Take a tour"
            aria-label="Take a guided tour"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          {/* Keyboard shortcuts */}
          <button
            onClick={() => setShowShortcuts(true)}
            className="mobile-hide flex items-center justify-center rounded-md transition-colors"
            style={{
              width: 28, height: 28,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
            }}
            title="Keyboard shortcuts"
          >?</button>
        </div>
      </header>

      {/* ════════════════════════════════════════
          MAIN CONTENT AREA
          ════════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Center editor area ── */}
        <main className="flex-1 overflow-hidden flex flex-col">
          <EditorComponent key={editorMode} />
        </main>

        {/* ── Right side panel (existing) ── */}
        {PanelComponent && !showMusic && !showWritingTools && !showSearch && (
          <aside className="inkweave-panel shrink-0 animate-slide-in" style={{ width: 380 }}>
            {/* Mobile drag handle */}
            <div
              className="md:hidden"
              style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--border-light)', margin: '6px auto 0' }}
            />
            <div
              className="manuscript-header flex items-center justify-between"
              style={{ padding: '10px 16px 8px' }}
            >
              <span className="text-sm font-semibold" style={{ color: 'var(--accent-gold)', letterSpacing: 0.5, textShadow: '0 0 12px rgba(212,173,74,0.15)' }}>
                {panelToggles.find((pt) => pt.key === sidePanel)?.label || sidePanel === 'ai' ? 'AI Assistant' : 'Panel'}
              </span>
              <button
                onClick={() => setSidePanel('none')}
                className="flex items-center justify-center rounded-md transition-colors"
                style={{ width: 24, height: 24, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}
                aria-label="Close panel"
              ><IconX size={14} /></button>
            </div>
            <div className="overflow-y-auto" style={{ height: 'calc(100% - 40px)' }}>
              <PanelComponent key={sidePanel} />
            </div>
          </aside>
        )}
      </div>

      {/* ════════════════════════════════════════
          STATUS BAR
          ════════════════════════════════════════ */}
      <footer
        className="flex items-center gap-4 px-4 shrink-0 select-none"
        style={{
          height: 30,
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          zIndex: 10,
          fontFamily: "'Georgia', serif",
        }}
      >
        {/* Chapter count */}
        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <span style={{ fontSize: 11 }}><IconRead size={11} /></span>
          {activeProject?.chapters.length || 0} chapters
        </span>

        {/* Total words */}
        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
          <span style={{ fontSize: 11 }}><IconWrite size={11} /></span>
          {formatWordCount(totalWords)} words
        </span>

        {/* Project goal */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Weekly Goal</span>
          <div className="rounded-full overflow-hidden" style={{ width: 80, height: 5, background: 'var(--bg-tertiary)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${projectGoalPct}%`, background: 'var(--accent-gold)' }} />
          </div>
          <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{projectGoalPct}%</span>
        </div>

        {/* Daily goal */}
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Daily</span>
          <div className="rounded-full overflow-hidden" style={{ width: 80, height: 5, background: 'var(--bg-tertiary)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${dailyGoalPct}%`, background: 'var(--accent-green)' }} />
          </div>
          <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{dailyGoalPct}%</span>
        </div>
      </footer>

      {/* ════════════════════════════════════════
          FLOATING BUTTONS (right edge)
          ════════════════════════════════════════ */}
      {!focusMode && (
        <div
          className="fixed flex flex-col gap-2"
          style={{ right: anyOverlay ? 404 : 16, top: '50%', transform: 'translateY(-50%)', zIndex: 35, transition: 'right 0.3s ease' }}
        >
          {/* Music Player */}
          <button
            onClick={openMusic}
            className="flex items-center justify-center rounded-full transition-all shadow-lg"
            style={{
              width: 44, height: 44,
              background: showMusic ? 'var(--accent-green)' : 'var(--bg-elevated)',
              border: `2px solid ${showMusic ? 'var(--accent-green)' : 'var(--border-light)'}`,
              cursor: 'pointer', fontSize: 18,
              color: showMusic ? 'var(--bg-primary)' : 'var(--text-primary)',
              boxShadow: showMusic ? '0 0 12px rgba(39,174,96,0.4)' : 'var(--shadow)',
            }}
            title="Music Player"
          ><IconMusic size={20} /></button>

          {/* Writing Tools */}
          <button
            onClick={openWritingTools}
            className="flex items-center justify-center rounded-full transition-all shadow-lg"
            style={{
              width: 44, height: 44,
              background: showWritingTools ? 'var(--accent-purple)' : 'var(--bg-elevated)',
              border: `2px solid ${showWritingTools ? 'var(--accent-purple)' : 'var(--border-light)'}`,
              cursor: 'pointer', fontSize: 18,
              color: showWritingTools ? 'var(--bg-primary)' : 'var(--text-primary)',
              boxShadow: showWritingTools ? '0 0 12px rgba(142,107,191,0.4)' : 'var(--shadow)',
            }}
            title="Writing Tools"
          ><IconSparkles size={20} /></button>
        </div>
      )}

      {/* ════════════════════════════════════════
          SEARCH PANEL
          ════════════════════════════════════════ */}
      {showSearch && (
        <div
          className="fixed flex flex-col animate-slide-in"
          style={{ right: 0, top: 44, bottom: 30, width: 400, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', zIndex: 30 }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
            <IconSearch size={15} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Search &amp; Replace</span>
            <div className="flex-1" />
            <button onClick={() => setShowSearch(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><IconX size={16} /></button>
          </div>

          {/* Search input */}
          <div className="px-4 py-3 shrink-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search across all chapters..."
              className="inkweave-input"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {searchQuery && searchResults.length === 0 && (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No results found.</p>
            )}
            {searchResults.map((r) => (
              <button
                key={r.chapterId}
                onClick={() => { setActiveChapter(r.chapterId); setShowSearch(false); }}
                className="w-full text-left p-3 rounded-lg mb-2 transition-colors"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', cursor: 'pointer' }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--accent-gold)' }}>{r.chapterTitle}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                    {r.matchCount} match{r.matchCount > 1 ? 'es' : ''}
                  </span>
                </div>
                {r.snippet && (
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {highlightMatch(r.snippet, searchQuery)}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          MUSIC PLAYER PANEL
          ════════════════════════════════════════ */}
      {showMusic && (
        <div
          className="fixed flex flex-col animate-slide-in"
          style={{ right: 0, top: 44, bottom: 30, width: 400, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', zIndex: 30 }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
            <IconMusic size={15} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Music Player</span>
            <div className="flex-1" />
            <button onClick={() => setShowMusic(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><IconX size={16} /></button>
          </div>

          {/* Spotify section */}
          <div style={{ padding: '12px 16px' }}>
            <h4 style={{ fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 600, color: 'var(--accent-gold)', marginBottom: 12, letterSpacing: 0.5 }}>
              Spotify Playlists
            </h4>

            {/* Preset buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              {SPOTIFY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => loadPreset(preset.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', fontSize: 12,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 6, cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontFamily: 'Georgia, serif',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#1DB954' }}>
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom URL input */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={spotifyUrl}
                onChange={e => setSpotifyUrl(e.target.value)}
                placeholder="Paste Spotify playlist URL..."
                className="inkweave-input"
                style={{ fontSize: 12, padding: '8px 10px', flex: 1 }}
                onKeyDown={e => { if (e.key === 'Enter') loadSpotifyUrl(); }}
              />
              <button
                onClick={loadSpotifyUrl}
                disabled={!spotifyUrl.trim()}
                style={{
                  padding: '8px 12px', fontSize: 12,
                  background: spotifyUrl.trim() ? '#1DB954' : 'var(--bg-tertiary)',
                  border: 'none', borderRadius: 6,
                  color: spotifyUrl.trim() ? '#fff' : 'var(--text-muted)',
                  cursor: spotifyUrl.trim() ? 'pointer' : 'not-allowed',
                  fontFamily: 'Georgia, serif',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                Open
              </button>
            </div>

            {/* Spotify Embed Player */}
            {spotifyEmbedUrl && (
              <div style={{ marginTop: 12 }}>
                <iframe
                  src={spotifyEmbedUrl}
                  width="100%"
                  height={352}
                  frameBorder={0}
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  style={{ borderRadius: 12, display: 'block' }}
                />
              </div>
            )}

            {/* Info message */}
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, fontStyle: 'italic', lineHeight: 1.5 }}>
              Log in through the player above with your Spotify account for full song playback.
            </p>
          </div>

          {/* Ambient sounds section */}
          <div style={{ padding: '0 16px 12px', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 600, color: 'var(--accent-gold)', marginBottom: 10, letterSpacing: 0.5, marginTop: 12 }}>
              Ambient Sounds
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {AMBIENT_SOUNDS.map((sound) => {
                const isOn = activeSounds.includes(sound.id);
                return (
                  <button
                    key={sound.id}
                    onClick={() => toggleSound(sound.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 10px', fontSize: 12,
                      background: isOn ? 'rgba(212,168,83,0.1)' : 'var(--bg-tertiary)',
                      border: `1px solid ${isOn ? 'var(--accent-gold-dim)' : 'var(--border-color)'}`,
                      borderRadius: 6, cursor: 'pointer',
                      color: isOn ? 'var(--accent-gold)' : 'var(--text-secondary)',
                      fontFamily: 'Georgia, serif',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      if (!isOn) { el.style.borderColor = 'var(--border-light)'; el.style.background = 'var(--bg-elevated)'; }
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      if (!isOn) { el.style.borderColor = 'var(--border-color)'; el.style.background = 'var(--bg-tertiary)'; }
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', width: 16, height: 16 }}>{sound.icon}</span>
                    {sound.label}
                  </button>
                );
              })}
            </div>
            {activeSounds.length > 0 && (
              <button
                onClick={() => { audioRef.current?.stopAll(); setActiveSounds([]); }}
                style={{
                  marginTop: 8, width: '100%', padding: '6px 10px', fontSize: 11,
                  background: 'none', border: '1px solid var(--border-color)',
                  borderRadius: 6, cursor: 'pointer',
                  color: 'var(--accent-red)', fontFamily: 'Georgia, serif',
                }}
              >
                Stop All Sounds
              </button>
            )}
          </div>

          {/* Spacer fills remaining space */}
          <div className="flex-1" />

          {/* Bottom visual placeholder */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px 12px', borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(29,185,84,0.06) 0%, rgba(212,168,83,0.06) 100%)',
              border: '1px solid var(--border-color)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#1DB954' }}>
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
              </svg>
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Georgia, serif', lineHeight: 1.3 }}>Listening Session</p>
                <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Select a playlist above to begin</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          WRITING TOOLS PANEL
          ════════════════════════════════════════ */}
      {showWritingTools && (
        <div
          className="fixed flex flex-col animate-slide-in"
          style={{ right: 0, top: 44, bottom: 30, width: 400, background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border-color)', zIndex: 30 }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
            <IconSparkles size={15} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Writing Tools</span>
            <div className="flex-1" />
            <button onClick={() => setShowWritingTools(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><IconX size={16} /></button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
            {(['prompts', 'ambient', 'snapshots', 'bookmarks'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setToolsTab(tab)}
                className="tab-btn flex-1 text-center capitalize"
                style={toolsTab === tab ? { color: 'var(--accent-gold)', borderBottomColor: 'var(--accent-gold)' } : {}}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">

            {/* ── Prompts Tab ── */}
            {toolsTab === 'prompts' && (
              <div className="flex flex-col gap-4">
                <div className="inkweave-card" style={{ padding: 20, minHeight: 120 }}>
                  <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Writing Prompt</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)', fontStyle: 'italic' }}>
                    &ldquo;{currentPrompt}&rdquo;
                  </p>
                </div>
                <button onClick={rollPrompt} className="inkweave-btn inkweave-btn-primary w-full">
                  ✨ Another Prompt
                </button>
              </div>
            )}

            {/* ── Ambient Tab ── */}
            {toolsTab === 'ambient' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Toggle ambient sounds to set the mood. Click to play/pause.</p>
                {AMBIENT_SOUNDS.map((sound) => {
                  const isOn = activeSounds.includes(sound.id);
                  return (
                    <button
                      key={sound.id}
                      onClick={() => toggleSound(sound.id)}
                      className="flex items-center gap-3 w-full p-3 rounded-lg transition-colors"
                      style={{
                        background: isOn ? 'rgba(212,168,83,0.1)' : 'var(--bg-tertiary)',
                        border: `1px solid ${isOn ? 'var(--accent-gold-dim)' : 'var(--border-color)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <span className="flex items-center justify-center" style={{ width: 20, height: 20 }}>{sound.icon}</span>
                      <span className="text-sm font-medium" style={{ color: isOn ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                        {sound.label}
                      </span>
                      <div className="flex-1" />
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: isOn ? 'var(--accent-gold)' : 'var(--bg-elevated)',
                          color: isOn ? 'var(--bg-primary)' : 'var(--text-muted)',
                        }}
                      >
                        {isOn ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  );
                })}
                {activeSounds.length > 0 && (
                  <button
                    onClick={() => { audioRef.current?.stopAll(); setActiveSounds([]); }}
                    className="inkweave-btn w-full text-xs"
                    style={{ color: 'var(--accent-red)' }}
                  >
                    Stop All Sounds
                  </button>
                )}
              </div>
            )}

            {/* ── Snapshots Tab ── */}
            {toolsTab === 'snapshots' && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={saveSnapshot}
                  className="inkweave-btn inkweave-btn-primary w-full"
                  disabled={!activeChapter}
                  style={{ opacity: activeChapter ? 1 : 0.5 }}
                >
                  <IconCamera size={14} className="inline mr-1" /> Save Snapshot
                </button>
                {!activeChapter && (
                  <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Select a chapter to save a snapshot</p>
                )}
                {snapshots.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No snapshots yet. Save your first chapter snapshot.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                    {snapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="flex items-center gap-2 p-3 rounded-lg"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{snap.chapterTitle}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {new Date(snap.createdAt).toLocaleString()} &middot; {snap.content.trim().split(/\s+/).filter(Boolean).length} words
                          </p>
                        </div>
                        <button
                          onClick={() => restoreSnapshot(snap)}
                          className="inkweave-btn text-xs"
                          style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}
                          title="Restore this snapshot"
                        ><IconRestore size={12} className="inline mr-1" />Restore</button>
                        <button
                          onClick={() => deleteSnapshot(snap.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: '4px' }}
                          title="Delete snapshot"
                        ><IconTrash size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Bookmarks Tab ── */}
            {toolsTab === 'bookmarks' && (
              <div className="flex flex-col gap-3">
                <button
                  onClick={addBookmark}
                  className="inkweave-btn inkweave-btn-primary w-full"
                  disabled={!activeChapter}
                  style={{ opacity: activeChapter ? 1 : 0.5 }}
                >
                  <IconBookmark size={14} className="inline mr-1" /> Bookmark This Chapter
                </button>
                {!activeChapter && (
                  <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Select a chapter to bookmark</p>
                )}
                {bookmarks.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No bookmarks yet. Bookmark chapters for quick navigation.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
                    {bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        className="flex items-center gap-2 p-3 rounded-lg"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)' }}
                      >
                        <IconBookmark size={14} />
                        <button
                          onClick={() => { setActiveChapter(bm.chapterId); setShowWritingTools(false); }}
                          className="flex-1 text-left min-w-0"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{bm.label}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {new Date(bm.createdAt).toLocaleString()}
                          </p>
                        </button>
                        <button
                          onClick={() => deleteBookmark(bm.id)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', padding: '4px' }}
                          title="Delete bookmark"
                        ><IconTrash size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          KEYBOARD SHORTCUTS MODAL
          ════════════════════════════════════════ */}
      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
          <div
            onClick={(e) => e.stopPropagation()}
            className="inkweave-card"
            style={{ width: 420, maxWidth: '90vw', padding: 24, borderColor: 'rgba(212,173,74,0.25)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--accent-gold)', fontFamily: "'Georgia', serif", letterSpacing: '0.5px' }}><IconKeyboard size={18} className="inline mr-2" />Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="flex items-center justify-center rounded-md transition-colors"
                style={{ width: 28, height: 28, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer' }}
              ><IconX size={14} /></button>
            </div>
            <div className="flex flex-col gap-2">
              {[
                ['Ctrl + S', 'Save project'],
                ['Ctrl + F', 'Search across chapters'],
                ['Ctrl + B', 'Bold text'],
                ['Ctrl + I', 'Italic text'],
                ['Ctrl + U', 'Underline text'],
                ['Esc', 'Exit focus mode / close panels'],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between py-2" style={{ borderBottom: '1px solid rgba(212,173,74,0.1)' }}>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{desc}</span>
                  <kbd
                    className="px-2 py-0.5 rounded text-xs font-mono"
                    style={{ background: 'rgba(160,128,56,0.1)', border: '1px solid rgba(212,173,74,0.25)', color: 'var(--accent-gold)', padding: '2px 8px', fontFamily: "'Georgia', serif" }}
                  >
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="text-xs mt-4 text-center" style={{ color: 'var(--text-muted)' }}>Click outside or press Esc to close</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Utility: strip HTML tags ── */
function stripHtml(html: string): string {
  if (typeof document === 'undefined') return html;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/* ── Utility: escape HTML entities ── */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Utility: highlight search match in snippet ── */
function highlightMatch(snippet: string, query: string): React.ReactNode {
  if (!query.trim()) return snippet;
  const idx = snippet.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return snippet;
  return (
    <>
      {snippet.slice(0, idx)}
      <mark style={{ background: 'rgba(212,168,83,0.35)', color: 'var(--accent-gold)', padding: '0 2px', borderRadius: 2 }}>
        {snippet.slice(idx, idx + query.length)}
      </mark>
      {snippet.slice(idx + query.length)}
    </>
  );
}
