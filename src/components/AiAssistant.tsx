'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { AiMessage, AiSettings, WorldEntry, WorldCategory } from '@/lib/types';
import { analyzeStyle, buildVoicePrompt, VoiceEngram } from '@/lib/voice-engram';

/* ───────────────────────── helpers ───────────────────────── */

const CHAT_STORAGE_PREFIX = 'iw_chat_';
const MAX_CHAT_MESSAGES = 30;
const TAIL_CHARS = 2000;
const AI_KEY_STORAGE = 'iw_ai_key';
const AI_PROVIDER_STORAGE = 'iw_ai_provider';

function getStoredAiKey(): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(AI_KEY_STORAGE) || ''; } catch { return ''; }
}
function getStoredAiProvider(): string {
  if (typeof window === 'undefined') return 'openrouter';
  try { return localStorage.getItem(AI_PROVIDER_STORAGE) || 'openrouter'; } catch { return 'openrouter'; }
}

/** Simple markdown → React-safe HTML for bold, italic, inline code. */
function renderMarkdown(text: string): string {
  let html = text;
  // escape HTML entities first (but preserve our own tags later)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // inline code (must come before bold/italic so asterisks inside code aren't touched)
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-elevated);padding:1px 5px;border-radius:4px;font-size:12px;color:var(--accent-gold)">$1</code>');
  // bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html;
}

/* ────────────── quick‑action definitions ────────────── */

interface QuickAction {
  label: string;
  icon: string;
  prompt: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: 'Review Writing',
    icon: '📝',
    prompt:
      'Please review my current writing. Focus on prose quality, pacing, dialogue, and consistency with established lore. Be specific and constructive.',
  },
  {
    label: 'Suggest Next',
    icon: '🔮',
    prompt:
      "Based on what I've written so far, what should happen next in the story? Give me 3–5 concrete plot directions I could take.",
  },
  {
    label: 'Describe Scene',
    icon: '🏞️',
    prompt:
      'Help me write a vivid, immersive scene description for where the characters are right now. Focus on sensory details — sight, sound, smell, touch.',
  },
  {
    label: 'Write Dialogue',
    icon: '💬',
    prompt:
      'Write a dialogue exchange between the characters in the current scene. Make it feel natural and reveal character personality.',
  },
  {
    label: 'Name Generator',
    icon: '📛',
    prompt:
      'Generate 10 creative fantasy names that fit the world and tone of my story. Briefly explain what makes each name work.',
  },
  {
    label: 'Expand Lore',
    icon: '📜',
    prompt:
      'Help me expand the lore of my world. Based on existing world bible entries, suggest new locations, factions, magical rules, or historical events.',
  },
  {
    label: 'Check Consistency',
    icon: '🔍',
    prompt:
      'Analyze my chapters for continuity errors: character consistency, timeline issues, geographic contradictions, unresolved plot threads, and name spelling inconsistencies. List any issues found by severity.',
  },
  {
    label: 'Deepen Character',
    icon: '🎭',
    prompt:
      'Based on the characters in my world bible and how they appear in my writing, suggest deeper character development: hidden motivations, internal conflicts, character arcs, and relationship dynamics.',
  },
];

/* ────────────── category label map ────────────── */

const CATEGORY_LABELS: Record<WorldCategory, string> = {
  characters: 'Characters',
  locations: 'Locations',
  magic: 'Magic & Spells',
  lore: 'Lore & History',
  items: 'Items & Artifacts',
  factions: 'Factions & Groups',
};

/* ═══════════════════ MAIN COMPONENT ═══════════════════ */

export function AiAssistant() {
  /* ── store ── */
  const aiMessages = useStore(s => s.aiMessages);
  const addAiMessage = useStore(s => s.addAiMessage);
  const clearAiMessages = useStore(s => s.clearAiMessages);
  const aiSettings = useStore(s => s.aiSettings);
  const updateAiSettings = useStore(s => s.updateAiSettings);
  const getActiveProject = useStore(s => s.getActiveProject);
  const getActiveChapter = useStore(s => s.getActiveChapter);
  const activeProjectId = useStore(s => s.activeProjectId);

  /* ── local state ── */
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [aiProviderName, setAiProviderName] = useState('openrouter');
  const [showAiSetup, setShowAiSetup] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevProjectIdRef = useRef<string | null>(null);

  /* ── auto-scroll ── */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  /* ── check AI status on mount & load stored key ── */
  useEffect(() => {
    const storedKey = getStoredAiKey();
    const storedProvider = getStoredAiProvider();
    setApiKey(storedKey);
    setAiProviderName(storedProvider);
    if (storedKey) {
      setAiAvailable(true);
      setAiProvider(storedProvider);
    } else {
      setAiAvailable(false);
      setShowAiSetup(true);
    }
  }, []);

  /* ── conversation memory: save/load per project ── */
  useEffect(() => {
    const pid = activeProjectId;

    // Save previous project's messages
    if (prevProjectIdRef.current && prevProjectIdRef.current !== pid) {
      const prevKey = CHAT_STORAGE_PREFIX + prevProjectIdRef.current;
      const prevMsgs = useStore.getState().aiMessages.slice(-MAX_CHAT_MESSAGES);
      if (prevMsgs.length > 0) {
        try { localStorage.setItem(prevKey, JSON.stringify(prevMsgs)); } catch { /* quota */ }
      }
    }
    prevProjectIdRef.current = pid;

    if (!pid) return;

    // Load current project's messages
    const key = CHAT_STORAGE_PREFIX + pid;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed: AiMessage[] = JSON.parse(stored);
        if (parsed.length > 0) {
          useStore.setState({ aiMessages: parsed });
          return; // don't clear
        }
      }
    } catch { /* corrupt */ }

    // No saved messages — clear only if we genuinely switched projects
    // (don't wipe if user already has messages from current session)
  }, [activeProjectId]);

  // Save messages on every change (debounced-like via RAF)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const pid = prevProjectIdRef.current;
      if (!pid) return;
      const msgs = useStore.getState().aiMessages.slice(-MAX_CHAT_MESSAGES);
      if (msgs.length > 0) {
        try { localStorage.setItem(CHAT_STORAGE_PREFIX + pid, JSON.stringify(msgs)); } catch { /* quota */ }
      } else {
        try { localStorage.removeItem(CHAT_STORAGE_PREFIX + pid); } catch { /* ok */ }
      }
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [aiMessages]);

  /* ── rich context builder ── */
  const buildContext = useCallback((): string => {
    const project = getActiveProject();
    const chapter = getActiveChapter();

    if (!project) return aiSettings.systemPrompt;

    const parts: string[] = [];

    // 1. Base system prompt
    parts.push(aiSettings.systemPrompt);

    // 2. Book info
    parts.push('\n--- BOOK INFORMATION ---');
    parts.push(`Title: ${project.name}`);
    parts.push(`Genre: ${project.genre || 'Not set'}`);
    parts.push(`Synopsis: ${project.description || 'No synopsis yet.'}`);
    parts.push(`Total words: ${project.stats?.totalWords ?? 0}`);
    parts.push(`Chapters: ${project.chapters.length}`);

    // 3. World Bible entries (organized by category, key details inline)
    if (project.worldBible.length > 0) {
      parts.push('\n--- WORLD BIBLE ---');
      const grouped: Partial<Record<WorldCategory, WorldEntry[]>> = {};
      for (const entry of project.worldBible) {
        (grouped[entry.category] ??= []).push(entry);
      }
      for (const [cat, entries] of Object.entries(grouped)) {
        parts.push(`\n[${CATEGORY_LABELS[cat as WorldCategory] ?? cat}]`);
        for (const e of entries) {
          const fields = Object.entries(e.fields)
            .filter(([, v]) => v)
            .map(([k, v]) => `  ${k}: ${v}`)
            .join('\n');
          let line = `• ${e.name}`;
          if (fields) line += `\n${fields}`;
          if (e.notes) line += `\n  notes: ${e.notes}`;
          parts.push(line);
        }
      }
    }

    // 4. Chapter list with word counts and summaries
    if (project.chapters.length > 0) {
      parts.push('\n--- CHAPTER OUTLINE ---');
      const sorted = [...project.chapters].sort((a, b) => a.order - b.order);
      for (const c of sorted) {
        const isActive = chapter && c.id === chapter.id ? ' ← CURRENT' : '';
        const summary = c.summary ? ` — ${c.summary}` : '';
        parts.push(`${c.order + 1}. "${c.title}" (${c.wordCount} words, ${c.status})${summary}${isActive}`);
      }
    }

    // 5. Current chapter's last 2000 chars
    if (chapter && chapter.content) {
      const tail = chapter.content.length > TAIL_CHARS
        ? '…' + chapter.content.slice(-TAIL_CHARS)
        : chapter.content;
      parts.push(`\n--- CURRENT CHAPTER: "${chapter.title}" (last ${TAIL_CHARS} chars) ---`);
      parts.push(tail);
    }

    // Voice Engram - inject author style profile
    try {
      const veStr = typeof localStorage !== 'undefined' ? localStorage.getItem('iw_voice_engram') : null;
      if (veStr) {
        const engram: VoiceEngram = JSON.parse(veStr);
        parts.push('\n--- AUTHOR VOICE PROFILE ---');
        parts.push(buildVoicePrompt(engram));
      }
    } catch { /* ignore */ }

    return parts.join('\n');
  }, [aiSettings, getActiveProject, getActiveChapter]);



  /* ── send message (or quick action) ── */
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setConnectionError(null);
      setInput('');

      addAiMessage({ role: 'user', content: trimmed });

      const systemContent = buildContext();
      const messages = [
        { role: 'system' as const, content: systemContent },
        ...aiMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: trimmed },
      ];

      addAiMessage({ role: 'assistant', content: '' });

      setIsStreaming(true);
      abortRef.current = new AbortController();

      try {
        if (!apiKey) {
          throw new Error('No API key configured. Click the gear icon to set up AI.');
        }

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            temperature: aiSettings.temperature,
            apiKey,
            provider: aiProviderName,
            model: aiProviderName === 'openrouter' ? 'google/gemma-3-27b-it:free'
                   : aiProviderName === 'groq' ? 'llama-3.3-70b-versatile'
                   : 'gpt-4o-mini',
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server returned ${response.status}`);
        }

        const data = await response.json();
        const content = data.content || '';

        if (content) {
          setAiAvailable(true);
          useStore.setState(s => {
            const msgs = [...s.aiMessages];
            const lastIdx = msgs.length - 1;
            if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
              msgs[lastIdx] = { ...msgs[lastIdx], content };
            }
            return { aiMessages: msgs };
          });
        } else {
          // remove empty assistant placeholder
          useStore.setState(s => ({ aiMessages: s.aiMessages.slice(0, -1) }));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message !== 'AbortError') {
          setConnectionError(message);
          // Mark AI as unavailable if it's a network/config error
          if (message.includes('fetch failed') || message.includes('not configured') || message.includes('AI API error')) {
            setAiAvailable(false);
          }
          useStore.setState(s => {
            const msgs = [...s.aiMessages];
            const lastIdx = msgs.length - 1;
            if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant' && !msgs[lastIdx].content) {
              msgs[lastIdx] = { ...msgs[lastIdx], content: `⚠️ Connection failed: ${message}` };
            }
            return { aiMessages: msgs };
          });
        } else {
          useStore.setState(s => {
            const msgs = [...s.aiMessages];
            const lastIdx = msgs.length - 1;
            if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant' && !msgs[lastIdx].content) {
              msgs[lastIdx] = { ...msgs[lastIdx], content: '⚠️ Request cancelled.' };
            }
            return { aiMessages: msgs };
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, aiMessages, addAiMessage, buildContext, aiSettings.temperature, apiKey, aiProviderName],
  );

  const handleSend = useCallback(() => sendMessage(input), [sendMessage, input]);
  const handleStop = useCallback(() => abortRef.current?.abort(), []);

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      if (isStreaming) return;
      sendMessage(action.prompt);
    },
    [isStreaming, sendMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleClearChat = useCallback(() => {
    clearAiMessages();
    // also remove from localStorage
    const pid = activeProjectId;
    if (pid) {
      try { localStorage.removeItem(CHAT_STORAGE_PREFIX + pid); } catch { /* ok */ }
    }
  }, [clearAiMessages, activeProjectId]);





  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <div className="inkweave-panel flex flex-col h-full animate-fade-in">
      {/* ─── Header ─── */}
      <div
        className="manuscript-header flex items-center justify-between"
        style={{ padding: '12px 16px 10px' }}
      >
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent-gold)' }}><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" /></svg>
          <h2
            className="text-sm font-semibold"
            style={{ color: 'var(--accent-gold)', textShadow: '0 0 12px rgba(212,173,74,0.15)' }}
          >
            AI Writing Assistant
          </h2>
          <span
            className={`text-xs px-1.5 py-0.5 rounded`}
            style={{
              background: aiAvailable === false
                ? 'rgba(160,72,72,0.12)'
                : aiAvailable === true
                  ? 'rgba(90,144,104,0.12)'
                  : 'var(--bg-tertiary)',
              color: aiAvailable === false
                ? 'var(--accent-red)'
                : aiAvailable === true
                  ? 'var(--accent-green)'
                  : 'var(--text-muted)',
              fontSize: '10px',
              fontWeight: 600,
            }}
          >
            {aiAvailable === false ? 'Offline' : aiAvailable === true ? `${aiProvider || 'Online'}` : '...'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="inkweave-btn text-xs px-2 py-1"
            onClick={() => setShowSettings(v => !v)}
            title="Toggle settings"
          >
            ⚙️
          </button>
          <button
            className="inkweave-btn text-xs px-2 py-1"
            onClick={handleClearChat}
            title="Clear chat history"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* ─── Settings Bar ─── */}
      {showSettings && (
        <div
          className="px-4 py-3 border-b space-y-3"
          style={{
            borderColor: 'rgba(212,173,74,0.12)',
            background: 'rgba(160,128,56,0.04)',
          }}
        >
          {/* Temperature & Context Mode */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label
                className="block text-xs mb-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Temperature:{' '}
                <span style={{ color: 'var(--accent-gold)' }}>
                  {aiSettings.temperature.toFixed(1)}
                </span>
              </label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={aiSettings.temperature}
                onChange={e =>
                  updateAiSettings({
                    temperature: parseFloat(e.target.value),
                  })
                }
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, var(--accent-gold) ${(aiSettings.temperature / 2) * 100}%, var(--bg-elevated) ${(aiSettings.temperature / 2) * 100}%)`,
                }}
              />
            </div>
            <div className="flex-1">
              <label
                className="block text-xs mb-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Context
              </label>
              <select
                className="inkweave-input text-xs"
                value={aiSettings.contextMode}
                onChange={e =>
                  updateAiSettings({
                    contextMode: e.target.value as AiSettings['contextMode'],
                  })
                }
              >
                <option value="chapter">Chapter</option>
                <option value="project">Full Project</option>
                <option value="world-bible">World Bible</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>

          {/* System Prompt */}
          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: 'var(--text-muted)' }}
            >
              System Prompt
            </label>
            <textarea
              className="inkweave-input text-xs resize-none"
              rows={3}
              value={aiSettings.systemPrompt}
              onChange={e => updateAiSettings({ systemPrompt: e.target.value })}
              placeholder="You are a creative writing assistant..."
            />
          </div>

          {/* AI Provider & API Key */}
          <div className="pt-2 border-t" style={{ borderColor: 'rgba(212,173,74,0.1)' }}>
            <label
              className="block text-xs mb-1 font-medium"
              style={{ color: 'var(--accent-gold)' }}
            >
              AI Provider
            </label>
            <select
              className="inkweave-input text-xs mb-2"
              value={aiProviderName}
              onChange={e => {
                const p = e.target.value;
                setAiProviderName(p);
                try { localStorage.setItem(AI_PROVIDER_STORAGE, p); } catch {}
              }}
            >
              <option value="openrouter">OpenRouter (free)</option>
              <option value="groq">Groq (free)</option>
              <option value="openai">OpenAI (paid)</option>
            </select>
            <label
              className="block text-xs mb-1"
              style={{ color: 'var(--text-muted)' }}
            >
              API Key {apiKey ? '(saved)' : ''}
            </label>
            <input
              type="password"
              className="inkweave-input text-xs"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
            />
            <div className="flex gap-2 mt-1.5">
              <button
                className="inkweave-btn text-xs px-2 py-1"
                onClick={() => {
                  try { localStorage.setItem(AI_KEY_STORAGE, apiKey); } catch {}
                  if (apiKey) {
                    setAiAvailable(true);
                    setAiProvider(aiProviderName);
                    setShowAiSetup(false);
                    setConnectionError(null);
                  }
                }}
              >
                Save Key
              </button>
              {apiKey && (
                <button
                  className="inkweave-btn text-xs px-2 py-1"
                  onClick={() => {
                    setApiKey('');
                    setAiAvailable(false);
                    try { localStorage.removeItem(AI_KEY_STORAGE); } catch {}
                  }}
                  style={{ color: 'var(--accent-red)' }}
                >
                  Remove
                </button>
              )}
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              Get free keys at{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>openrouter.ai</a>
              {' or '}<a href="https://console.groq.com/keys" target="_blank" rel="noopener" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>groq.com</a>
            </p>
          </div>
        </div>
      )}

      {/* ─── Connection Error Banner ─── */}
      {connectionError === 'not_configured' && (
        <div
          className="mx-4 mt-3 px-3 py-2 rounded-md text-xs animate-fade-in"
          style={{
            background: 'rgba(192, 57, 43, 0.15)',
            border: '1px solid var(--accent-red)',
            color: 'var(--accent-red)',
          }}
        >
          <div className="font-semibold mb-1">AI Not Configured</div>
          <div style={{ opacity: 0.85, lineHeight: 1.5 }}>
            Click the <span style={{ fontWeight: 600 }}>gear icon</span> above to add your API key.
            {' '}Free keys available at{' '}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" style={{ textDecoration: 'underline', color: 'var(--accent-gold)' }}>openrouter.ai</a>
          </div>
          <button
            className="mt-1.5 underline cursor-pointer"
            onClick={() => { setShowAiSetup(false); setConnectionError(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-red)', fontSize: 'inherit' }}
          >
            Dismiss
          </button>
        </div>
      )}
      {connectionError && connectionError !== 'not_configured' && (
        <div
          className="mx-4 mt-3 px-3 py-2 rounded-md text-xs animate-fade-in"
          style={{
            background: 'rgba(192, 57, 43, 0.15)',
            border: '1px solid var(--accent-red)',
            color: 'var(--accent-red)',
          }}
        >
          <div className="font-semibold mb-1">Connection Error</div>
          <div style={{ opacity: 0.85, lineHeight: 1.5 }}>{connectionError}</div>
          <button
            className="ml-2 underline cursor-pointer"
            onClick={() => { setConnectionError(null); setAiAvailable(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--accent-red)' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ─── Chat Messages ─── */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        style={{ maxHeight: 'calc(100vh - 420px)' }}
      >
        {/* Welcome / Empty State */}
        {aiMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span style={{ fontSize: '32px' }}>🪶</span>
            <p
              className="text-sm text-center"
              style={{ color: 'var(--text-muted)' }}
            >
              Ask the AI for help with your fantasy writing
            </p>
            {!aiAvailable && (
              <div
                className="px-4 py-3 rounded-lg text-xs text-center max-w-xs"
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  lineHeight: 1.6,
                }}
              >
                <div className="font-semibold mb-1.5" style={{ color: 'var(--accent-gold)' }}>Setup AI to get started</div>
                <div style={{ color: 'var(--text-muted)' }}>
                  Click the <strong>gear icon</strong> (⚙️) above, then paste your API key.
                </div>
                <div className="mt-1.5" style={{ color: 'var(--text-muted)', opacity: 0.8 }}>
                  Free API keys:{' '}
                  <a href="https://openrouter.ai/keys" target="_blank" rel="noopener" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>OpenRouter</a>{' · '}
                  <a href="https://console.groq.com/keys" target="_blank" rel="noopener" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>Groq</a>
                </div>
              </div>
            )}
            {aiAvailable && (
              <p
                className="text-xs text-center"
                style={{ color: 'var(--text-muted)' }}
              >
                Context: {aiSettings.contextMode} · The AI receives your book info, world bible, and current chapter automatically.
              </p>
            )}
          </div>
        )}

        {/* Messages */}
        {aiMessages.map((msg: AiMessage) => (
          <div
            key={msg.id}
            className={`animate-fade-in rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user' ? 'ml-6' : 'mr-6'
            }`}
            style={{
              background:
                msg.role === 'user' ? 'rgba(160,128,56,0.08)' : 'rgba(160,128,56,0.04)',
              border: `1px solid ${
                msg.role === 'user'
                  ? 'rgba(212,173,74,0.2)'
                  : 'rgba(212,173,74,0.12)'
              }`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span style={{ fontSize: '12px' }}>
                {msg.role === 'user' ? '👤' : '🤖'}
              </span>
              <span
                className="text-xs font-medium"
                style={{
                  color:
                    msg.role === 'user'
                      ? 'var(--text-secondary)'
                      : 'var(--accent-gold)',
                }}
              >
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </span>
            </div>
            <div
              className="break-words leading-relaxed"
              style={{ color: 'var(--text-primary)', fontSize: '13px' }}
            >
              {msg.content ? (
                msg.role === 'assistant' ? (
                  <div
                    className="whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(msg.content),
                    }}
                  />
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )
              ) : (
                <span
                  className="inline-flex items-center gap-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: 'var(--accent-gold)' }}
                  />
                  Thinking…
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* ─── Quick Actions ─── */}
      {aiMessages.length > 0 && !isStreaming && (
        <div
          className="px-4 py-3 space-y-3 overflow-x-auto"
          style={{
            borderColor: 'rgba(212,173,74,0.12)',
            background: 'rgba(26,30,28,0.9)',
            display: 'flex',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.label}
              className="inkweave-btn text-xs px-2 py-1 whitespace-nowrap"
              onClick={() => handleQuickAction(action)}
              style={{ flexShrink: 0 }}
              title={action.prompt}
            >
              {action.icon} {action.label}
            </button>
          ))}
        </div>
      )}

      {/* ─── Input Area ─── */}
      <div
        className="px-4 py-3 border-t flex gap-2 items-end"
        style={{
          borderColor: 'rgba(212,173,74,0.12)',
          background: 'rgba(26,30,28,0.95)',
        }}
      >
        <textarea
          className="inkweave-input text-sm resize-none"
          style={{ minHeight: '40px', maxHeight: '120px' }}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the AI assistant…"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button
            className="inkweave-btn inkweave-btn-primary flex items-center justify-center"
            style={{ minWidth: '40px', height: '40px', padding: 0 }}
            onClick={handleStop}
            title="Stop generating"
          >
            <span style={{ fontSize: '16px' }}>⏹</span>
          </button>
        ) : (
          <button
            className="inkweave-btn inkweave-btn-primary flex items-center justify-center"
            style={{ minWidth: '40px', height: '40px', padding: 0 }}
            onClick={handleSend}
            disabled={!input.trim()}
            title="Send message"
          >
            <span style={{ fontSize: '16px' }}>➤</span>
          </button>
        )}
      </div>
    </div>
  );
}
