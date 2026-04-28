'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { useStore } from '@/lib/store';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SceneReview {
  id: string;
  label: string;
  purpose: string;
  whatWorks: string[];
  whatDoesntWork: string[];
  improvements: string[];
  rating: 'strong' | 'adequate' | 'needs-work';
  estimatedWords: number;
}

interface ChapterAnalysis {
  chapterId: string;
  chapterTitle: string;
  totalWords: number;
  overallSummary: string;
  pacingAssessment: string;
  characterDevelopment: string;
  scenes: SceneReview[];
  globalStrengths: string[];
  globalWeaknesses: string[];
}

interface SuggestedScene {
  id: string;
  label: string;
  purpose: string;
  keyCharacters: string;
  emotionalTone: string;
  description: string;
}

interface WritingDirections {
  outline: SuggestedScene[];
  directions: string[];
  tips: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ------------------------------------------------------------------ */
/*  AI call helper                                                     */
/* ------------------------------------------------------------------ */

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
/*  Parse Analyze response — per-scene deep review                      */
/* ------------------------------------------------------------------ */

function parseAnalysis(text: string, chapterId: string, chapterTitle: string, totalWords: number): ChapterAnalysis {
  const scenes: SceneReview[] = [];
  const globalStrengths: string[] = [];
  const globalWeaknesses: string[] = [];
  let overallSummary = '';
  let pacingAssessment = '';
  let characterDevelopment = '';

  const lines = text.split('\n');

  // Split into scene blocks
  interface SceneBlock {
    label: string;
    lines: string[];
  }

  const sceneBlocks: SceneBlock[] = [];
  let currentBlock: SceneBlock | null = null;
  let currentGlobalSection = '';
  const globalLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect scene headers — patterns like "Scene 1:", "## Scene 1:", "# Scene 1 - ...", "Beat 1:", "Scene: ..."
    if (trimmed.match(/^#*\s*(scene|beat|act)\s*\d+/i) || trimmed.match(/^#*\s*(scene|beat)\s*[:\-–]/i)) {
      if (currentBlock) sceneBlocks.push(currentBlock);
      const label = trimmed.replace(/^#*\s*/, '').replace(/^[-*\d.)\s]+/, '').trim();
      currentBlock = { label, lines: [] };
      currentGlobalSection = '';
      continue;
    }

    // Detect global section headers
    if (trimmed.match(/^#*\s*(overall\s*summary|chapter\s*summary|summary)/i)) {
      currentGlobalSection = 'summary';
      currentBlock = null;
      continue;
    }
    if (trimmed.match(/^#*\s*(pacing|pace|rhythm|tempo)/i)) {
      currentGlobalSection = 'pacing';
      currentBlock = null;
      continue;
    }
    if (trimmed.match(/^#*\s*(character\s*develop|character\s*arc|characters)/i)) {
      currentGlobalSection = 'characters';
      currentBlock = null;
      continue;
    }
    if (trimmed.match(/^#*\s*(overall\s*strength|chapter\s*strength|what\s*works\s*(well)?|strengths)/i)) {
      currentGlobalSection = 'strengths';
      currentBlock = null;
      continue;
    }
    if (trimmed.match(/^#*\s*(overall\s*weakness|chapter\s*weakness|what.*doesn'?t|what.*missing|weakness|areas?\s*for\s*improv)/i)) {
      currentGlobalSection = 'weaknesses';
      currentBlock = null;
      continue;
    }

    const cleanLine = trimmed.replace(/^[-*]\s*/, '');
    if (!cleanLine) continue;

    if (currentBlock) {
      currentBlock.lines.push(cleanLine);
    } else if (currentGlobalSection) {
      switch (currentGlobalSection) {
        case 'summary': overallSummary += (overallSummary ? ' ' : '') + cleanLine; break;
        case 'pacing': pacingAssessment += (pacingAssessment ? ' ' : '') + cleanLine; break;
        case 'characters': characterDevelopment += (characterDevelopment ? ' ' : '') + cleanLine; break;
        case 'strengths': if (cleanLine.length > 5) globalStrengths.push(cleanLine); break;
        case 'weaknesses': if (cleanLine.length > 5) globalWeaknesses.push(cleanLine); break;
      }
    }
  }

  // Flush last block
  if (currentBlock) sceneBlocks.push(currentBlock);

  // Parse each scene block into structured review
  const sceneCount = sceneBlocks.length || 1;
  const wordsPerScene = Math.floor(totalWords / sceneCount);

  for (let i = 0; i < sceneBlocks.length; i++) {
    const block = sceneBlocks[i];
    const review: SceneReview = {
      id: uid(),
      label: block.label,
      purpose: '',
      whatWorks: [],
      whatDoesntWork: [],
      improvements: [],
      rating: 'adequate',
      estimatedWords: wordsPerScene,
    };

    let subSection = '';
    for (const line of block.lines) {
      if (line.match(/^(purpose|narrative\s*purpose|role|function)/i)) {
        subSection = 'purpose';
        continue;
      }
      if (line.match(/^(what\s*works|strengths?|positive|good|done\s*well|effective)/i)) {
        subSection = 'works';
        continue;
      }
      if (line.match(/^(what\s*doesn'?t|weakness|problem|issue|gap|missing|falls?\s*short|not\s*working|concern)/i)) {
        subSection = 'doesntwork';
        continue;
      }
      if (line.match(/^(improv|suggest|recommend|fix|better|enhance|could|try|consider|rewrite|revise)/i)) {
        subSection = 'improvements';
        continue;
      }

      if (line.length < 5) continue;

      switch (subSection) {
        case 'purpose':
          review.purpose += (review.purpose ? ' ' : '') + line;
          break;
        case 'works':
          review.whatWorks.push(line);
          break;
        case 'doesntwork':
          review.whatDoesntWork.push(line);
          break;
        case 'improvements':
          review.improvements.push(line);
          break;
        default:
          // If no sub-section detected yet, try to classify
          if (!review.purpose) {
            review.purpose = line;
          }
      }
    }

    // Determine rating based on balance
    const positives = review.whatWorks.length;
    const negatives = review.whatDoesntWork.length;
    if (positives >= 2 && negatives === 0) review.rating = 'strong';
    else if (negatives > positives) review.rating = 'needs-work';

    scenes.push(review);
  }

  // If no scenes parsed from headers, try numbered bullet pattern
  if (scenes.length === 0) {
    const bulletPattern = /^\s*[-*\d.)]+\s+(.+)/;
    let accumulated: string[] = [];
    let currentLabel = '';

    for (const line of lines) {
      const m = line.match(bulletPattern);
      if (m && m[1].length > 10) {
        if (currentLabel) {
          scenes.push({
            id: uid(),
            label: currentLabel,
            purpose: accumulated.slice(0, 2).join(' '),
            whatWorks: accumulated.filter(l => l.match(/good|well|effective|strong/i)),
            whatDoesntWork: accumulated.filter(l => l.match(/problem|issue|weak|missing|lacks/i)),
            improvements: accumulated.filter(l => l.match(/try|suggest|could|should|improve/i)),
            rating: 'adequate',
            estimatedWords: wordsPerScene,
          });
        }
        currentLabel = m[1].replace(/[:.]/g, '').trim();
        accumulated = [];
      } else {
        const clean = line.replace(/^[-*]\s*/, '').trim();
        if (clean.length > 5) accumulated.push(clean);
      }
    }

    if (currentLabel) {
      scenes.push({
        id: uid(),
        label: currentLabel,
        purpose: accumulated.slice(0, 2).join(' '),
        whatWorks: accumulated.filter(l => l.match(/good|well|effective|strong/i)),
        whatDoesntWork: accumulated.filter(l => l.match(/problem|issue|weak|missing|lacks/i)),
        improvements: accumulated.filter(l => l.match(/try|suggest|could|should|improve/i)),
        rating: 'adequate',
        estimatedWords: wordsPerScene,
      });
    }
  }

  return { chapterId, chapterTitle, totalWords, overallSummary, pacingAssessment, characterDevelopment, scenes, globalStrengths, globalWeaknesses };
}

/* ------------------------------------------------------------------ */
/*  Parse Directions response                                          */
/* ------------------------------------------------------------------ */

function parseDirections(text: string): WritingDirections {
  const outline: SuggestedScene[] = [];
  const directions: string[] = [];
  const tips: string[] = [];
  const lines = text.split('\n');
  let currentSection = '';
  let currentScene: SuggestedScene | null = null;
  let sceneField = '';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.match(/^#*\s*(scene|beat)\s*\d/i)) {
      if (currentScene) outline.push(currentScene);
      currentScene = { id: uid(), label: trimmed.replace(/^#*\s*/, '').trim(), purpose: '', keyCharacters: '', emotionalTone: '', description: '' };
      sceneField = '';
      currentSection = 'outline';
      continue;
    }

    if (trimmed.match(/^#*\s*(direction|plot\s*direction|story\s*direction|approach|angle|path|route|alternative)/i)) {
      currentSection = 'directions';
      continue;
    }
    if (trimmed.match(/^#*\s*(tip|advice|remember|note|consider|keep|guidance|writing\s*tip)/i)) {
      currentSection = 'tips';
      continue;
    }

    const clean = trimmed.replace(/^[-*]\s*/, '');
    if (!clean) continue;

    if (currentSection === 'outline' && currentScene) {
      if (clean.match(/^(purpose|narrative\s*purpose|role)/i)) { sceneField = 'purpose'; continue; }
      if (clean.match(/^(character|who|cast|involv)/i)) { sceneField = 'characters'; continue; }
      if (clean.match(/^(tone|emotion|mood|feel|vibe)/i)) { sceneField = 'tone'; continue; }
      if (clean.match(/^(description|what\s*happens|action|detail)/i)) { sceneField = 'description'; continue; }

      switch (sceneField) {
        case 'purpose': currentScene.purpose += (currentScene.purpose ? ' ' : '') + clean; break;
        case 'characters': currentScene.keyCharacters += (currentScene.keyCharacters ? ', ' : '') + clean; break;
        case 'tone': currentScene.emotionalTone += (currentScene.emotionalTone ? ' ' : '') + clean; break;
        case 'description': currentScene.description += (currentScene.description ? ' ' : '') + clean; break;
        default: currentScene.description += (currentScene.description ? ' ' : '') + clean; break;
      }
    }

    if (currentSection === 'directions' && clean.length > 5) directions.push(clean);
    if (currentSection === 'tips' && clean.length > 5) tips.push(clean);
  }

  if (currentScene) outline.push(currentScene);

  // Fallback: if no outline parsed, extract numbered items
  if (outline.length === 0) {
    for (const line of lines) {
      const m = line.match(/^\s*[-*\d.)]+\s+(.+)/);
      if (m && m[1].length > 10) {
        outline.push({ id: uid(), label: m[1].replace(/[:.]/g, '').trim(), purpose: '', keyCharacters: '', emotionalTone: '', description: '' });
      }
    }
  }

  return { outline, directions, tips };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SceneBreakdownPanel() {
  const activeProjectId = useStore((s) => s.activeProjectId);
  const activeChapterId = useStore((s) => s.activeChapterId);
  const getActiveProject = useStore((s) => s.getActiveProject);
  const setActiveChapter = useStore((s) => s.setActiveChapter);
  const aiSettings = useStore((s) => s.aiSettings);

  const project = getActiveProject();
  const chapters = useMemo(() => project?.chapters || [], [project]);

  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ChapterAnalysis | null>(null);
  const [directions, setDirections] = useState<WritingDirections | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'analyze' | 'suggest'>('analyze');
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedChapter = useMemo(
    () => chapters.find(c => c.id === selectedChapterId) || chapters.find(c => c.id === activeChapterId) || null,
    [chapters, selectedChapterId, activeChapterId],
  );

  const chapterText = useMemo(() => selectedChapter ? stripHtml(selectedChapter.content) : '', [selectedChapter]);
  const wordCount = useMemo(() => countWords(chapterText), [chapterText]);
  const hasContent = wordCount > 0;
  const isSubstantial = wordCount > 100;

  // Auto-select active chapter
  useMemo(() => {
    if (activeChapterId && !selectedChapterId) {
      setSelectedChapterId(activeChapterId);
    }
  }, [activeChapterId, selectedChapterId]);

  const handleSelectChapter = useCallback((id: string) => {
    setSelectedChapterId(id);
    setAnalysis(null);
    setDirections(null);
    setError(null);
    setActiveChapter(id);
  }, [setActiveChapter]);

  /* ── ANALYZE: Deep per-scene review ── */
  const handleAnalyze = useCallback(async () => {
    if (!selectedChapter || !hasContent) return;
    setLoading(true);
    setError(null);
    setMode('analyze');

    try {
      const prompt = `You are an expert fiction editor performing a detailed scene-by-scene critique of a chapter. This is NOT a summary — this is a critical review.

Chapter title: "${selectedChapter.title}"
Total words: ${wordCount}

CHAPTER CONTENT:
${chapterText.substring(0, 6000)}${chapterText.length > 6000 ? '\n[... content truncated for length ...]' : ''}

INSTRUCTIONS — Analyze each scene individually with specific, actionable criticism:

For EACH scene you identify, provide ALL of these sections:
- **Purpose**: What is this scene trying to accomplish narratively?
- **What Works**: Specific things done well (dialogue, pacing, imagery, tension, etc.) — give concrete examples from the text
- **What Doesn't Work**: Specific problems (flat dialogue, info-dumping, unclear transitions, weak stakes, tell-don't-show, etc.) — reference specific passages
- **Improvements**: Specific, actionable suggestions to make this scene stronger (not vague advice)

After all scenes, provide:
## Overall Strengths
2-3 things the chapter does well as a whole

## Overall Weaknesses
2-3 recurring issues across the chapter

## Pacing Assessment
How well does the chapter flow? Is there proper escalation? Are there dead spots?

## Character Development
How well are characters developed in this chapter? Are their motivations clear?

FORMAT: Use "## Scene N: [Title]" headers for each scene. Use sub-headers for each review section. Be specific, critical, and constructive. This should feel like feedback from a professional editor.`;

      const result = await callAI(prompt, 'You are a professional fiction editor known for detailed, honest, and constructive critiques. You provide specific, actionable feedback with concrete examples. You balance praise with criticism and always offer clear improvement suggestions.', 4096);
      const parsed = parseAnalysis(result, selectedChapter.id, selectedChapter.title, wordCount);
      setAnalysis(parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Check your AI settings.');
    } finally {
      setLoading(false);
    }
  }, [selectedChapter, chapterText, wordCount, hasContent]);

  /* ── DIRECTIONS: Writing guidance ── */
  const handleSuggest = useCallback(async () => {
    if (!selectedChapter) return;
    setLoading(true);
    setError(null);
    setMode('suggest');

    try {
      const contextParts: string[] = [];
      contextParts.push(`Book genre: ${project?.genre || 'fantasy'}`);
      if (project?.description) contextParts.push(`Book description: ${project?.description}`);

      // Add context from other chapters
      const otherChapters = chapters.filter(c => c.id !== selectedChapter.id);
      for (const ch of otherChapters.slice(-3)) {
        const text = stripHtml(ch.content);
        if (text.length > 0) {
          contextParts.push(`Previous chapter "${ch.title}": ${text.substring(0, 400)}...`);
        }
      }

      const existingContentNote = hasContent
        ? `\n\nThis chapter already has ${wordCount} words written. The suggestions below should help CONTINUE and develop the existing content further. Here is what exists so far:\n${chapterText.substring(0, 2000)}${chapterText.length > 2000 ? '...' : ''}`
        : '\n\nThis chapter is completely empty and needs to be written from scratch.';

      const prompt = `You are a master story architect helping an author plan or continue writing a chapter.

BOOK CONTEXT:
${contextParts.join('\n')}

CHAPTER TO PLAN: "${selectedChapter.title}"
Chapter order in book: ${chapters.findIndex(c => c.id === selectedChapter.id) + 1} of ${chapters.length}
${existingContentNote}

Provide ALL of the following sections:

## Scene 1: [Name]
- **Purpose**: What this scene accomplishes
- **Key Characters**: Who appears
- **Emotional Tone**: The mood
- **Description**: What happens and why it matters

(Repeat for 3-5 scenes)

## Possible Directions
2-3 different creative directions this chapter could take. For example:
- "Focus on internal conflict while the character travels"
- "Open with an action sequence that disrupts the status quo"
- "Use a quiet character moment to build emotional depth"

## Writing Tips
2-3 specific craft tips for this type of scene/chapter based on the genre. Be practical, not vague.`;

      const result = await callAI(prompt, aiSettings.systemPrompt, 4096);
      const parsed = parseDirections(result);
      setDirections(parsed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestions. Check your AI settings.');
    } finally {
      setLoading(false);
    }
  }, [selectedChapter, chapterText, wordCount, hasContent, project, chapters, aiSettings]);

  /* ── Rating config ── */
  const ratingConfig: Record<string, { color: string; bg: string; label: string }> = {
    strong: { color: '#27ae60', bg: 'rgba(39,174,96,0.15)', label: 'Strong' },
    adequate: { color: '#d4a853', bg: 'rgba(212,168,83,0.15)', label: 'Adequate' },
    'needs-work': { color: '#a04040', bg: 'rgba(160,64,64,0.15)', label: 'Needs Work' },
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg-primary)' }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--accent-gold)', letterSpacing: 0.5 }}>
            Scenes &amp; Beats
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          {chapters.length} chapter{chapters.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Chapter selector ── */}
      <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2">
          <select
            value={selectedChapterId || ''}
            onChange={(e) => handleSelectChapter(e.target.value)}
            className="flex-1 rounded-md px-3 py-1.5 text-sm"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontFamily: "'Georgia', serif",
              cursor: 'pointer',
            }}
          >
            <option value="">Select a chapter...</option>
            {chapters.sort((a, b) => a.order - b.order).map((ch) => (
              <option key={ch.id} value={ch.id}>
                Ch {ch.order + 1}: {ch.title} ({countWords(stripHtml(ch.content))}w)
              </option>
            ))}
          </select>
        </div>

        {/* Action buttons */}
        {selectedChapter && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleAnalyze}
              disabled={loading || !hasContent}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: isSubstantial ? 'var(--accent-gold-dim)' : 'var(--bg-tertiary)',
                border: '1px solid rgba(212,168,83,0.3)',
                color: isSubstantial ? 'var(--accent-gold)' : 'var(--text-muted)',
                cursor: isSubstantial && !loading ? 'pointer' : 'not-allowed',
                opacity: isSubstantial ? 1 : 0.6,
              }}
              title={isSubstantial ? 'Deep scene-by-scene critique' : 'Write at least 100 words to enable analysis'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Analyze Review
            </button>
            <button
              onClick={handleSuggest}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: loading ? 'var(--bg-tertiary)' : 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                color: loading ? 'var(--text-muted)' : 'var(--text-secondary)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              title="Get writing suggestions and scene structure"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 12h-4"/><path d="M12 8h.01"/><path d="M12 16h.01"/></svg>
              Get Directions
            </button>
          </div>
        )}

        {/* No chapter state */}
        {!selectedChapter && (
          <div className="mt-3 text-center py-4 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Select a chapter to analyze its scenes or get writing directions.
            </p>
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
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
              {mode === 'analyze' ? 'Performing deep scene critique...' : 'Generating writing directions...'}
            </p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="rounded-lg p-3 mt-2" style={{ background: 'rgba(160,64,64,0.1)', border: '1px solid rgba(160,64,64,0.2)' }}>
            <p className="text-xs" style={{ color: 'var(--accent-red)' }}>{error}</p>
          </div>
        )}

        {/* Chapter info bar (initial state) */}
        {selectedChapter && !loading && !analysis && !directions && (
          <div className="mt-1">
            <div className="rounded-lg p-4 mb-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
              <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                {selectedChapter.title}
              </h4>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>{wordCount} words</span>
                <span style={{ textTransform: 'capitalize' }}>{selectedChapter.status}</span>
                {!hasContent && (
                  <span style={{ color: 'var(--accent-gold)', fontStyle: 'italic' }}>Not yet written</span>
                )}
                {hasContent && !isSubstantial && (
                  <span style={{ color: 'var(--accent-gold-dim)', fontStyle: 'italic' }}>Too short for analysis</span>
                )}
              </div>
            </div>

            {/* Explain the two modes */}
            <div className="flex flex-col gap-2">
              <div className="rounded-lg p-3" style={{ background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.2)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-gold)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  Analyze Review
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Deep scene-by-scene critique. For each scene: what works, what doesn&apos;t, and specific improvements. Requires 100+ words.
                </p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'rgba(74,120,160,0.08)', border: '1px solid rgba(74,120,160,0.2)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-blue)' }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: '-1px', marginRight: 4 }}><circle cx="12" cy="12" r="10"/><path d="M16 12h-4"/><path d="M12 8h.01"/><path d="M12 16h.01"/></svg>
                  Get Directions
                </p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Plan what to write next. Get a suggested scene structure, possible plot directions, and genre-specific writing tips. Works for empty or partial chapters.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────── */}
        {/* ── ANALYSIS RESULTS: Deep Scene Review ── */}
        {/* ────────────────────────────────────────────── */}
        {analysis && !loading && (
          <div className="space-y-3">
            {/* Overall Summary */}
            {analysis.overallSummary && (
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                <h5 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--accent-gold)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  Overall Summary
                </h5>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{analysis.overallSummary}</p>
              </div>
            )}

            {/* Pacing & Character assessment */}
            <div className="grid grid-cols-2 gap-2">
              {analysis.pacingAssessment && (
                <div className="rounded-lg p-2.5" style={{ background: 'rgba(74,120,160,0.08)', border: '1px solid rgba(74,120,160,0.15)' }}>
                  <h6 className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-blue)' }}>Pacing</h6>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{analysis.pacingAssessment}</p>
                </div>
              )}
              {analysis.characterDevelopment && (
                <div className="rounded-lg p-2.5" style={{ background: 'rgba(122,88,160,0.08)', border: '1px solid rgba(122,88,160,0.15)' }}>
                  <h6 className="text-xs font-semibold mb-1" style={{ color: 'var(--accent-purple)' }}>Characters</h6>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{analysis.characterDevelopment}</p>
                </div>
              )}
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>{analysis.totalWords} words</span>
              <span>|</span>
              <span>{analysis.scenes.length} scene{analysis.scenes.length !== 1 ? 's' : ''} reviewed</span>
            </div>

            {/* ── PER-SCENE REVIEW CARDS ── */}
            {analysis.scenes.length > 0 && (
              <div className="flex flex-col gap-3">
                <h5 className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                  Scene-by-Scene Review
                </h5>

                {analysis.scenes.map((scene) => {
                  const rc = ratingConfig[scene.rating] || ratingConfig.adequate;
                  const isExpanded = expandedScene === scene.id;

                  return (
                    <div
                      key={scene.id}
                      className="rounded-lg overflow-hidden"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                    >
                      {/* Scene header — always visible */}
                      <button
                        onClick={() => setExpandedScene(isExpanded ? null : scene.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left"
                        style={{ borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none' }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className="text-xs rounded px-1.5 py-0.5 shrink-0"
                            style={{ background: rc.bg, color: rc.color, fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}
                          >
                            {rc.label}
                          </span>
                          <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {scene.label}
                          </span>
                        </div>
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0, marginLeft: 8 }}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-3 py-2.5 flex flex-col gap-3">
                          {/* Purpose */}
                          {scene.purpose && (
                            <div>
                              <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Narrative Purpose</p>
                              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{scene.purpose}</p>
                            </div>
                          )}

                          {/* What Works */}
                          {scene.whatWorks.length > 0 && (
                            <div className="rounded-md p-2" style={{ background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.12)' }}>
                              <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: '#27ae60' }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                                What Works
                              </p>
                              <ul className="flex flex-col gap-1">
                                {scene.whatWorks.map((w, i) => (
                                  <li key={i} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* What Doesn't Work */}
                          {scene.whatDoesntWork.length > 0 && (
                            <div className="rounded-md p-2" style={{ background: 'rgba(160,64,64,0.06)', border: '1px solid rgba(160,64,64,0.12)' }}>
                              <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: '#a04040' }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                What Doesn&apos;t Work
                              </p>
                              <ul className="flex flex-col gap-1">
                                {scene.whatDoesntWork.map((w, i) => (
                                  <li key={i} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    {w}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Improvements */}
                          {scene.improvements.length > 0 && (
                            <div className="rounded-md p-2" style={{ background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.12)' }}>
                              <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: '#d4a853' }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                Improvements
                              </p>
                              <ul className="flex flex-col gap-1">
                                {scene.improvements.map((im, i) => (
                                  <li key={i} className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    {im}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* No feedback available */}
                          {scene.whatWorks.length === 0 && scene.whatDoesntWork.length === 0 && scene.improvements.length === 0 && (
                            <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                              No specific feedback extracted for this scene. Try running the analysis again.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Global Strengths */}
            {analysis.globalStrengths.length > 0 && (
              <div className="rounded-lg p-3" style={{ background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.2)' }}>
                <h5 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#27ae60' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>
                  Overall Strengths
                </h5>
                <ul className="flex flex-col gap-1">
                  {analysis.globalStrengths.map((s, i) => (
                    <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#27ae60', flexShrink: 0 }}>+</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Global Weaknesses */}
            {analysis.globalWeaknesses.length > 0 && (
              <div className="rounded-lg p-3" style={{ background: 'rgba(160,64,64,0.08)', border: '1px solid rgba(160,64,64,0.2)' }}>
                <h5 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: '#a04040' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Overall Weaknesses
                </h5>
                <ul className="flex flex-col gap-1">
                  {analysis.globalWeaknesses.map((w, i) => (
                    <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: '#a04040', flexShrink: 0 }}>!</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ────────────────────────────────────────────── */}
        {/* ── DIRECTIONS RESULTS: Writing Guidance ── */}
        {/* ────────────────────────────────────────────── */}
        {directions && !loading && (
          <div className="space-y-4">
            {/* Suggested outline */}
            {directions.outline.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  Suggested Scene Structure
                </h5>
                <div className="flex flex-col gap-2">
                  {directions.outline.map((scene, idx) => (
                    <div
                      key={scene.id}
                      className="rounded-lg p-2.5"
                      style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderLeft: '3px solid var(--accent-blue)',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs rounded-full flex items-center justify-center"
                          style={{ width: 18, height: 18, background: 'rgba(74,120,160,0.15)', color: 'var(--accent-blue)', fontSize: 10, fontWeight: 700 }}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {scene.label}
                        </span>
                      </div>
                      {scene.description && (
                        <p className="text-xs leading-relaxed ml-7 mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                          {scene.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1.5 ml-7">
                        {scene.purpose && (
                          <span className="text-xs rounded px-1.5 py-0.5" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: 10 }}>
                            {scene.purpose.substring(0, 50)}{scene.purpose.length > 50 ? '...' : ''}
                          </span>
                        )}
                        {scene.emotionalTone && (
                          <span className="text-xs rounded px-1.5 py-0.5" style={{ background: 'rgba(122,88,160,0.1)', color: 'var(--accent-purple)', fontSize: 10 }}>
                            {scene.emotionalTone}
                          </span>
                        )}
                        {scene.keyCharacters && (
                          <span className="text-xs rounded px-1.5 py-0.5" style={{ background: 'rgba(212,168,83,0.1)', color: 'var(--accent-gold-dim)', fontSize: 10 }}>
                            {scene.keyCharacters}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Directions */}
            {directions.directions.length > 0 && (
              <div className="rounded-lg p-3" style={{ background: 'rgba(74,120,160,0.08)', border: '1px solid rgba(74,120,160,0.2)' }}>
                <h5 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--accent-blue)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4"/></svg>
                  Possible Directions
                </h5>
                <ul className="flex flex-col gap-1.5">
                  {directions.directions.map((d, i) => (
                    <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--accent-blue)', flexShrink: 0 }}>{i + 1}.</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tips */}
            {directions.tips.length > 0 && (
              <div className="rounded-lg p-3" style={{ background: 'rgba(122,88,160,0.08)', border: '1px solid rgba(122,88,160,0.2)' }}>
                <h5 className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--accent-purple)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                  Writing Tips
                </h5>
                <ul className="flex flex-col gap-1.5">
                  {directions.tips.map((t, i) => (
                    <li key={i} className="text-xs leading-relaxed flex items-start gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                      <span style={{ color: 'var(--accent-purple)', flexShrink: 0 }}>*</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state: no chapters ── */}
        {chapters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <path d="M14 2v6h6"/>
              <path d="m16 13-3.5 3.5-2-2L8 17"/>
            </svg>
            <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>No chapters yet</p>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Create a chapter from the Chapters panel, then come back here to analyze it.
            </p>
          </div>
        )}
      </div>

      {/* ── CSS ── */}
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
