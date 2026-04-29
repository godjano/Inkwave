'use client';

import { useState, useCallback, useMemo } from 'react';
import { useStore } from '@/lib/store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MuseTab = 'synonym' | 'continuity' | 'whatif' | 'tone';

interface SynonymResult {
  word: string;
  usage: string;
}

interface ContinuityIssue {
  description: string;
  chapter: string;
  severity: 'high' | 'medium' | 'low';
  suggestedFix: string;
}

interface WhatIfConsequence {
  title: string;
  description: string;
  affectedCharacters: string;
  newConflicts: string;
  narrativeImpact: string;
}

interface ToneAnalysis {
  narrativeVoice: string;
  povAdherence: string;
  tenseConsistency: string;
  formalityLevel: string;
  emotionalRegister: string;
  shifts: string[];
  suggestions: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

async function callAI(prompt: string, systemPrompt: string, maxTokens = 2048): Promise<string> {
  const aiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_key') || '') : '';
  const aiProv = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_provider') || 'openrouter') : 'openrouter';
  const aiModel = aiProv === 'openrouter' ? 'google/gemma-3-27b-it:free'
                : aiProv === 'groq' ? 'llama-3.3-70b-versatile'
                : 'gpt-4o-mini';

  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      systemPrompt,
      temperature: 0.6,
      maxTokens,
      apiKey: aiKey,
      provider: aiProv,
      model: aiModel,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return (data.content || '').trim();
}

/* ------------------------------------------------------------------ */
/*  Parsers                                                            */
/* ------------------------------------------------------------------ */

function parseSynonyms(text: string): SynonymResult[] {
  const results: SynonymResult[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const cleaned = line.replace(/^[-*#.]?\s*/, '').trim();
    if (!cleaned || cleaned.length < 3) continue;

    // Match patterns like "word — usage" or "word: usage" or "word (usage)"
    let match = cleaned.match(/^([^-–—:()[\]]+?)\s*[—–—:]\s*(.+)$/);
    if (!match) match = cleaned.match(/^([^-–—:()[\]]+?)\s*\((.+)\)\s*$/);
    if (match && match[1].trim().length < 40) {
      results.push({ word: match[1].trim(), usage: match[2].trim() });
    } else if (cleaned.length < 40 && /^[a-zA-Z]/.test(cleaned)) {
      // Just a word without usage note
      results.push({ word: cleaned, usage: '' });
    }
  }
  return results.slice(0, 12);
}

function parseContinuityIssues(text: string): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];
  const lines = text.split('\n');
  let current: Partial<ContinuityIssue> | null = null;
  let currentField = '';

  for (const line of lines) {
    const trimmed = line.replace(/^[-*#]\s*/, '').trim();
    if (!trimmed) continue;

    // Detect new issue block
    if (trimmed.match(/^(issue|problem|error|contradiction|inconsistency)\s*#?\d*/i) || trimmed.match(/^##?\s/i)) {
      if (current?.description) {
        issues.push({
          description: current.description,
          chapter: current.chapter || 'Unknown',
          severity: current.severity || 'medium',
          suggestedFix: current.suggestedFix || '',
        });
      }
      current = { description: '', chapter: '', severity: 'medium', suggestedFix: '' };
      currentField = 'description';
      const headerMatch = trimmed.replace(/^##?\s*/, '').replace(/^(issue|problem|error|contradiction|inconsistency)\s*#?\d*[:.]?\s*/i, '').trim();
      if (headerMatch) current.description = headerMatch;
      continue;
    }

    if (!current) {
      // Try to start a new issue from a non-header line
      if (trimmed.length > 10) {
        current = { description: trimmed, chapter: '', severity: 'medium', suggestedFix: '' };
        currentField = 'description';
      }
      continue;
    }

    // Detect fields
    if (trimmed.match(/^(chapter|location|reference|where|found in)/i)) { currentField = 'chapter'; continue; }
    if (trimmed.match(/^(severity|priority|level|importance)/i)) { currentField = 'severity'; continue; }
    if (trimmed.match(/^(fix|suggestion|recommend|resolve|solution|how to)/i)) { currentField = 'fix'; continue; }
    if (trimmed.match(/^(description|detail|what)/i)) { currentField = 'description'; continue; }

    if (currentField === 'description') current.description += (current.description ? ' ' : '') + trimmed;
    else if (currentField === 'chapter') current.chapter += (current.chapter ? ', ' : '') + trimmed;
    else if (currentField === 'severity') {
      if (trimmed.match(/high|critical|major/i)) current.severity = 'high';
      else if (trimmed.match(/low|minor|trivial/i)) current.severity = 'low';
      else current.severity = 'medium';
    }
    else if (currentField === 'fix') current.suggestedFix += (current.suggestedFix ? ' ' : '') + trimmed;
  }

  if (current?.description) {
    issues.push({
      description: current.description,
      chapter: current.chapter || 'Unknown',
      severity: current.severity || 'medium',
      suggestedFix: current.suggestedFix || '',
    });
  }

  return issues;
}

function parseWhatIfConsequences(text: string): WhatIfConsequence[] {
  const consequences: WhatIfConsequence[] = [];
  const lines = text.split('\n');
  let current: Partial<WhatIfConsequence> | null = null;
  let currentField = '';

  for (const line of lines) {
    const trimmed = line.replace(/^[-*#]\s*/, '').trim();
    if (!trimmed) continue;

    // Detect new consequence block
    if (trimmed.match(/^(consequence|scenario|possibility|outcome|ripple|direction|path)\s*#?\d*/i) || trimmed.match(/^##?\s/i)) {
      if (current?.title) {
        consequences.push({
          title: current.title,
          description: current.description || '',
          affectedCharacters: current.affectedCharacters || '',
          newConflicts: current.newConflicts || '',
          narrativeImpact: current.narrativeImpact || '',
        });
      }
      current = { title: '', description: '', affectedCharacters: '', newConflicts: '', narrativeImpact: '' };
      currentField = 'description';
      const headerMatch = trimmed.replace(/^##?\s*/, '').replace(/^(consequence|scenario|possibility|outcome|ripple|direction|path)\s*#?\d*[:.]?\s*/i, '').trim();
      if (headerMatch) current.title = headerMatch;
      continue;
    }

    if (!current) {
      if (trimmed.length > 10) {
        current = { title: trimmed, description: '', affectedCharacters: '', newConflicts: '', narrativeImpact: '' };
        currentField = 'description';
      }
      continue;
    }

    // Detect fields
    if (trimmed.match(/^(what changes|description|overview|summary|detail)/i)) { currentField = 'description'; continue; }
    if (trimmed.match(/^(affected|characters|who|impact on)/i)) { currentField = 'characters'; continue; }
    if (trimmed.match(/^(conflict|tension|new.*conflict|complication|challenge)/i)) { currentField = 'conflicts'; continue; }
    if (trimmed.match(/^(narrative|story.*impact|enhance|complicate|overall)/i)) { currentField = 'narrative'; continue; }

    if (currentField === 'description') current.description += (current.description ? ' ' : '') + trimmed;
    else if (currentField === 'characters') current.affectedCharacters += (current.affectedCharacters ? ' ' : '') + trimmed;
    else if (currentField === 'conflicts') current.newConflicts += (current.newConflicts ? ' ' : '') + trimmed;
    else if (currentField === 'narrative') current.narrativeImpact += (current.narrativeImpact ? ' ' : '') + trimmed;
  }

  if (current?.title) {
    consequences.push({
      title: current.title,
      description: current.description || '',
      affectedCharacters: current.affectedCharacters || '',
      newConflicts: current.newConflicts || '',
      narrativeImpact: current.narrativeImpact || '',
    });
  }

  return consequences;
}

function parseToneAnalysis(text: string): ToneAnalysis {
  const analysis: ToneAnalysis = {
    narrativeVoice: '',
    povAdherence: '',
    tenseConsistency: '',
    formalityLevel: '',
    emotionalRegister: '',
    shifts: [],
    suggestions: [],
  };

  const lines = text.split('\n');
  let currentSection = '';
  let currentBuffer = '';

  for (const line of lines) {
    const trimmed = line.replace(/^[-*#]\s*/, '').trim();
    if (!trimmed) continue;

    if (trimmed.match(/^#?\s*(narrative\s*voice|voice|narrator)/i)) {
      flushBuffer(currentSection, currentBuffer, analysis);
      currentSection = 'voice';
      currentBuffer = '';
      continue;
    }
    if (trimmed.match(/^#?\s*(pov|point\s*of\s*view|perspective)/i)) {
      flushBuffer(currentSection, currentBuffer, analysis);
      currentSection = 'pov';
      currentBuffer = '';
      continue;
    }
    if (trimmed.match(/^#?\s*(tense|time|past\s*present|grammar)/i)) {
      flushBuffer(currentSection, currentBuffer, analysis);
      currentSection = 'tense';
      currentBuffer = '';
      continue;
    }
    if (trimmed.match(/^#?\s*(formal|informal|register|tone\s*level|style)/i)) {
      flushBuffer(currentSection, currentBuffer, analysis);
      currentSection = 'formality';
      currentBuffer = '';
      continue;
    }
    if (trimmed.match(/^#?\s*(emotion|emotional|mood|feeling)/i)) {
      flushBuffer(currentSection, currentBuffer, analysis);
      currentSection = 'emotion';
      currentBuffer = '';
      continue;
    }
    if (trimmed.match(/^#?\s*(shift|inconsisten|change|variat|problem|issue)/i)) {
      flushBuffer(currentSection, currentBuffer, analysis);
      currentSection = 'shifts';
      currentBuffer = '';
      continue;
    }
    if (trimmed.match(/^#?\s*(suggest|improve|recommend|fix|better|tip)/i)) {
      flushBuffer(currentSection, currentBuffer, analysis);
      currentSection = 'suggestions';
      currentBuffer = '';
      continue;
    }

    currentBuffer += (currentBuffer ? ' ' : '') + trimmed;
  }
  flushBuffer(currentSection, currentBuffer, analysis);

  return analysis;
}

function flushBuffer(section: string, buffer: string, analysis: ToneAnalysis) {
  if (!buffer.trim()) return;
  switch (section) {
    case 'voice': analysis.narrativeVoice = buffer.trim(); break;
    case 'pov': analysis.povAdherence = buffer.trim(); break;
    case 'tense': analysis.tenseConsistency = buffer.trim(); break;
    case 'formality': analysis.formalityLevel = buffer.trim(); break;
    case 'emotion': analysis.emotionalRegister = buffer.trim(); break;
    case 'shifts':
      buffer.split(/(?=[A-Z])/).filter(s => s.trim().length > 5).forEach(s => analysis.shifts.push(s.trim()));
      break;
    case 'suggestions':
      buffer.split(/(?=[A-Z])/).filter(s => s.trim().length > 5).forEach(s => analysis.suggestions.push(s.trim()));
      break;
  }
}

/* ------------------------------------------------------------------ */
/*  Severity & Tone rating helpers                                     */
/* ------------------------------------------------------------------ */

const severityConfig = {
  high: { color: '#a04040', bg: 'rgba(160,64,64,0.15)', label: 'High' },
  medium: { color: '#d4a853', bg: 'rgba(212,168,83,0.15)', label: 'Medium' },
  low: { color: '#4a78a0', bg: 'rgba(74,120,160,0.15)', label: 'Low' },
};

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

const TABS: { key: MuseTab; label: string; icon: React.ReactNode }[] = [
  {
    key: 'synonym',
    label: 'Synonyms',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" /><path d="M14 2v6h6" /><path d="M5 12l-3 3 3 3" /><path d="M2 15h7" /></svg>,
  },
  {
    key: 'continuity',
    label: 'Continuity',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" /><path d="M15 3v4a2 2 0 0 0 2 2h4" /><path d="M9 14l2 2 4-4" /></svg>,
  },
  {
    key: 'whatif',
    label: 'What-If',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
  },
  {
    key: 'tone',
    label: 'Tone',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>,
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AiMusePanel() {
  const getActiveProject = useStore((s) => s.getActiveProject);
  const activeChapterId = useStore((s) => s.activeChapterId);

  const project = getActiveProject();
  const chapters = useMemo(() => project?.chapters.sort((a, b) => a.order - b.order) || [], [project]);
  const activeChapter = useMemo(
    () => chapters.find(c => c.id === activeChapterId) || null,
    [chapters, activeChapterId],
  );

  const [activeTab, setActiveTab] = useState<MuseTab>('synonym');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synonym state
  const [synonymInput, setSynonymInput] = useState('');
  const [synonyms, setSynonyms] = useState<SynonymResult[]>([]);

  // Continuity state
  const [continuityIssues, setContinuityIssues] = useState<ContinuityIssue[]>([]);

  // What-if state
  const [whatIfScenario, setWhatIfScenario] = useState('');
  const [whatIfContext, setWhatIfContext] = useState('');
  const [whatIfConsequences, setWhatIfConsequences] = useState<WhatIfConsequence[]>([]);
  const [expandedConsequence, setExpandedConsequence] = useState<string | null>(null);

  // Tone state
  const [toneAnalysis, setToneAnalysis] = useState<ToneAnalysis | null>(null);

  /* ── SYNONYM FINDER ── */
  const handleSynonymSearch = useCallback(async () => {
    if (!synonymInput.trim()) return;
    setLoading(true);
    setError(null);
    setSynonyms([]);

    try {
      const prompt = `Give me 8-12 synonyms and alternative expressions for "${synonymInput.trim()}" in the context of fantasy fiction writing. For each synonym, format it as: "synonym — brief note on when to use it". Be varied: include formal, poetic, archaic, and everyday options. Do not use numbered lists or extra headers.`;

      const result = await callAI(prompt, 'You are a creative writing thesaurus. Provide vivid, contextually useful synonyms for fiction writers. Format each as "word — usage note" on its own line. No numbered lists.', 1024);
      setSynonyms(parseSynonyms(result));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to find synonyms. Check your AI settings.');
    } finally {
      setLoading(false);
    }
  }, [synonymInput]);

  /* ── CONTINUITY CHECKER ── */
  const handleContinuityCheck = useCallback(async () => {
    if (chapters.length === 0) return;
    setLoading(true);
    setError(null);
    setContinuityIssues([]);

    try {
      // Build condensed chapter content (~500 words each, max ~6000 total)
      const MAX_PER_CHAPTER = 500;
      const MAX_TOTAL = 6000;
      let totalWords = 0;
      const chapterExcerpts: string[] = [];

      for (const ch of chapters) {
        if (totalWords >= MAX_TOTAL) break;
        const plain = stripHtml(ch.content);
        if (!plain) continue;
        const words = plain.split(/\s+/);
        const take = Math.min(words.length, Math.floor((MAX_TOTAL - totalWords) / 1));
        const excerpt = words.slice(0, take).join(' ');
        chapterExcerpts.push(`Chapter ${ch.order + 1}: "${ch.title}"\n${excerpt}`);
        totalWords += take;
      }

      if (chapterExcerpts.length === 0) {
        setError('No chapter content found to check for continuity.');
        setLoading(false);
        return;
      }

      const condensedContent = chapterExcerpts.join('\n\n---\n\n');
      const genre = project?.genre || 'fantasy';

      const prompt = `You are a continuity editor for a ${genre} fiction novel. Read through ALL these chapter excerpts and find any contradictions, inconsistencies, or continuity errors.

Check for:
- Character name spelling changes
- Timeline contradictions (events happening out of order, impossible timing)
- Location description mismatches (a place described differently in different chapters)
- Character trait inconsistencies (personality, appearance, abilities changing)
- Plot holes (unresolved threads, broken cause-and-effect)
- World-building contradictions (rules, magic systems, lore changing)

CHAPTERS:
${condensedContent}

For each issue found, use this format:
## Issue [number]: [brief title]
Description: [detail the problem]
Chapter: [which chapter has the issue]
Severity: [high/medium/low]
Suggested Fix: [how to resolve it]

If no issues are found, say "No continuity issues detected."`;

      const result = await callAI(prompt, 'You are a meticulous continuity editor. Find specific contradictions and inconsistencies. Be precise with chapter references. Rate severity as high, medium, or low.', 4096);
      const parsed = parseContinuityIssues(result);
      setContinuityIssues(parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Continuity check failed. Check your AI settings.');
    } finally {
      setLoading(false);
    }
  }, [chapters, project]);

  /* ── WHAT-IF EXPLORER ── */
  const handleWhatIfExplore = useCallback(async () => {
    if (!whatIfScenario.trim()) return;
    setLoading(true);
    setError(null);
    setWhatIfConsequences([]);

    try {
      const contextInfo = whatIfContext.trim()
        ? `The writer wants to explore this in the context of: ${whatIfContext.trim()}`
        : 'No specific chapter/act context provided.';

      const prompt = `You are a story architect helping a writer explore a plot direction.

A writer is considering this plot direction: "${whatIfScenario.trim()}"

${contextInfo}

Explore 3-4 possible consequences and ripple effects this would have on the story. For each consequence, provide:
- Title: A descriptive name for this consequence
- What Changes: Describe what changes in the story
- Affected Characters: Which characters are most impacted
- New Conflicts: What new tensions or complications arise
- Narrative Impact: How it enhances or complicates the narrative

Use this format:
## Consequence [number]: [Title]
What Changes: [description]
Affected Characters: [list and explain]
New Conflicts: [describe]
Narrative Impact: [analysis]`;

      const result = await callAI(prompt, 'You are a master story architect. Think deeply about narrative cause and effect. Consider both obvious and subtle consequences. Be creative yet grounded in good storytelling principles.', 4096);
      setWhatIfConsequences(parseWhatIfConsequences(result));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'What-if exploration failed. Check your AI settings.');
    } finally {
      setLoading(false);
    }
  }, [whatIfScenario, whatIfContext]);

  /* ── TONE & VOICE CHECK ── */
  const handleToneCheck = useCallback(async () => {
    if (!activeChapter) return;
    const chapterText = stripHtml(activeChapter.content);
    if (chapterText.length < 50) {
      setError('Chapter needs at least 50 words for tone analysis.');
      return;
    }

    setLoading(true);
    setError(null);
    setToneAnalysis(null);

    try {
      const excerpt = chapterText.substring(0, 6000);
      const genre = project?.genre || 'fantasy';

      const prompt = `Analyze the writing tone and voice of this ${genre} fiction chapter passage.

CHAPTER: "${activeChapter.title}"

PASSAGE:
${excerpt}${chapterText.length > 6000 ? '\n[... content truncated for length ...]' : ''}

Evaluate ALL of these areas:
## Narrative Voice
Is the voice consistent? What style does it employ (formal, casual, lyrical, sparse)?

## POV Adherence
Is the point of view consistent throughout? Are there any POV slips?

## Tense Consistency
Is the tense (past/present) consistent? Any shifts?

## Formality Level
What is the overall register? Is it consistent?

## Emotional Register
What is the emotional tone? Does it shift appropriately or inappropriately?

## Shifts and Inconsistencies
List any shifts in tone, voice, or style that seem unintentional.

## Suggestions
Give 3-4 specific, actionable suggestions to improve tone consistency and voice quality.`;

      const result = await callAI(prompt, 'You are an expert literary analyst specializing in fiction writing craft. Provide thorough, specific analysis of narrative technique. Be constructive with suggestions.', 4096);
      setToneAnalysis(parseToneAnalysis(result));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tone analysis failed. Check your AI settings.');
    } finally {
      setLoading(false);
    }
  }, [activeChapter, project]);

  /* ── Clear results when switching tabs ── */
  const handleTabChange = useCallback((tab: MuseTab) => {
    setActiveTab(tab);
    setError(null);
  }, []);

  /* ══════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                            */
  /* ══════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--accent-gold)', letterSpacing: 0.5 }}>
            AI as Muse
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Research Assistant
        </span>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex items-center shrink-0 px-2 pt-2 gap-0.5" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium rounded-t-md transition-colors"
            style={{
              background: activeTab === tab.key ? 'var(--bg-secondary)' : 'transparent',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent-gold)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--accent-gold)' : 'var(--text-muted)',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Content Area ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {/* ── Error Banner ── */}
        {error && (
          <div className="rounded-lg p-3 mb-3 flex items-start gap-2" style={{ background: 'rgba(160,64,64,0.1)', border: '1px solid rgba(160,64,64,0.2)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a04040" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" />
            </svg>
            <div className="flex-1">
              <p className="text-xs" style={{ color: 'var(--accent-red, #a04040)' }}>{error}</p>
            </div>
            <button onClick={() => setError(null)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
        )}

        {/* ── Loading Spinner ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div
              className="rounded-full"
              style={{
                width: 32, height: 32,
                border: '3px solid var(--border-color)',
                borderTopColor: 'var(--accent-gold)',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {activeTab === 'synonym' && 'Finding alternatives...'}
              {activeTab === 'continuity' && 'Checking continuity across chapters...'}
              {activeTab === 'whatif' && 'Exploring consequences...'}
              {activeTab === 'tone' && 'Analyzing tone and voice...'}
            </p>
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* TAB 1: SYNONYM FINDER                    */}
        {/* ════════════════════════════════════════ */}
        {activeTab === 'synonym' && !loading && (
          <div className="flex flex-col gap-3">
            {/* Input area */}
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Word or Phrase
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={synonymInput}
                  onChange={(e) => setSynonymInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSynonymSearch()}
                  placeholder="e.g., ancient, mysterious, powerful..."
                  className="flex-1 rounded-md px-3 py-2 text-sm"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontFamily: "'Georgia', serif",
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleSynonymSearch}
                  disabled={!synonymInput.trim()}
                  className="rounded-md px-3 py-2 text-xs font-medium transition-colors shrink-0"
                  style={{
                    background: synonymInput.trim() ? 'var(--accent-gold-dim)' : 'var(--bg-tertiary)',
                    border: '1px solid rgba(212,168,83,0.3)',
                    color: synonymInput.trim() ? 'var(--accent-gold)' : 'var(--text-muted)',
                    cursor: synonymInput.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Find Alternatives
                </button>
              </div>
            </div>

            {/* Results grid */}
            {synonyms.length > 0 && (
              <div>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  {synonyms.length} alternatives for &ldquo;{synonymInput.trim()}&rdquo;
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {synonyms.map((syn, i) => (
                    <div
                      key={i}
                      className="rounded-lg p-2.5"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--accent-gold)' }}>
                        {syn.word}
                      </p>
                      {syn.usage && (
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {syn.usage}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {synonyms.length === 0 && !error && (
              <div className="text-center py-8 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 opacity-50">
                  <path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4" /><path d="M14 2v6h6" /><path d="M5 12l-3 3 3 3" /><path d="M2 15h7" />
                </svg>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Enter a word or phrase to find vivid alternatives for your writing.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* TAB 2: CONTINUITY CHECKER                */}
        {/* ════════════════════════════════════════ */}
        {activeTab === 'continuity' && !loading && (
          <div className="flex flex-col gap-3">
            {/* Info */}
            <div className="rounded-lg p-3" style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.2)' }}>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Scans all {chapters.length} chapter{chapters.length !== 1 ? 's' : ''} for contradictions, timeline errors, character inconsistencies, and plot holes. Uses condensed excerpts (~500 words per chapter).
              </p>
            </div>

            <button
              onClick={handleContinuityCheck}
              disabled={chapters.length === 0}
              className="rounded-md px-4 py-2 text-xs font-medium transition-colors"
              style={{
                background: chapters.length > 0 ? 'var(--accent-gold-dim)' : 'var(--bg-tertiary)',
                border: '1px solid rgba(212,168,83,0.3)',
                color: chapters.length > 0 ? 'var(--accent-gold)' : 'var(--text-muted)',
                cursor: chapters.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Run Continuity Check
            </button>

            {/* Results */}
            {continuityIssues.length > 0 && (
              <div>
                <p className="text-xs mb-2 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {continuityIssues.length} issue{continuityIssues.length !== 1 ? 's' : ''} found
                </p>
                <div className="flex flex-col gap-2">
                  {continuityIssues.map((issue, i) => {
                    const sev = severityConfig[issue.severity];
                    return (
                      <div
                        key={i}
                        className="rounded-lg p-3"
                        style={{
                          background: 'var(--bg-secondary)',
                          border: `1px solid ${sev.bg}`,
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-xs font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>
                            {issue.description}
                          </p>
                          <span
                            className="text-xs rounded px-1.5 py-0.5 shrink-0"
                            style={{ background: sev.bg, color: sev.color, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}
                          >
                            {sev.label}
                          </span>
                        </div>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                          Chapter: {issue.chapter}
                        </p>
                        {issue.suggestedFix && (
                          <div className="rounded-md p-2 mt-1.5" style={{ background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.12)' }}>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                              <span className="font-semibold" style={{ color: '#27ae60' }}>Fix: </span>
                              {issue.suggestedFix}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* No issues */}
            {continuityIssues.length === 0 && !error && (
              <div className="text-center py-6">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Click the button above to scan your chapters for continuity errors.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* TAB 3: WHAT-IF EXPLORER                  */}
        {/* ════════════════════════════════════════ */}
        {activeTab === 'whatif' && !loading && (
          <div className="flex flex-col gap-3">
            {/* Scenario input */}
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                What-If Scenario
              </label>
              <textarea
                value={whatIfScenario}
                onChange={(e) => setWhatIfScenario(e.target.value)}
                placeholder="e.g., What if the protagonist discovers the villain is actually their father?"
                rows={3}
                className="w-full rounded-md px-3 py-2 text-sm resize-none"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontFamily: "'Georgia', serif",
                  outline: 'none',
                }}
              />
            </div>

            {/* Context input */}
            <div>
              <label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Context (optional)
              </label>
              <div className="flex gap-2">
                <select
                  value={whatIfContext}
                  onChange={(e) => setWhatIfContext(e.target.value)}
                  className="flex-1 rounded-md px-3 py-2 text-sm"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontFamily: "'Georgia', serif",
                    cursor: 'pointer',
                  }}
                >
                  <option value="">Select a chapter for context...</option>
                  {chapters.map((ch) => (
                    <option key={ch.id} value={`Chapter ${ch.order + 1}: ${ch.title}`}>
                      Ch {ch.order + 1}: {ch.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleWhatIfExplore}
              disabled={!whatIfScenario.trim()}
              className="rounded-md px-4 py-2 text-xs font-medium transition-colors"
              style={{
                background: whatIfScenario.trim() ? 'var(--accent-gold-dim)' : 'var(--bg-tertiary)',
                border: '1px solid rgba(212,168,83,0.3)',
                color: whatIfScenario.trim() ? 'var(--accent-gold)' : 'var(--text-muted)',
                cursor: whatIfScenario.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Explore
            </button>

            {/* Results */}
            {whatIfConsequences.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs mb-1 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {whatIfConsequences.length} possible consequence{whatIfConsequences.length !== 1 ? 's' : ''}
                </p>
                {whatIfConsequences.map((conseq, i) => {
                  const isExpanded = expandedConsequence === `conseq-${i}`;
                  return (
                    <div
                      key={i}
                      className="rounded-lg overflow-hidden"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                    >
                      <button
                        onClick={() => setExpandedConsequence(isExpanded ? null : `conseq-${i}`)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                        style={{ borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none' }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className="text-xs rounded-full w-5 h-5 flex items-center justify-center shrink-0"
                            style={{ background: 'var(--accent-gold-dim)', color: 'var(--accent-gold)', fontSize: 10, fontWeight: 700 }}
                          >
                            {i + 1}
                          </span>
                          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {conseq.title}
                          </span>
                        </div>
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 8 }}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>

                      {isExpanded && (
                        <div className="px-3 py-2.5 flex flex-col gap-2.5">
                          {conseq.description && (
                            <div>
                              <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>What Changes</p>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{conseq.description}</p>
                            </div>
                          )}
                          {conseq.affectedCharacters && (
                            <div className="rounded-md p-2" style={{ background: 'rgba(74,120,160,0.06)', border: '1px solid rgba(74,120,160,0.12)' }}>
                              <p className="text-xs font-semibold mb-0.5" style={{ color: '#4a78a0' }}>Affected Characters</p>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{conseq.affectedCharacters}</p>
                            </div>
                          )}
                          {conseq.newConflicts && (
                            <div className="rounded-md p-2" style={{ background: 'rgba(160,64,64,0.06)', border: '1px solid rgba(160,64,64,0.12)' }}>
                              <p className="text-xs font-semibold mb-0.5" style={{ color: '#a04040' }}>New Conflicts</p>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{conseq.newConflicts}</p>
                            </div>
                          )}
                          {conseq.narrativeImpact && (
                            <div className="rounded-md p-2" style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.12)' }}>
                              <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--accent-gold)' }}>Narrative Impact</p>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{conseq.narrativeImpact}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {whatIfConsequences.length === 0 && !error && (
              <div className="text-center py-8 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2 opacity-50">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Describe a plot twist or change to explore its ripple effects on your story.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════ */}
        {/* TAB 4: TONE & VOICE CHECK                */}
        {/* ════════════════════════════════════════ */}
        {activeTab === 'tone' && !loading && (
          <div className="flex flex-col gap-3">
            {!activeChapter ? (
              <div className="text-center py-8 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Select a chapter to analyze its tone and voice.
                </p>
              </div>
            ) : !toneAnalysis ? (
              <>
                {/* Active chapter info */}
                <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>
                    {activeChapter.title}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {stripHtml(activeChapter.content).split(/\s+/).filter(Boolean).length} words
                  </p>
                </div>

                <button
                  onClick={handleToneCheck}
                  className="rounded-md px-4 py-2 text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--accent-gold-dim)',
                    border: '1px solid rgba(212,168,83,0.3)',
                    color: 'var(--accent-gold)',
                    cursor: 'pointer',
                  }}
                >
                  Analyze Tone &amp; Voice
                </button>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Analysis of &ldquo;{activeChapter.title}&rdquo;
                </p>

                {/* Analysis cards grid */}
                <div className="grid grid-cols-1 gap-2">
                  {toneAnalysis.narrativeVoice && (
                    <ToneCard label="Narrative Voice" value={toneAnalysis.narrativeVoice} color="var(--accent-gold)" />
                  )}
                  {toneAnalysis.povAdherence && (
                    <ToneCard label="POV Adherence" value={toneAnalysis.povAdherence} color="#4a78a0" />
                  )}
                  {toneAnalysis.tenseConsistency && (
                    <ToneCard label="Tense Consistency" value={toneAnalysis.tenseConsistency} color="#7a58a0" />
                  )}
                  {toneAnalysis.formalityLevel && (
                    <ToneCard label="Formality Level" value={toneAnalysis.formalityLevel} color="#4a9a6a" />
                  )}
                  {toneAnalysis.emotionalRegister && (
                    <ToneCard label="Emotional Register" value={toneAnalysis.emotionalRegister} color="#a0764a" />
                  )}
                </div>

                {/* Shifts & Inconsistencies */}
                {toneAnalysis.shifts.length > 0 && (
                  <div className="rounded-lg p-3" style={{ background: 'rgba(160,64,64,0.08)', border: '1px solid rgba(160,64,64,0.2)' }}>
                    <h5 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#a04040' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
                      Shifts &amp; Inconsistencies
                    </h5>
                    <ul className="flex flex-col gap-1">
                      {toneAnalysis.shifts.map((s, i) => (
                        <li key={i} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Suggestions */}
                {toneAnalysis.suggestions.length > 0 && (
                  <div className="rounded-lg p-3" style={{ background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.2)' }}>
                    <h5 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#27ae60' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                      Suggestions
                    </h5>
                    <ul className="flex flex-col gap-1">
                      {toneAnalysis.suggestions.map((s, i) => (
                        <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                          <span style={{ color: '#27ae60', flexShrink: 0 }}>+</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Re-analyze button */}
                <button
                  onClick={handleToneCheck}
                  className="rounded-md px-4 py-2 text-xs font-medium transition-colors"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  Re-analyze
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-component: Tone Card                                           */
/* ------------------------------------------------------------------ */

function ToneCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
      <p className="text-xs font-semibold mb-1" style={{ color }}>
        {label}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {value}
      </p>
    </div>
  );
}
