'use client';

import { useStore } from '@/lib/store';
import { nameCultures, writingPrompts } from '@/lib/schemas';
import { NameCulture } from '@/lib/schemas';
import React, { useState, useCallback, useRef, useEffect } from 'react';

// ── Name Generator ──────────────────────────────────────────────────

function generateName(culture: NameCulture): string {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  const firstName = pick(culture.prefixes) + pick(culture.middles) + pick(culture.suffixes);
  const lastName = pick(culture.lastPrefixes) + pick(culture.lastSuffixes);

  return `${firstName.charAt(0).toUpperCase()}${firstName.slice(1)} ${lastName.charAt(0).toUpperCase()}${lastName.slice(1)}`;
}

interface GeneratedName {
  name: string;
  cultureId: string;
}

function NameGeneratorTab() {
  const [selectedCulture, setSelectedCulture] = useState<string>(nameCultures[0].id);
  const [names, setNames] = useState<GeneratedName[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

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
  }, [culture]);

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
      </div>

      {/* Generate button */}
      <button className="inkweave-btn inkweave-btn-primary" onClick={handleGenerate} style={{ width: '100%' }}>
        ✨ Generate 5 Names
      </button>

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

      {names.length === 0 && (
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
  const [currentPrompt, setCurrentPrompt] = useState<string>('');
  const [saved, setSaved] = useState(false);

  const project = useStore(s => {
    const pid = s.activeProjectId;
    return pid ? s.projects.find(p => p.id === pid) : undefined;
  });
  const addNote = useStore(s => s.addNote);

  const pickRandom = useCallback(() => {
    const idx = Math.floor(Math.random() * writingPrompts.length);
    setCurrentPrompt(writingPrompts[idx]);
    setSaved(false);
  }, []);

  // Auto-pick on first render
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      pickRandom();
    }
  }, [pickRandom]);

  const handleSaveToNotes = useCallback(() => {
    if (!project || !currentPrompt) return;
    addNote(project.id, `Prompt: ${currentPrompt.slice(0, 40)}...`);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [project, currentPrompt, addNote]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Prompt card */}
      <div
        style={{
          padding: 24,
          background: 'linear-gradient(135deg, rgba(160,128,56,0.06), rgba(26,30,28,0.95))',
          border: '1px solid rgba(212,173,74,0.15)',
          borderRadius: 8,
          minHeight: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: 'var(--text-primary)',
            textAlign: 'center',
            fontFamily: "'Georgia', serif",
            fontStyle: 'italic',
            margin: 0,
          }}
        >
          &ldquo;{currentPrompt}&rdquo;
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="inkweave-btn inkweave-btn-primary"
          onClick={pickRandom}
          style={{ flex: 1 }}
        >
          🎲 New Prompt
        </button>
        <button
          className="inkweave-btn"
          onClick={handleSaveToNotes}
          disabled={saved || !project}
          style={{
            flex: 1,
            opacity: saved ? 1 : !project ? 0.4 : 1,
            background: saved ? 'var(--accent-green)' : undefined,
            border: saved ? '1px solid var(--accent-green)' : undefined,
            color: saved ? '#fff' : undefined,
            cursor: saved ? 'default' : !project ? 'not-allowed' : 'pointer',
          }}
        >
          {saved ? '✓ Saved to Notes' : project ? '📌 Save to Notes' : 'No Project'}
        </button>
      </div>

      {/* Prompt count */}
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
        {writingPrompts.length} prompts available
      </p>
    </div>
  );
}

// ── Dice Roller ─────────────────────────────────────────────────────

interface DiceResult {
  dice: number[];
  total: number;
}

function DiceRollerTab() {
  const [results, setResults] = useState<DiceResult | null>(null);
  const [animating, setAnimating] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animRef.current) clearTimeout(animRef.current);
    };
  }, []);

  const rollDice = useCallback((count: number, sides: number) => {
    const finalDice: number[] = [];
    for (let i = 0; i < count; i++) {
      finalDice.push(Math.floor(Math.random() * sides) + 1);
    }
    const finalResult: DiceResult = { dice: finalDice, total: finalDice.reduce((a, b) => a + b, 0) };
    // Start animation
    setAnimating(true);
    const duration = 600;
    const steps = 8;
    let step = 0;

    const animate = () => {
      step++;
      if (step < steps) {
        // Show random intermediate values
        const tempDice: number[] = [];
        for (let i = 0; i < count; i++) {
          tempDice.push(Math.floor(Math.random() * sides) + 1);
        }
        setResults({ dice: tempDice, total: tempDice.reduce((a, b) => a + b, 0) });
        animRef.current = setTimeout(animate, duration / steps);
      } else {
        // Settle on final result
        setResults(finalResult);
        setAnimating(false);
      }
    };

    animate();
  }, []);

  const handleQuickRoll = useCallback(
    (sides: number) => {
      rollDice(1, sides);
    },
    [rollDice]
  );

  const handleCustomRoll = useCallback(() => {
    const match = customInput.trim().match(/^(\d+)d(\d+)$/i);
    if (!match) return;
    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    if (count < 1 || count > 100 || sides < 2 || sides > 1000) return;
    rollDice(count, sides);
  }, [customInput, rollDice]);

  const diceButtons = [
    { label: 'd4', sides: 4 },
    { label: 'd6', sides: 6 },
    { label: 'd8', sides: 8 },
    { label: 'd10', sides: 10 },
    { label: 'd12', sides: 12 },
    { label: 'd20', sides: 20 },
    { label: 'd100', sides: 100 },
  ];

  const isCustomValid = /^\d+d\d+$/i.test(customInput.trim());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Quick dice */}
      <div>
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: 8,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}
        >
          Quick Roll
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {diceButtons.map(d => (
            <button
              key={d.label}
              className="inkweave-btn"
              onClick={() => handleQuickRoll(d.sides)}
              disabled={animating}
              style={{
                minWidth: 52,
                textAlign: 'center',
                fontWeight: 700,
                fontSize: 14,
                color: 'var(--accent-gold)',
                opacity: animating ? 0.5 : 1,
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom roll */}
      <div>
        <label
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-muted)',
            display: 'block',
            marginBottom: 8,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
          }}
        >
          Custom Roll
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="inkweave-input"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            placeholder="e.g. 2d6, 4d8"
            style={{ flex: 1, fontFamily: 'monospace', fontSize: 15 }}
            onKeyDown={e => {
              if (e.key === 'Enter') handleCustomRoll();
            }}
          />
          <button
            className="inkweave-btn inkweave-btn-primary"
            onClick={handleCustomRoll}
            disabled={!isCustomValid || animating}
            style={{
              opacity: isCustomValid && !animating ? 1 : 0.4,
              cursor: isCustomValid && !animating ? 'pointer' : 'not-allowed',
              whiteSpace: 'nowrap',
            }}
          >
            Roll 🎲
          </button>
        </div>
      </div>

      {/* Results */}
      {results && (
        <div
          className="animate-fade-in"
          style={{
            padding: 20,
            background: 'linear-gradient(135deg, rgba(160,128,56,0.06), rgba(26,30,28,0.95))',
            border: '1px solid rgba(212,173,74,0.15)',
            borderRadius: 8,
            textAlign: 'center',
          }}
        >
          {/* Total */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 800,
              color: animating ? 'var(--text-muted)' : 'var(--accent-gold)',
              lineHeight: 1,
              marginBottom: 8,
              transition: 'color 0.3s',
              textShadow: animating ? 'none' : '0 0 20px rgba(212,168,83,0.3)',
            }}
          >
            {results.total}
          </div>

          {/* Individual dice */}
          {results.dice.length > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {results.dice.map((die, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 6,
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-light)',
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {die}
                </span>
              ))}
              <span style={{ color: 'var(--text-muted)', fontSize: 13, alignSelf: 'center', marginLeft: 4 }}>
                = {results.total}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main GeneratorsView ─────────────────────────────────────────────

type TabId = 'names' | 'prompts' | 'dice';

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'names', label: 'Name Generator', icon: '✨' },
  { id: 'prompts', label: 'Writing Prompts', icon: '🎲' },
  { id: 'dice', label: 'Dice Roller', icon: '🎲' },
];

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
        {activeTab === 'dice' && <DiceRollerTab />}
      </div>
    </div>
  );
}
