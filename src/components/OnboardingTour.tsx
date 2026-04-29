'use client';

import { useState, useCallback } from 'react';

/* ── Tour step definition ── */
interface TourStep {
  title: string;
  description: string;
  emoji: string;
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to Inkweave',
    description:
      'Your fantasy writing studio with world-building tools, AI assistance, and everything you need to craft epic tales. Let us show you around!',
    emoji: '📖',
  },
  {
    title: 'Your Manuscript',
    description:
      'Write your chapters in the rich text editor. Use the toolbar for bold, italic, headings, and more formatting options.',
    emoji: '✍️',
  },
  {
    title: 'Your Codex — The Sidebar',
    description:
      'Manage chapters, world bible entries, notes, and get AI writing assistance all from the sidebar panel toggles.',
    emoji: '📚',
  },
  {
    title: 'World Map',
    description:
      'Build your fantasy world visually. Place pins for cities, dungeons, forests, and landmarks on a custom map canvas.',
    emoji: '🗺️',
  },
  {
    title: 'Family Tree',
    description:
      'Map character relationships and lineages. Track who\'s related to whom and keep your cast of characters organized.',
    emoji: '🌳',
  },
  {
    title: 'Scenes & Beats',
    description:
      'Analyze your chapter structure or get AI-powered writing directions. Break your story into scenes and track pacing.',
    emoji: '🎬',
  },
  {
    title: 'Export Your Work',
    description:
      'Download your manuscript as TXT, HTML, DOCX, PDF, or JSON anytime. Your words are always yours.',
    emoji: '📤',
  },
  {
    title: 'Writing Modes',
    description:
      'Switch between Light, Dark, Sepia, and Typewriter themes for the perfect writing atmosphere. Find your creative zone!',
    emoji: '🎨',
  },
  {
    title: 'You\'re All Set!',
    description:
      'Happy writing! Remember, you can always restart this tour from the "?" button in the header. Now go weave your legend.',
    emoji: '✨',
  },
];

const TOTAL = STEPS.length;

/* ── Props ── */
interface OnboardingTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

/* ════════════════════════════════════════════════════
   OnboardingTour Component
   ════════════════════════════════════════════════════ */
export default function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [animDirection, setAnimDirection] = useState<'forward' | 'backward'>('forward');

  const isLast = step === TOTAL - 1;
  const current = STEPS[step];

  const goNext = useCallback(() => {
    if (isLast) {
      if (dontShowAgain) {
        try { localStorage.setItem('inkweave-onboarding-done', 'true'); } catch { /* noop */ }
      }
      onComplete();
    } else {
      setAnimDirection('forward');
      setStep((s) => s + 1);
    }
  }, [isLast, dontShowAgain, onComplete]);

  const goPrev = useCallback(() => {
    if (step > 0) {
      setAnimDirection('backward');
      setStep((s) => s - 1);
    }
  }, [step]);

  const skip = useCallback(() => {
    onSkip();
  }, [onSkip]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) skip();
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          maxWidth: 340,
          width: 'calc(100% - 32px)',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-light)',
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(212,173,74,0.06)',
          padding: '28px 24px 24px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle top accent bar */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent, #d4ad4a, #f0c850, #d4ad4a, transparent)',
          }}
        />

        {/* Step counter */}
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            letterSpacing: 1,
            marginBottom: 12,
            fontFamily: "'Georgia', serif",
          }}
        >
          {step + 1} of {TOTAL}
        </div>

        {/* Emoji */}
        <div style={{ fontSize: 36, marginBottom: 12 }}>{current.emoji}</div>

        {/* Title */}
        <h3
          style={{
            fontFamily: "'Georgia', serif",
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--accent-gold)',
            margin: '0 0 10px 0',
            lineHeight: 1.3,
          }}
        >
          {current.title}
        </h3>

        {/* Description */}
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.65,
            color: 'var(--text-secondary)',
            margin: '0 0 20px 0',
          }}
        >
          {current.description}
        </p>

        {/* "Don't show again" — only on last step */}
        {isLast && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--text-muted)',
              marginBottom: 16,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{
                width: 15,
                height: 15,
                accentColor: '#d4ad4a',
                cursor: 'pointer',
              }}
            />
            Don&apos;t show this tour again
          </label>
        )}

        {/* Dots progress indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginBottom: 20,
          }}
        >
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                borderRadius: 3,
                background: i === step ? 'var(--accent-gold)' : 'var(--border-light)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {step > 0 && (
            <button
              onClick={goPrev}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: "'Georgia', serif",
                letterSpacing: 0.3,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)';
              }}
            >
              Previous
            </button>
          )}

          <button
            onClick={goNext}
            style={{
              flex: step > 0 ? 1 : undefined,
              padding: '8px 16px',
              borderRadius: 8,
              background: 'linear-gradient(135deg, #a08038 0%, #d4ad4a 50%, #f0c850 100%)',
              border: '1px solid rgba(240,200,80,0.3)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "'Georgia', serif",
              letterSpacing: 0.3,
              boxShadow: '0 2px 8px rgba(212,173,74,0.2)',
              transition: 'box-shadow 0.2s, transform 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(212,173,74,0.35)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(212,173,74,0.2)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            {isLast ? 'Start Writing' : 'Next'}
          </button>

          {!isLast && (
            <button
              onClick={skip}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: "'Georgia', serif",
                letterSpacing: 0.3,
                padding: '8px 4px',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              }}
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
