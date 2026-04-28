'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';
import type { WorldEntry, WorldCategory } from '@/lib/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function countWords(html: string): number {
  if (!html) return 0;
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.split(/\s+/).filter(Boolean).length;
}

function readingTime(wordCount: number): string {
  const minutes = Math.max(1, Math.ceil(wordCount / 250));
  return `${minutes} min read`;
}

function getPlainText(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function getSelectedText(): string {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return '';
  return sel.toString();
}

function getLastParagraph(html: string): string {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const blocks = tmp.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote');
  if (blocks.length > 0) {
    return (blocks[blocks.length - 1].textContent || '').trim();
  }
  return (tmp.textContent || '').trim().slice(-500);
}

// (reserved for future cursor-context features)

// ── Levenshtein distance ──────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

// ── Text analysis helpers ─────────────────────────────────────────────────────

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function analyzeText(text: string) {
  if (!text.trim()) {
    return { flesch: 0, grade: 0, avgSentence: 0, passivePercent: 0, inconsistencies: [], repeatedWords: [] };
  }

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const totalWords = words.length;

  // Flesch Reading Ease: 206.835 - 1.015 * (words/sentences) - 84.6 * (syllables/words)
  const avgSentenceLen = sentences.length > 0 ? totalWords / sentences.length : 0;
  const avgSyllablesPerWord = totalWords > 0 ? totalSyllables / totalWords : 0;
  const flesch = Math.max(0, Math.min(100,
    206.835 - 1.015 * avgSentenceLen - 84.6 * avgSyllablesPerWord
  ));

  // Grade Level (Flesch-Kincaid): 0.39 * (words/sentences) + 11.8 * (syllables/words) - 15.59
  const grade = Math.max(0, Math.round(
    0.39 * avgSentenceLen + 11.8 * avgSyllablesPerWord - 15.59
  ));

  // Passive voice detection (simple heuristic)
  const passivePatterns = /\b(was|were|is|are|been|being|be)\s+\w+(ed|en)\b/gi;
  const passiveMatches = text.match(passivePatterns) || [];
  const passivePercent = sentences.length > 0 ? Math.round((passiveMatches.length / sentences.length) * 100) : 0;

  // Difficulty label
  let difficulty: string;
  if (flesch >= 80) difficulty = 'Easy';
  else if (flesch >= 60) difficulty = 'Standard';
  else if (flesch >= 40) difficulty = 'Moderate';
  else difficulty = 'Difficult';

  return {
    flesch: Math.round(flesch),
    grade,
    avgSentence: Math.round(avgSentenceLen * 10) / 10,
    passivePercent,
    difficulty,
    inconsistencies: [] as string[],
    repeatedWords: [] as { word: string; count: number; positions: number[] }[],
  };
}

function findNameInconsistencies(text: string, worldBible: WorldEntry[]): string[] {
  const foundWords = new Set<string>();
  const inconsistencies: string[] = [];

  // Extract all capitalized words from text
  const capitalized = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  const textWords = capitalized.map(w => w.toLowerCase());

  for (const entry of worldBible) {
    const nameLower = entry.name.toLowerCase();
    for (const textWord of textWords) {
      if (levenshtein(textWord, nameLower) === 1 && textWord !== nameLower) {
        // Find the original capitalized form
        const original = capitalized[textWords.indexOf(textWord)];
        const key = `${original}→${entry.name}`;
        if (!foundWords.has(key)) {
          foundWords.add(key);
          inconsistencies.push(`${original} (possible misspelling of "${entry.name}")`);
        }
      }
    }
  }

  return inconsistencies.slice(0, 10);
}

function findRepeatedWords(text: string, windowSize = 40): { word: string; count: number; positions: number[] }[] {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);
  const stopWords = new Set(['that', 'this', 'with', 'from', 'have', 'were', 'been', 'they', 'them', 'their', 'there', 'would', 'could', 'should', 'about', 'which', 'where', 'when', 'what', 'your', 'will', 'each', 'make', 'like', 'just', 'over', 'such', 'take', 'than', 'them', 'very', 'some', 'into', 'also', 'then', 'only']);
  const repeated: Map<string, { count: number; positions: number[] }> = new Map();

  for (let i = 0; i < words.length; i++) {
    if (stopWords.has(words[i])) continue;
    for (let j = i + 1; j < Math.min(i + windowSize, words.length); j++) {
      if (words[i] === words[j]) {
        const existing = repeated.get(words[i]);
        if (existing) {
          existing.count++;
          if (!existing.positions.includes(i)) existing.positions.push(i);
        } else {
          repeated.set(words[i], { count: 1, positions: [i] });
        }
        break; // Only count first duplicate within window
      }
    }
  }

  return Array.from(repeated.entries())
    .map(([word, data]) => ({ word, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// ── Category icons ────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<WorldCategory, string> = {
  characters: '👤',
  locations: '🏰',
  magic: '✨',
  lore: '📖',
  items: '🗡️',
  factions: '⚔️',
};

// ── AI action prompts ─────────────────────────────────────────────────────────

const AI_ACTIONS = [
  { key: 'improve', label: 'Improve', prompt: 'Improve this passage overall. Enhance word choice, sentence variety, flow, clarity, and prose quality while preserving the author\'s voice, tone, and meaning. Fix any awkward phrasing, strengthen weak verbs, and ensure the writing feels polished and engaging:' },
  { key: 'simplify', label: 'Simplify', prompt: 'Simplify this passage, making it clearer and more concise while preserving the core meaning and voice:' },
  { key: 'sensory', label: 'Sensory Enrich', prompt: 'Enrich this passage with vivid sensory details (sight, sound, smell, touch, taste) without changing the plot or meaning:' },
  { key: 'dialogue', label: 'Improve Dialogue', prompt: 'Improve the dialogue in this passage. Make it sound more natural, give each character a distinct voice, add subtext, and show emotions through action beats:' },
  { key: 'tension', label: 'Add Tension', prompt: 'Rewrite this passage to increase tension and suspense. Use pacing, foreshadowing, shorter sentences, and raise the stakes:' },
  { key: 'expand', label: 'Expand', prompt: 'Expand this passage with more detail, internal monologue, and narrative depth. Maintain the tone and style:' },
  { key: 'titles', label: 'Suggest Titles', prompt: 'Based on the following chapter content, suggest 6 creative and evocative chapter title options. Return ONLY the titles, one per line, numbered 1-6. No explanations:' },
] as const;

type AiActionKey = typeof AI_ACTIONS[number]['key'];

// ── Toolbar button data ───────────────────────────────────────────────────────

interface ToolbarBtn {
  command: string;
  value?: string;
  icon: React.ReactNode;
  label: string;
  queryState?: string;
}

const FORMAT_BOLD: ToolbarBtn = {
  command: 'bold',
  label: 'Bold',
  queryState: 'bold',
  icon: <strong style={{ fontWeight: 800 }}>B</strong>,
};

const FORMAT_ITALIC: ToolbarBtn = {
  command: 'italic',
  label: 'Italic',
  queryState: 'italic',
  icon: <em style={{ fontStyle: 'italic' }}>I</em>,
};

const FORMAT_UNDERLINE: ToolbarBtn = {
  command: 'underline',
  label: 'Underline',
  queryState: 'underline',
  icon: <span style={{ textDecoration: 'underline' }}>U</span>,
};

const FORMAT_STRIKETHROUGH: ToolbarBtn = {
  command: 'strikeThrough',
  label: 'Strikethrough',
  queryState: 'strikeThrough',
  icon: <span style={{ textDecoration: 'line-through' }}>S</span>,
};

const HEADING_1: ToolbarBtn = {
  command: 'formatBlock',
  value: 'H1',
  label: 'Heading 1',
  icon: <span style={{ fontWeight: 700, fontSize: 14 }}>H1</span>,
};

const HEADING_2: ToolbarBtn = {
  command: 'formatBlock',
  value: 'H2',
  label: 'Heading 2',
  icon: <span style={{ fontWeight: 700, fontSize: 13 }}>H2</span>,
};

const HEADING_3: ToolbarBtn = {
  command: 'formatBlock',
  value: 'H3',
  label: 'Heading 3',
  icon: <span style={{ fontWeight: 700, fontSize: 12 }}>H3</span>,
};

const BLOCKQUOTE: ToolbarBtn = {
  command: 'formatBlock',
  value: 'BLOCKQUOTE',
  label: 'Blockquote',
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
    </svg>
  ),
};

const UNORDERED_LIST: ToolbarBtn = {
  command: 'insertUnorderedList',
  label: 'Bullet List',
  queryState: 'insertUnorderedList',
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
};

const ORDERED_LIST: ToolbarBtn = {
  command: 'insertOrderedList',
  label: 'Numbered List',
  queryState: 'insertOrderedList',
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="6" x2="21" y2="6" /><line x1="10" y1="12" x2="21" y2="12" /><line x1="10" y1="18" x2="21" y2="18" />
      <text x="3" y="8" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">1</text>
      <text x="3" y="14" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">2</text>
      <text x="3" y="20" fontSize="8" fill="currentColor" stroke="none" fontWeight="bold">3</text>
    </svg>
  ),
};

const ALIGN_LEFT: ToolbarBtn = {
  command: 'justifyLeft',
  label: 'Align Left',
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="17" y1="10" x2="3" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="17" y1="18" x2="3" y2="18" />
    </svg>
  ),
};

const ALIGN_CENTER: ToolbarBtn = {
  command: 'justifyCenter',
  label: 'Align Center',
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="10" x2="6" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="18" y1="18" x2="6" y2="18" />
    </svg>
  ),
};

const ALIGN_RIGHT: ToolbarBtn = {
  command: 'justifyRight',
  label: 'Align Right',
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="10" x2="7" y2="10" /><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="14" x2="3" y2="14" /><line x1="21" y1="18" x2="7" y2="18" />
    </svg>
  ),
};

const INSERT_DIVIDER: ToolbarBtn = {
  command: 'insertHorizontalRule',
  label: 'Insert Divider',
  icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  ),
};

// Toolbar groups
const TOOLBAR_GROUPS: ToolbarBtn[][] = [
  [FORMAT_BOLD, FORMAT_ITALIC, FORMAT_UNDERLINE, FORMAT_STRIKETHROUGH],
  [HEADING_1, HEADING_2, HEADING_3],
  [BLOCKQUOTE, UNORDERED_LIST, ORDERED_LIST],
  [ALIGN_LEFT, ALIGN_CENTER, ALIGN_RIGHT],
  [INSERT_DIVIDER],
];

// ── Shared button style helper ────────────────────────────────────────────────

const toolbarBtnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  background: 'transparent',
  color: 'var(--text-secondary)',
  transition: 'background 0.15s, color 0.15s',
  fontSize: 14,
  padding: 0,
};

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="inkweave-btn"
      style={{
        ...toolbarBtnBase,
        background: active ? 'var(--accent-gold-dim)' : 'transparent',
        color: active ? 'var(--accent-gold)' : 'var(--text-secondary)',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--bg-hover)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {children}
    </button>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RichTextEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sprintIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [wordCount, setWordCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const isInternalUpdate = useRef(false);
  const prevWordCountRef = useRef(0);

  // Chapter title state
  const [chapterTitle, setChapterTitle] = useState('');

  // AI bar state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiActionKey, setAiActionKey] = useState<AiActionKey | null>(null);

  // Quick Codex state
  const [showCodex, setShowCodex] = useState(false);
  const [codexSearch, setCodexSearch] = useState('');
  const [selectedCodexEntry, setSelectedCodexEntry] = useState<WorldEntry | null>(null);

  // Bookmark state
  const [showBookmarkInput, setShowBookmarkInput] = useState(false);
  const [bookmarkLabel, setBookmarkLabel] = useState('');

  // Analyze / Polish Panel state
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [analysisData, setAnalysisData] = useState<{
    flesch: number;
    grade: number;
    avgSentence: number;
    passivePercent: number;
    difficulty: string;
    inconsistencies: string[];
    repeatedWords: { word: string; count: number; positions: number[] }[];
  } | null>(null);

  // Sprint state
  const [sprintElapsed, setSprintElapsed] = useState(0);
  const [sprintStartWordCount, setSprintStartWordCount] = useState(0);

  // Search & Replace state
  const [showSearchReplace, setShowSearchReplace] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ chapterId: string; chapterTitle: string; chapterIndex: number; snippet: string }[]>([]);

  // Store bindings
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeChapterId = useStore((s) => s.activeChapterId);
  const getActiveChapter = useStore((s) => s.getActiveChapter);
  const getActiveProject = useStore((s) => s.getActiveProject);
  const updateChapter = useStore((s) => s.updateChapter);
  const addNote = useStore((s) => s.addNote);
  const setActiveChapter = useStore((s) => s.setActiveChapter);
  const startSprint = useStore((s) => s.startSprint);
  const endSprint = useStore((s) => s.endSprint);
  const updateSprintWords = useStore((s) => s.updateSprintWords);
  const sprintActive = useStore((s) => s.sprintActive);
  const recordSession = useStore((s) => s.recordSession);
  const aiSettings = useStore((s) => s.aiSettings);
  const projects = useStore((s) => s.projects);

  // ── Derive chapter and project ────────────────────────────────────────────

  const chapter = getActiveChapter();
  const project = getActiveProject();

  const chapterIndex = useMemo(() => {
    if (!project || !chapter) return 0;
    return project.chapters.findIndex(c => c.id === chapter.id) + 1;
  }, [project, chapter]);

  const worldBible = useMemo(() => project?.worldBible || [], [project]);

  // ── Load chapter content ────────────────────────────────────────────────────

  useEffect(() => {
    const ch = getActiveChapter();
    if (editorRef.current && ch) {
      isInternalUpdate.current = true;
      editorRef.current.innerHTML = ch.content || '';
      const wc = ch.wordCount || countWords(ch.content);
      setWordCount(wc);
      prevWordCountRef.current = wc;
      isInternalUpdate.current = false;
      setSaveStatus('idle');
      setChapterTitle(ch.title || '');
    }
  }, [activeProjectId, activeChapterId, getActiveChapter]);

  // ── Save handler (debounced) ────────────────────────────────────────────────

  const saveContent = useCallback(
    (html: string) => {
      if (!activeProjectId || !activeChapterId) return;
      setSaveStatus('saving');
      const wc = countWords(html);
      setWordCount(wc);

      // Record writing session: track words added since last save
      const delta = Math.max(0, wc - prevWordCountRef.current);
      if (delta > 0) {
        recordSession(activeProjectId, delta, 1);
      }
      prevWordCountRef.current = wc;

      updateChapter(activeProjectId, activeChapterId, { content: html });
      setTimeout(() => {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }, 300);
    },
    [activeProjectId, activeChapterId, updateChapter, recordSession],
  );

  // ── Paste handler: strip external formatting to keep consistent font ────────

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    // Prevent the browser's default rich-text paste
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain') || '';
    if (!text) return;

    // Insert as plain text so it inherits the editor's font-family, size, etc.
    document.execCommand('insertText', false, text);

    // Trigger save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const html = editorRef.current?.innerHTML || '';
    const wc = countWords(html);
    setWordCount(wc);
    saveTimerRef.current = setTimeout(() => saveContent(editorRef.current?.innerHTML || ''), 500);
  }, [saveContent]);

  // ── Input handler ───────────────────────────────────────────────────────────

  const handleInput = useCallback(() => {
    if (!editorRef.current || isInternalUpdate.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const html = editorRef.current.innerHTML;
    const wc = countWords(html);
    setWordCount(wc);
    saveTimerRef.current = setTimeout(() => saveContent(html), 500);
  }, [saveContent]);

  // ── Cleanup timer on unmount ────────────────────────────────────────────────

  useEffect(() => {
    const el = editorRef.current;
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        if (el && activeProjectId && activeChapterId) {
          updateChapter(activeProjectId, activeChapterId, { content: el.innerHTML });
        }
      }
    };
  }, [activeProjectId, activeChapterId, updateChapter]);

  // ── Track active formatting state ───────────────────────────────────────────

  const updateActiveFormats = useCallback(() => {
    try {
      const formats = new Set<string>();
      if (document.queryCommandState('bold')) formats.add('bold');
      if (document.queryCommandState('italic')) formats.add('italic');
      if (document.queryCommandState('underline')) formats.add('underline');
      if (document.queryCommandState('strikeThrough')) formats.add('strikeThrough');
      if (document.queryCommandState('insertUnorderedList')) formats.add('insertUnorderedList');
      if (document.queryCommandState('insertOrderedList')) formats.add('insertOrderedList');
      const block = document.queryCommandValue('formatBlock').toUpperCase();
      if (block === 'H1') formats.add('H1');
      if (block === 'H2') formats.add('H2');
      if (block === 'H3') formats.add('H3');
      if (block === 'BLOCKQUOTE') formats.add('BLOCKQUOTE');
      setActiveFormats(formats);
    } catch { /* queryCommandState can throw */ }
  }, []);

  // ── Exec command handler ────────────────────────────────────────────────────

  const handleExecCommand = useCallback(
    (e: React.MouseEvent, btn: ToolbarBtn) => {
      e.preventDefault();
      editorRef.current?.focus();
      if (btn.value) {
        document.execCommand(btn.command, false, btn.value);
      } else {
        document.execCommand(btn.command, false);
      }
      setTimeout(updateActiveFormats, 0);
    },
    [updateActiveFormats],
  );

  // ── Selection change ───────────────────────────────────────────────────────

  useEffect(() => {
    document.addEventListener('selectionchange', updateActiveFormats);
    return () => document.removeEventListener('selectionchange', updateActiveFormats);
  }, [updateActiveFormats]);

  // ── @ key detection for Quick Codex ─────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === '@' && !showCodex) {
        setShowCodex(true);
        setCodexSearch('');
        setSelectedCodexEntry(null);
      }
      if (e.key === 'Escape') {
        if (showCodex) { setShowCodex(false); return; }
        if (showSearchReplace) { setShowSearchReplace(false); return; }
        if (showAnalyze) { setShowAnalyze(false); return; }
        if (aiResult) { setAiResult(null); return; }
      }
    },
    [showCodex, showSearchReplace, showAnalyze, aiResult],
  );

  // ── Chapter title auto-save ─────────────────────────────────────────────────

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setChapterTitle(val);
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      titleTimerRef.current = setTimeout(() => {
        if (activeProjectId && activeChapterId) {
          updateChapter(activeProjectId, activeChapterId, { title: val });
        }
      }, 600);
    },
    [activeProjectId, activeChapterId, updateChapter],
  );

  // ── AI Assist: call Ollama ──────────────────────────────────────────────────

  const handleAiAction = useCallback(
    async (actionKey: AiActionKey) => {
      const editorHtml = editorRef.current?.innerHTML || '';
      const inputText = getSelectedText() || getLastParagraph(editorHtml);
      if (!inputText.trim()) return;

      const action = AI_ACTIONS.find(a => a.key === actionKey);
      if (!action) return;

      setAiLoading(true);
      setAiResult(null);
      setAiActionKey(actionKey);

      try {
        const aiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_key') || '') : '';
        const aiProv = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_provider') || 'openrouter') : 'openrouter';
        const aiModel = aiProv === 'openrouter' ? 'google/gemma-3-27b-it:free'
                      : aiProv === 'groq' ? 'llama-3.3-70b-versatile'
                      : 'gpt-4o-mini';
        const fullPrompt = `${action.prompt}\n\n---\n${inputText}`;
        const res = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: fullPrompt,
            systemPrompt: aiSettings.systemPrompt,
            temperature: aiSettings.temperature,
            apiKey: aiKey,
            provider: aiProv,
            model: aiModel,
          }),
        });
        const data = await res.json();
        const result = data.content || data.error || '';
        if (data.error) {
          setAiResult(`Error: ${data.error}`);
        } else {
          setAiResult(result.trim());
        }
      } catch {
        setAiResult('Error: Could not reach AI service. Please try again.');
      } finally {
        setAiLoading(false);
      }
    },
    [aiSettings],
  );

  // ── AI Result actions ──────────────────────────────────────────────────────

  const handleAiReplaceSelected = useCallback(() => {
    if (!aiResult || !editorRef.current) return;
    const sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      // Clean up title numbering if it's a titles action
      const cleanText = aiActionKey === 'titles'
        ? aiResult.replace(/^\d+\.\s*/gm, '').trim()
        : aiResult;
      document.execCommand('insertText', false, cleanText);
    }
    setAiResult(null);
  }, [aiResult, aiActionKey]);

  const handleAiInsertBelow = useCallback(() => {
    if (!aiResult || !editorRef.current) return;
    const cleanText = aiActionKey === 'titles'
      ? aiResult.replace(/^\d+\.\s*/gm, '').trim()
      : aiResult;

    editorRef.current.focus();
    // Move cursor to end
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);

    document.execCommand('insertHTML', false, `<br/><p>${cleanText.replace(/\n/g, '<br/>')}</p>`);
    handleInput();
    setAiResult(null);
  }, [aiResult, aiActionKey, handleInput]);

  const handleAiCopy = useCallback(() => {
    if (!aiResult) return;
    navigator.clipboard.writeText(aiResult);
  }, [aiResult]);

  const handleTitleClick = useCallback((title: string) => {
    if (!editorRef.current) return;
    const cleanTitle = title.replace(/^\d+\.\s*/, '').trim();
    // Insert the title at the beginning of the editor
    editorRef.current.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editorRef.current);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand('insertHTML', false, `<h2>${cleanTitle}</h2><p><br/></p>`);
    handleInput();
    setAiResult(null);
  }, [handleInput]);

  // ── Bookmark handler ───────────────────────────────────────────────────────

  const handleSaveBookmark = useCallback(() => {
    if (!activeProjectId || !bookmarkLabel.trim()) return;
    const ch = getActiveChapter();
    if (!ch) return;

    const sel = window.getSelection();
    const selText = sel ? sel.toString() : '';
    const beforeSel = sel && sel.rangeCount ? (() => {
      const range = sel.getRangeAt(0);
      const pre = range.cloneRange();
      pre.selectNodeContents(editorRef.current!);
      pre.setEnd(range.startContainer, range.startOffset);
      return pre.toString().length;
    })() : 0;

    const noteContent = `📖 Bookmark: "${bookmarkLabel}"\n📍 Position: ~${beforeSel} chars into "${ch.title}"\n${selText ? `\n"${selText.slice(0, 200)}${selText.length > 200 ? '...' : ''}"` : ''}`;

    addNote(activeProjectId, `★ ${bookmarkLabel}`);
    // Get the note we just added to update its content
    const currentProject = projects.find(p => p.id === activeProjectId);
    if (currentProject) {
      const lastNote = currentProject.notes[currentProject.notes.length - 1];
      if (lastNote) {
        useStore.getState().updateNote(activeProjectId, lastNote.id, { content: noteContent });
      }
    }

    setShowBookmarkInput(false);
    setBookmarkLabel('');
  }, [activeProjectId, bookmarkLabel, getActiveChapter, addNote, projects]);

  // ── Analyze / Polish Panel ─────────────────────────────────────────────────

  const handleAnalyze = useCallback(() => {
    const text = getPlainText(editorRef.current?.innerHTML || '');
    const basic = analyzeText(text);
    const inconsistencies = findNameInconsistencies(text, worldBible);
    const repeatedWords = findRepeatedWords(text);
    setAnalysisData({ ...basic, difficulty: basic.difficulty || 'Standard', inconsistencies, repeatedWords });
    setShowAnalyze(true);
  }, [worldBible]);

  // ── Sprint ──────────────────────────────────────────────────────────────────

  const handleStartSprint = useCallback(() => {
    startSprint(500);
    setSprintElapsed(0);
    setSprintStartWordCount(wordCount);
  }, [startSprint, wordCount]);

  const handleEndSprint = useCallback(() => {
    endSprint();
    if (sprintIntervalRef.current) {
      clearInterval(sprintIntervalRef.current);
      sprintIntervalRef.current = null;
    }
  }, [endSprint]);

  useEffect(() => {
    if (!sprintActive) {
      if (sprintIntervalRef.current) {
        clearInterval(sprintIntervalRef.current);
        sprintIntervalRef.current = null;
      }
      // Reset via ref-based callback to avoid synchronous setState in effect
      const id = requestAnimationFrame(() => setSprintElapsed(0));
      return () => cancelAnimationFrame(id);
    }
    const startTime = Date.now();
    sprintIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setSprintElapsed(elapsed);
      const currentWords = countWords(editorRef.current?.innerHTML || '');
      const wordsWritten = Math.max(0, currentWords - sprintStartWordCount);
      updateSprintWords(wordsWritten);

      // Auto-end at 15 minutes
      if (elapsed >= 15 * 60 * 1000) {
        handleEndSprint();
      }
    }, 1000);
    return () => {
      if (sprintIntervalRef.current) {
        clearInterval(sprintIntervalRef.current);
      }
    };
  }, [sprintActive, sprintStartWordCount, updateSprintWords, handleEndSprint]);

  const sprintMinutes = Math.floor(sprintElapsed / 60000);
  const sprintSeconds = Math.floor((sprintElapsed % 60000) / 1000);
  const sprintWordsWritten = Math.max(0, wordCount - sprintStartWordCount);

  // ── Search & Replace ───────────────────────────────────────────────────────

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim() || !project) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const results: typeof searchResults = [];

    project.chapters.forEach((ch, idx) => {
      const text = getPlainText(ch.content);
      const lowerText = text.toLowerCase();
      const pos = lowerText.indexOf(query);
      if (pos >= 0) {
        const start = Math.max(0, pos - 40);
        const end = Math.min(text.length, pos + searchQuery.length + 40);
        const snippet = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '');
        results.push({
          chapterId: ch.id,
          chapterTitle: ch.title,
          chapterIndex: idx + 1,
          snippet,
        });
      }
    });

    setSearchResults(results);
  }, [searchQuery, project]);

  const handleReplaceAll = useCallback(() => {
    if (!searchQuery.trim() || !replaceQuery === undefined || !project) return;
    const queryLower = searchQuery.toLowerCase();

    project.chapters.forEach((ch) => {
      if (getPlainText(ch.content).toLowerCase().includes(queryLower)) {
        // Simple replace in the raw HTML - use a regex approach
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const newHtml = ch.content.replace(new RegExp(escapedQuery, 'gi'), replaceQuery);
        updateChapter(project.id, ch.id, { content: newHtml });
      }
    });

    handleSearch();
  }, [searchQuery, replaceQuery, project, updateChapter, handleSearch]);

  const handleSearchNavigate = useCallback(
    (chapterId: string) => {
      setActiveChapter(chapterId);
      setShowSearchReplace(false);
    },
    [setActiveChapter],
  );

  // ── Codex filtered entries ─────────────────────────────────────────────────

  const filteredCodexEntries = useMemo(() => {
    if (!codexSearch.trim()) return worldBible;
    const q = codexSearch.toLowerCase();
    return worldBible.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q),
    );
  }, [worldBible, codexSearch]);

  // ── Insert codex entry name ─────────────────────────────────────────────────

  const handleInsertCodexName = useCallback((name: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertText', false, name);
    setShowCodex(false);
    handleInput();
  }, [handleInput]);

  // ── Button active check ─────────────────────────────────────────────────────

  const isButtonActive = (btn: ToolbarBtn): boolean => {
    if (btn.queryState) return activeFormats.has(btn.queryState);
    if (btn.value) return activeFormats.has(btn.value.toUpperCase());
    return false;
  };

  // ── Parse AI titles for card display ────────────────────────────────────────

  const parsedTitles = useMemo(() => {
    if (!aiResult || aiActionKey !== 'titles') return [];
    return aiResult
      .split('\n')
      .map(line => line.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 6);
  }, [aiResult, aiActionKey]);

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (!activeProjectId || !activeChapterId || !chapter) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
        <div className="text-center">
          <div style={{ fontSize: 48, marginBottom: 12 }}>✏️</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Select a chapter to begin writing
          </div>
          <div style={{ fontSize: 14, marginTop: 4 }}>
            Choose a chapter from the sidebar or create a new one
          </div>
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* ── Chapter Title Input + Page Number ──────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-6 pt-4 pb-1"
        style={{ background: 'var(--bg-primary)' }}
      >
        <span
          className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded"
          style={{
            color: 'var(--accent-gold)',
            background: 'var(--accent-gold-dim)',
            border: '1px solid rgba(212,168,83,0.25)',
          }}
        >
          Chapter {chapterIndex}
        </span>
        <input
          type="text"
          value={chapterTitle}
          onChange={handleTitleChange}
          placeholder="Chapter Title"
          className="flex-1 bg-transparent outline-none"
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
          }}
        />
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 px-3 py-2 flex-wrap"
        style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {TOOLBAR_GROUPS.map((group, gi) => (
          <React.Fragment key={gi}>
            {gi > 0 && (
              <div
                className="mx-1"
                style={{ width: 1, height: 24, background: 'var(--border-light)' }}
              />
            )}
            <div className="flex items-center gap-0.5">
              {group.map((btn) => {
                const active = isButtonActive(btn);
                return (
                  <ToolbarButton key={btn.label} label={btn.label} active={active} onClick={(e) => handleExecCommand(e, btn)}>
                    {btn.icon}
                  </ToolbarButton>
                );
              })}
            </div>
          </React.Fragment>
        ))}

        {/* ── Separator ── */}
        <div className="mx-1" style={{ width: 1, height: 24, background: 'var(--border-light)' }} />

        {/* ── Quick Codex Button ── */}
        <ToolbarButton label="Quick Codex (@)" active={showCodex} onClick={() => { setShowCodex(!showCodex); setSelectedCodexEntry(null); setCodexSearch(''); }}>
          <span style={{ fontSize: 16 }}>📖</span>
        </ToolbarButton>

        {/* ── Bookmark Button ── */}
        <ToolbarButton label="Bookmark (★)" active={false} onClick={() => setShowBookmarkInput(true)}>
          <span style={{ fontSize: 16 }}>★</span>
        </ToolbarButton>

        {/* ── Analyze Button ── */}
        <ToolbarButton label="Analyze / Polish" active={showAnalyze} onClick={handleAnalyze}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
          </svg>
        </ToolbarButton>

        {/* ── Sprint Button ── */}
        <ToolbarButton label="Writing Sprint" active={sprintActive} onClick={sprintActive ? handleEndSprint : handleStartSprint}>
          <span style={{ fontSize: 16 }}>🏃</span>
        </ToolbarButton>

        {/* ── Search & Replace Button ── */}
        <ToolbarButton label="Search & Replace" active={showSearchReplace} onClick={() => { setShowSearchReplace(!showSearchReplace); setSearchResults([]); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </ToolbarButton>
      </div>

      {/* ── Editor area ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
        <div className="editor-content" style={{ minHeight: '100%' }}>
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            style={{
              outline: 'none',
              padding: '24px 40px 120px',
              maxWidth: 800,
              margin: '0 auto',
              minHeight: 'calc(100vh - 220px)',
              lineHeight: 1.8,
              fontSize: 17,
              fontFamily: "'Georgia', 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif",
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* ── Inline AI Bar ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-4 py-2 flex-wrap"
        style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <span className="text-xs font-semibold shrink-0" style={{ color: 'var(--accent-gold)' }}>
          AI Assist:
        </span>
        {AI_ACTIONS.map((action) => (
          <button
            key={action.key}
            onClick={() => handleAiAction(action.key)}
            disabled={aiLoading}
            className="text-xs px-2.5 py-1 rounded-md transition-colors"
            style={{
              background: aiLoading ? 'var(--bg-tertiary)' : 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              color: aiLoading ? 'var(--text-muted)' : 'var(--text-secondary)',
              cursor: aiLoading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!aiLoading) {
                e.currentTarget.style.borderColor = 'var(--accent-gold-dim)';
                e.currentTarget.style.color = 'var(--accent-gold)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {action.label}
          </button>
        ))}
        {aiLoading && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            <span
              className="inline-block"
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--accent-gold)',
                animation: 'inkweave-pulse 1s ease-in-out infinite',
                marginRight: 6,
              }}
            />
            Thinking...
          </span>
        )}
      </div>

      {/* ── Status bar ────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          fontSize: 12,
          color: 'var(--text-muted)',
        }}
      >
        <div className="flex items-center gap-4">
          <span>
            <strong style={{ color: 'var(--text-secondary)' }}>{wordCount.toLocaleString()}</strong> words
          </span>
          <span style={{ color: 'var(--border-light)' }}>|</span>
          <span>{readingTime(wordCount)}</span>
          {sprintActive && (
            <>
              <span style={{ color: 'var(--border-light)' }}>|</span>
              <span style={{ color: 'var(--accent-gold)' }}>
                Sprint: {sprintWordsWritten}/500w &middot; {sprintMinutes}:{sprintSeconds.toString().padStart(2, '0')}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1.5" style={{ color: 'var(--accent-gold)' }}>
              <span className="inline-block" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-gold)', animation: 'inkweave-pulse 1s ease-in-out infinite' }} />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && <span style={{ color: 'var(--accent-gold)' }}>✓ Saved</span>}
          {saveStatus === 'idle' && <span>{chapterTitle || chapter.title}</span>}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* ── FLOATING PANELS & OVERLAYS ────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}

      {/* ── AI Result Popup ───────────────────────────────────────────────── */}
      {aiResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
          onClick={() => setAiResult(null)}
        >
          <div
            className="rounded-xl shadow-2xl flex flex-col"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              width: '90%',
              maxWidth: 600,
              maxHeight: '80vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                ✨ AI Suggestion — {AI_ACTIONS.find(a => a.key === aiActionKey)?.label}
              </span>
              <button
                onClick={() => setAiResult(null)}
                className="flex items-center justify-center rounded-md"
                style={{ width: 28, height: 28, background: 'var(--bg-tertiary)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Body: Titles mode → cards; otherwise → text */}
            <div className="flex-1 overflow-y-auto p-4">
              {aiActionKey === 'titles' && parsedTitles.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {parsedTitles.map((title, i) => (
                    <button
                      key={i}
                      onClick={() => handleTitleClick(title)}
                      className="text-left p-3 rounded-lg transition-colors"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-gold-dim)';
                        e.currentTarget.style.background = 'var(--accent-gold-dim)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.background = 'var(--bg-secondary)';
                      }}
                    >
                      <span className="text-xs font-semibold" style={{ color: 'var(--accent-gold)' }}>
                        {i + 1}.
                      </span>{' '}
                      <span className="text-sm">{title}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <pre
                  className="text-sm whitespace-pre-wrap"
                  style={{
                    color: 'var(--text-primary)',
                    lineHeight: 1.7,
                    fontFamily: 'inherit',
                    margin: 0,
                  }}
                >
                  {aiResult}
                </pre>
              )}
            </div>

            {/* Footer actions (not for titles mode) */}
            {aiActionKey !== 'titles' && (
              <div
                className="flex items-center gap-2 px-4 py-3 flex-wrap"
                style={{ borderTop: '1px solid var(--border-color)' }}
              >
                <button
                  onClick={handleAiReplaceSelected}
                  className="text-xs px-3 py-1.5 rounded-md font-medium"
                  style={{
                    background: 'var(--accent-gold-dim)',
                    border: '1px solid rgba(212,168,83,0.3)',
                    color: 'var(--accent-gold)',
                    cursor: 'pointer',
                  }}
                >
                  Replace Selected
                </button>
                <button
                  onClick={handleAiInsertBelow}
                  className="text-xs px-3 py-1.5 rounded-md"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Insert Below
                </button>
                <button
                  onClick={handleAiCopy}
                  className="text-xs px-3 py-1.5 rounded-md"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  📋 Copy
                </button>
                <button
                  onClick={() => setAiResult(null)}
                  className="text-xs px-3 py-1.5 rounded-md ml-auto"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quick Codex Floating Panel ────────────────────────────────────── */}
      {showCodex && (
        <div
          className="absolute z-40 rounded-xl shadow-2xl flex flex-col"
          style={{
            top: 120,
            right: 16,
            width: 340,
            maxHeight: 420,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              📖 Quick Codex
            </span>
            <button
              onClick={() => setShowCodex(false)}
              className="flex items-center justify-center rounded"
              style={{ width: 22, height: 22, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <input
              type="text"
              value={codexSearch}
              onChange={(e) => { setCodexSearch(e.target.value); setSelectedCodexEntry(null); }}
              placeholder="Search world bible..."
              autoFocus
              className="w-full rounded-md px-2.5 py-1.5 text-xs outline-none"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* List or Detail */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 320 }}>
            {selectedCodexEntry ? (
              /* Detail view */
              <div className="p-3">
                <button
                  onClick={() => setSelectedCodexEntry(null)}
                  className="text-xs mb-2 flex items-center gap-1"
                  style={{ background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer' }}
                >
                  ← Back
                </button>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: 20 }}>{CATEGORY_ICONS[selectedCodexEntry.category]}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {selectedCodexEntry.name}
                  </span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {selectedCodexEntry.category}
                </span>
                {selectedCodexEntry.notes && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {selectedCodexEntry.notes}
                  </p>
                )}
                {Object.keys(selectedCodexEntry.fields).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(selectedCodexEntry.fields).map(([k, v]) => (
                      <div key={k} className="text-xs">
                        <span style={{ color: 'var(--text-muted)' }}>{k}:</span>{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => handleInsertCodexName(selectedCodexEntry.name)}
                  className="mt-3 w-full text-xs px-3 py-1.5 rounded-md font-medium"
                  style={{
                    background: 'var(--accent-gold-dim)',
                    border: '1px solid rgba(212,168,83,0.3)',
                    color: 'var(--accent-gold)',
                    cursor: 'pointer',
                  }}
                >
                  Insert Name
                </button>
              </div>
            ) : filteredCodexEntries.length === 0 ? (
              <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                No entries found
              </div>
            ) : (
              <div>
                {filteredCodexEntries.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelectedCodexEntry(entry)}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 transition-colors"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{CATEGORY_ICONS[entry.category]}</span>
                    <span className="text-xs font-medium flex-1 truncate">{entry.name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {entry.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bookmark Input Dialog ─────────────────────────────────────────── */}
      {showBookmarkInput && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
          onClick={() => setShowBookmarkInput(false)}
        >
          <div
            className="rounded-xl shadow-2xl p-4"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', width: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              ★ Add Bookmark
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              A note will be saved with your current position in &ldquo;{chapter.title}&rdquo;.
            </p>
            <input
              type="text"
              value={bookmarkLabel}
              onChange={(e) => setBookmarkLabel(e.target.value)}
              placeholder="Bookmark label (e.g. &quot;Fix dialogue here&quot;)"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveBookmark();
              }}
              className="w-full rounded-md px-3 py-2 text-sm outline-none mb-3"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowBookmarkInput(false)}
                className="text-xs px-3 py-1.5 rounded-md"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBookmark}
                disabled={!bookmarkLabel.trim()}
                className="text-xs px-3 py-1.5 rounded-md font-medium"
                style={{
                  background: bookmarkLabel.trim() ? 'var(--accent-gold-dim)' : 'var(--bg-tertiary)',
                  border: '1px solid rgba(212,168,83,0.3)',
                  color: bookmarkLabel.trim() ? 'var(--accent-gold)' : 'var(--text-muted)',
                  cursor: bookmarkLabel.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Save Bookmark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Polish / Analyze Panel ────────────────────────────────────────── */}
      {showAnalyze && analysisData && (
        <div
          className="absolute z-40 rounded-xl shadow-2xl flex flex-col"
          style={{
            top: 120,
            right: 16,
            width: 340,
            maxHeight: 480,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              📊 Polish Analysis
            </span>
            <button
              onClick={() => setShowAnalyze(false)}
              className="flex items-center justify-center rounded"
              style={{ width: 22, height: 22, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Reading Ease */}
            <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>
                Flesch Reading Ease
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{analysisData.flesch}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: analysisData.flesch >= 60 ? 'rgba(39,174,96,0.15)' : analysisData.flesch >= 40 ? 'rgba(212,168,83,0.15)' : 'rgba(231,76,60,0.15)',
                    color: analysisData.flesch >= 60 ? '#27ae60' : analysisData.flesch >= 40 ? 'var(--accent-gold)' : '#e74c3c',
                  }}
                >
                  {analysisData.difficulty}
                </span>
              </div>
              {/* Progress bar */}
              <div className="mt-1.5 rounded-full overflow-hidden" style={{ height: 4, background: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${analysisData.flesch}%`,
                    background: analysisData.flesch >= 60 ? '#27ae60' : analysisData.flesch >= 40 ? 'var(--accent-gold)' : '#e74c3c',
                  }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Grade Level</div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{analysisData.grade}</div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Avg Sentence</div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{analysisData.avgSentence}<span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}> words</span></div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Passive Voice</div>
                <div className="text-lg font-bold" style={{ color: analysisData.passivePercent > 15 ? '#e74c3c' : 'var(--text-primary)' }}>
                  {analysisData.passivePercent}%
                </div>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Word Count</div>
                <div className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{wordCount.toLocaleString()}</div>
              </div>
            </div>

            {/* Name Inconsistencies */}
            <div>
              <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                🔍 Possible Name Inconsistencies
              </div>
              {analysisData.inconsistencies.length === 0 ? (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No inconsistencies found</div>
              ) : (
                <div className="space-y-1">
                  {analysisData.inconsistencies.map((item, i) => (
                    <div
                      key={i}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: 'rgba(231,76,60,0.08)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.15)' }}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Repeated Words */}
            <div>
              <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                🔁 Repeated Words (40-word window)
              </div>
              {analysisData.repeatedWords.length === 0 ? (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>No repeated words found</div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {analysisData.repeatedWords.map((item) => (
                    <span
                      key={item.word}
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                    >
                      {item.word} <span style={{ color: 'var(--accent-gold)' }}>×{item.count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Sprint Overlay ────────────────────────────────────────────────── */}
      {sprintActive && (
        <div
          className="fixed bottom-16 right-4 z-40 rounded-xl shadow-2xl p-4"
          style={{
            width: 260,
            background: 'var(--bg-elevated)',
            border: '2px solid var(--accent-gold-dim)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold" style={{ color: 'var(--accent-gold)' }}>
              🏃 Writing Sprint
            </span>
            <button
              onClick={handleEndSprint}
              className="text-xs px-2 py-0.5 rounded"
              style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.2)', color: '#e74c3c', cursor: 'pointer' }}
            >
              End
            </button>
          </div>

          {/* Timer */}
          <div
            className="text-center mb-3"
            style={{
              fontFamily: 'monospace',
              fontSize: 36,
              fontWeight: 700,
              color: sprintElapsed > 12 * 60 * 1000 ? '#e74c3c' : 'var(--text-primary)',
              letterSpacing: '0.05em',
            }}
          >
            {sprintMinutes}:{sprintSeconds.toString().padStart(2, '0')}
          </div>

          {/* Word progress */}
          <div className="mb-2">
            <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              <span>{sprintWordsWritten} words</span>
              <span>Target: 500</span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 8, background: 'var(--bg-tertiary)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((sprintWordsWritten / 500) * 100, 100)}%`,
                  background: sprintWordsWritten >= 500 ? '#27ae60' : 'var(--accent-gold)',
                }}
              />
            </div>
          </div>

          {/* Status */}
          <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            {sprintWordsWritten >= 500
              ? '🎉 Goal reached! Keep going!'
              : sprintWordsWritten >= 250
                ? '🔥 Halfway there!'
                : '✍️ Keep writing...'}
          </div>
        </div>
      )}

      {/* ── Search & Replace Panel ────────────────────────────────────────── */}
      {showSearchReplace && (
        <div
          className="absolute z-40 rounded-xl shadow-2xl flex flex-col"
          style={{
            top: 120,
            left: 16,
            width: 380,
            maxHeight: 460,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              🔍 Search & Replace
            </span>
            <button
              onClick={() => setShowSearchReplace(false)}
              className="flex items-center justify-center rounded"
              style={{ width: 22, height: 22, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}
            >
              ✕
            </button>
          </div>

          {/* Search inputs */}
          <div className="px-4 py-3 space-y-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                placeholder="Search all chapters..."
                autoFocus
                className="flex-1 rounded-md px-2.5 py-1.5 text-xs outline-none"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={handleSearch}
                className="text-xs px-3 py-1.5 rounded-md font-medium"
                style={{ background: 'var(--accent-gold-dim)', border: '1px solid rgba(212,168,83,0.3)', color: 'var(--accent-gold)', cursor: 'pointer' }}
              >
                Find
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder="Replace with..."
                className="flex-1 rounded-md px-2.5 py-1.5 text-xs outline-none"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={handleReplaceAll}
                disabled={searchResults.length === 0}
                className="text-xs px-3 py-1.5 rounded-md"
                style={{
                  background: searchResults.length > 0 ? 'rgba(231,76,60,0.1)' : 'var(--bg-tertiary)',
                  border: searchResults.length > 0 ? '1px solid rgba(231,76,60,0.2)' : '1px solid var(--border-color)',
                  color: searchResults.length > 0 ? '#e74c3c' : 'var(--text-muted)',
                  cursor: searchResults.length > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Replace All
              </button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 340 }}>
            {searchResults.length === 0 ? (
              <div className="p-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                {searchQuery ? 'No results found' : 'Type a search query to find text across all chapters'}
              </div>
            ) : (
              <div>
                <div className="px-4 py-1.5 text-xs" style={{ color: 'var(--text-muted)', background: 'var(--bg-tertiary)' }}>
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.map((result, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearchNavigate(result.chapterId)}
                    className="w-full text-left px-4 py-2 transition-colors"
                    style={{
                      background: result.chapterId === activeChapterId ? 'var(--accent-gold-dim)' : 'transparent',
                      borderBottom: '1px solid var(--border-color)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (result.chapterId !== activeChapterId) e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (result.chapterId !== activeChapterId) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium" style={{ color: 'var(--accent-gold)' }}>
                        Ch {result.chapterIndex}
                      </span>
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {result.chapterTitle}
                      </span>
                      {result.chapterId === activeChapterId && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', fontSize: 10 }}>
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {result.snippet}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
