'use client';

import { useStore } from '@/lib/store';
import { nameCultures, writingPrompts } from '@/lib/schemas';
import { NameCulture } from '@/lib/schemas';
import React, { useState, useCallback, useRef, useEffect } from 'react';

// ── Name Generator ──────────────────────────────────────────────────

function generateName(culture: NameCulture, nameType: NameType = 'character'): { name: string; etymology: string } {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  if (nameType === 'place' && culture.placePrefixes?.length) {
    const pre = pick(culture.placePrefixes);
    const suf = culture.placeSuffixes?.length ? pick(culture.placeSuffixes) : pick(culture.suffixes);
    const name = pre + suf;
    return { name, etymology: pre + ' + ' + suf };
  }
  if (nameType === 'artifact') {
    const adj = pick(culture.lastPrefixes);
    const noun = pick(['Blade', 'Crown', 'Staff', 'Orb', 'Ring', 'Tome', 'Shield', 'Chalice', 'Amulet', 'Scepter']);
    const name = 'The ' + adj + ' ' + noun;
    return { name, etymology: adj + ' + ' + noun };
  }
  if (nameType === 'spell') {
    const pre = pick(culture.prefixes);
    const mid = pick(culture.middles);
    const power = pick(['Strike', 'Ward', 'Veil', 'Storm', 'Binding', 'Wrath', 'Blessing', 'Curse', 'Call', 'Gate']);
    const name = pre + mid + "'s " + power;
    return { name, etymology: pre + mid + ' + ' + power };
  }
  if (nameType === 'faction') {
    const adj = pick(culture.lastPrefixes);
    const group = pick(['Order', 'Brotherhood', 'Guild', 'Legion', 'Council', 'Covenant', 'Circle', 'Watch', 'Court', 'Pact']);
    const name = 'The ' + adj + ' ' + group;
    return { name, etymology: adj + ' + ' + group };
  }

  const pre = pick(culture.prefixes);
  const mid = pick(culture.middles);
  const suf = pick(culture.suffixes);
  const lPre = pick(culture.lastPrefixes);
  const lSuf = pick(culture.lastSuffixes);
  const firstName = pre + mid + suf;
  const lastName = lPre + lSuf;
  return {
    name: firstName.charAt(0).toUpperCase() + firstName.slice(1) + ' ' + lastName.charAt(0).toUpperCase() + lastName.slice(1),
    etymology: '(' + pre + ' + ' + mid + ' + ' + suf + ') (' + lPre + ' + ' + lSuf + ')',
  };
}

interface GeneratedName {
  name: string;
  cultureId: string;
  etymology?: string;
  nameType?: string;
}

type NameType = 'character' | 'place' | 'artifact' | 'spell' | 'faction';
type Gender = 'any' | 'male' | 'female';

const NAME_TYPES: { id: NameType; label: string }[] = [
  { id: 'character', label: 'Character' },
  { id: 'place', label: 'Place' },
  { id: 'artifact', label: 'Artifact' },
  { id: 'spell', label: 'Spell' },
  { id: 'faction', label: 'Faction' },
];

const PROMPT_CATEGORIES = [
  { id: 'next_scene', label: 'Next Scene' },
  { id: 'plot_twist', label: 'Plot Twist' },
  { id: 'character_dev', label: 'Character Development' },
  { id: 'world_expansion', label: 'World Expansion' },
  { id: 'conflict', label: 'Conflict Escalation' },
  { id: 'random', label: 'Random Inspiration' },
];

function NameGeneratorTab() {
  const [selectedCulture, setSelectedCulture] = useState<string>(nameCultures[0].id);
  const [nameType, setNameType] = useState<NameType>('character');
  const [gender, setGender] = useState<Gender>('any');
  const [names, setNames] = useState<GeneratedName[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNames, setAiNames] = useState<string[]>([]);

  const project = useStore(s => {
    const pid = s.activeProjectId;
    return pid ? s.projects.find(p => p.id === pid) : undefined;
  });

  const addWorldEntry = useStore(s => s.addWorldEntry);
  const activeProjectId = useStore(s => s.activeProjectId);
  const culture = nameCultures.find(c => c.id === selectedCulture) ?? nameCultures[0];

  const handleGenerate = useCallback(() => {
    const newNames: GeneratedName[] = [];
    for (let i = 0; i < 5; i++) {
      newNames.push({
        name: generateName(culture),
        cultureId: culture.id,
      });
    }
    setNames(newNames);
    setCopiedIndex(null);
  }, [culture, nameType]);

  const handleCopy = useCallback(async (name: string, index: number) => {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = name;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    }
  }, []);

  const handleAiNames = useCallback(async () => {
    if (!project) return;
    setAiLoading(true);
    setAiNames([]);
    try {
      const aiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_key') || '') : '';
      const aiProv = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_provider') || 'openrouter') : 'openrouter';
      const aiModel = aiProv === 'openrouter' ? 'google/gemma-3-27b-it:free' : aiProv === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

      const prompt = `Generate 5 unique fantasy character names that fit this world: Genre "${project.genre || 'fantasy'}", Description: "${project.description || 'a fantasy world'}".
The world has these characters: ${(project.worldBible || []).filter(e => e.category === 'characters').map(e => e.name).join(', ') || 'none yet'}.
Return ONLY a JSON array of 5 name strings, nothing else. Example: ["Name One", "Name Two", ...]`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          systemPrompt: 'You are a fantasy naming expert. Generate names that fit the genre and world described. Return only a JSON array of strings.',
          temperature: 0.8,
          apiKey: aiKey,
          provider: aiProv,
          model: aiModel,
        }),
      });

      const data = await res.json();
      if (data.content) {
        const cleaned = data.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        try {
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed)) {
            setAiNames(parsed.slice(0, 5));
          }
        } catch {
          // Try to extract names from text
          const lines: string[] = cleaned.split('\n').filter((l: string) => l.trim());
          const extracted: string[] = lines.slice(0, 5).map((l: string) => l.replace(/^[\d\-\.\*]+\s*/, '').replace(/["']/g, '').trim()).filter(Boolean);
          if (extracted.length > 0) setAiNames(extracted);
        }
      }
    } catch {
      // AI failed silently
    } finally {
      setAiLoading(false);
    }
  }, [project]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Culture selector */}
      <div>
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: 6,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}
        >
          Culture
        </label>
        <select
          className="inkweave-input"
          value={selectedCulture}
          onChange={e => setSelectedCulture(e.target.value)}
          style={{ cursor: 'pointer' }}
        >
          {nameCultures.map(c => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      
      {/* Name Type */}
      <select
        value={nameType}
        onChange={(e) => setNameType(e.target.value as NameType)}
        className="inkweave-input"
        style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6 }}
      >
        {NAME_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>

      {/* Culture Description */}
      {culture.description && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', margin: '4px 0 0' }}>
          {culture.description}
        </p>
      )}
      </div>

      {/* Generate buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="inkweave-btn inkweave-btn-primary" onClick={handleGenerate} style={{ flex: 1 }}>
          ✨ Generate 5 Names
        </button>
        {project && (
          <button
            className="inkweave-btn"
            onClick={handleAiNames}
            disabled={aiLoading}
            style={{
              flex: 1,
              opacity: aiLoading ? 0.5 : 1,
              cursor: aiLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {aiLoading ? (
              <>
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', border: '2px solid var(--accent-gold)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', marginRight: 4 }} />
                Generating...
              </>
            ) : (
              '🔮 AI Name Suggestion'
            )}
          </button>
        )}
      </div>

      {/* AI Names */}
      {aiNames.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--accent-gold)',
              letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}
          >
            AI-Generated Names
          </label>
          {aiNames.map((name, i) => (
            <div
              key={`ai-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'linear-gradient(135deg, rgba(160,128,56,0.1), rgba(26,30,28,0.95))',
                border: '1px solid rgba(212,173,74,0.25)',
                borderRadius: 6,
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontFamily: "'Georgia', serif",
                  color: 'var(--text-primary)',
                }}
              >
                🔮 {name}
              </span>
              <button
                className="inkweave-btn"
                onClick={() => handleCopy(name, i + 100)}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  background: copiedIndex === i + 100 ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                  border: copiedIndex === i + 100
                    ? '1px solid var(--accent-green)'
                    : '1px solid var(--border-color)',
                  color: copiedIndex === i + 100 ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {copiedIndex === i + 100 ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {names.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {names.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'linear-gradient(135deg, rgba(160,128,56,0.06), rgba(26,30,28,0.95))',
                border: '1px solid rgba(212,173,74,0.15)',
                borderRadius: 6,
                transition: 'border-color 0.2s',
              }}
            >
              <span
                style={{
                  fontSize: 15,
                  fontFamily: "'Georgia', serif",
                  color: 'var(--text-primary)',
                }}
              >
                {item.name}
              </span>
              <button
                className="inkweave-btn"
                onClick={() => handleCopy(item.name, i)}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  background: copiedIndex === i ? 'var(--accent-green)' : 'var(--bg-tertiary)',
                  border: copiedIndex === i
                    ? '1px solid var(--accent-green)'
                    : '1px solid var(--border-color)',
                  color: copiedIndex === i ? '#fff' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                {copiedIndex === i ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      )}

      {names.length === 0 && aiNames.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: 'var(--text-muted)',
            fontSize: 13,
            fontStyle: 'italic',
          }}
        >
          Select a culture and click Generate to create fantasy names.
        </div>
      )}
    </div>
  );
}

// ── Writing Prompts ─────────────────────────────────────────────────

function WritingPromptsTab() {
  const [category, setCategory] = useState<string>('next_scene');
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const project = useStore(s => {
    const pid = s.activeProjectId;
    return pid ? s.projects.find(p => p.id === pid) : undefined;
  });

  const handleGeneratePrompts = useCallback(async () => {
    setLoading(true);
    try {
      const aiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_key') || '') : '';
      const aiProv = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_provider') || 'groq') : 'groq';
      
      if (!aiKey) {
        // Fallback to static prompts
        const shuffled = [...writingPrompts].sort(() => Math.random() - 0.5);
        setPrompts(shuffled.slice(0, 5));
        return;
      }

      const lastChapter = project?.chapters?.[project.chapters.length - 1];
      const chapterContext = lastChapter ? lastChapter.content.replace(/<[^>]+>/g, '').slice(0, 1000) : '';
      const characters = project?.worldBible?.filter(w => w.category === 'characters').map(c => c.name).slice(0, 10).join(', ') || '';
      const catLabel = PROMPT_CATEGORIES.find(c => c.id === category)?.label || 'Random';

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a creative writing coach. Generate exactly 5 unique, specific, actionable writing prompts. Each should be 1-2 sentences. Return ONLY the 5 prompts, one per line, numbered 1-5. No other text.' },
            { role: 'user', content: 'Genre: ' + (project?.genre || 'Fantasy') + '\nSynopsis: ' + (project?.description || 'A fantasy novel') + '\nCharacters: ' + (characters || 'None yet') + '\nLast chapter context: ' + (chapterContext || 'No chapters yet') + '\nCategory: ' + catLabel + '\n\nGenerate 5 ' + catLabel.toLowerCase() + ' prompts for this story:' }
          ],
          temperature: 0.9,
          apiKey: aiKey,
          provider: aiProv,
          model: aiProv === 'groq' ? 'llama-3.3-70b-versatile' : 'google/gemma-3-27b-it:free',
        }),
      });
      const data = await res.json();
      if (data.content) {
        const lines = data.content.split('\n').filter((l: string) => l.trim().length > 10).map((l: string) => l.replace(/^\d+[.)\s]+/, '').trim()).slice(0, 5);
        setPrompts(lines.length > 0 ? lines : ['AI returned empty response. Try again.']);
      } else {
        setPrompts(['Error: ' + (data.error || 'Unknown error')]);
      }
    } catch {
      const shuffled = [...writingPrompts].sort(() => Math.random() - 0.5);
      setPrompts(shuffled.slice(0, 5));
    } finally {
      setLoading(false);
    }
  }, [project, category]);

  const handleCopy = (idx: number) => {
    navigator.clipboard.writeText(prompts[idx]);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Category + Generate */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="inkweave-input"
          style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, flex: 1, minWidth: 140 }}
        >
          {PROMPT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button
          className="inkweave-btn inkweave-btn-primary"
          onClick={handleGeneratePrompts}
          disabled={loading}
          style={{ padding: '6px 14px', fontSize: 12 }}
        >
          {loading ? 'Generating...' : 'Generate Prompts'}
        </button>
      </div>

      {/* Prompts list */}
      {prompts.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {prompts.map((prompt, i) => (
            <div
              key={i}
              style={{
                padding: '12px 14px',
                background: 'linear-gradient(135deg, rgba(160,128,56,0.06), rgba(26,30,28,0.95))',
                border: '1px solid rgba(212,173,74,0.15)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <p style={{ flex: 1, margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
                {prompt}
              </p>
              <button
                className="inkweave-btn"
                style={{ padding: '3px 8px', fontSize: 10, whiteSpace: 'nowrap' }}
                onClick={() => handleCopy(i)}
              >
                {copiedIdx === i ? 'Copied!' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
          <p>Select a category and click Generate to get AI-powered writing prompts tailored to your story.</p>
          <p style={{ fontSize: 11, marginTop: 8 }}>Prompts will consider your genre, characters, and current plot.</p>
        </div>
      )}
    </div>
  );
}

export default function GeneratorsView() {
  const [activeTab, setActiveTab] = useState<TabId>('names');

  return (
    <div className="animate-fade-in" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--accent-gold)',
            margin: 0,
            textShadow: '0 0 16px rgba(212,173,74,0.15)',
          }}
        >
          Generators
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
          Tools to fuel your creativity
        </p>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(212,173,74,0.12)',
          marginBottom: 20,
          gap: 0,
        }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            className="tab-btn"
            onClick={() => setActiveTab(tab.id)}
            style={{
              color: activeTab === tab.id ? 'var(--accent-gold)' : undefined,
              borderBottom: activeTab === tab.id
                ? '2px solid var(--accent-gold)'
                : '2px solid transparent',
            }}
          >
            <span style={{ marginRight: 6 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'names' && <NameGeneratorTab />}
        {activeTab === 'prompts' && <WritingPromptsTab />}
      </div>
    </div>
  );
}
