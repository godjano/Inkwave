'use client';

import { useState, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { buildVoicePrompt, VoiceEngram } from '@/lib/voice-engram';

interface Scene {
  title: string;
  beat: string;
  purpose: string;
  estimated_words: number;
  elements: string[];
}

interface Outline {
  scenes: Scene[];
  opening_hook: string;
  closing_hook: string;
  pacing_notes: string;
}

const BEAT_COLORS: Record<string, string> = {
  hook: '#f59e0b',
  rising_action: '#3b82f6',
  climax: '#ef4444',
  falling_action: '#8b5cf6',
  transition: '#6b7280',
  revelation: '#ec4899',
  dialogue: '#10b981',
  introspection: '#6366f1',
};

interface Props {
  onClose: () => void;
  onInsert: (html: string) => void;
}

export default function ChapterArchitect({ onClose, onInsert }: Props) {
  const [brief, setBrief] = useState('');
  const [outline, setOutline] = useState<Outline | null>(null);
  const [draftText, setDraftText] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<'brief' | 'outline' | 'drafting' | 'review'>('brief');
  const [error, setError] = useState('');

  const getActiveProject = useStore(s => s.getActiveProject);
  const project = getActiveProject();

  const getAiConfig = useCallback(() => {
    const apiKey = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_key') || '') : '';
    const provider = typeof localStorage !== 'undefined' ? (localStorage.getItem('iw_ai_provider') || 'groq') : 'groq';
    const model = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'google/gemma-3-27b-it:free';
    let voicePrompt = '';
    try {
      const ve = typeof localStorage !== 'undefined' ? localStorage.getItem('iw_voice_engram') : null;
      if (ve) { const engram: VoiceEngram = JSON.parse(ve); voicePrompt = buildVoicePrompt(engram); }
    } catch {}
    return { apiKey, provider, model, voicePrompt };
  }, []);

  const handleGenerateOutline = useCallback(async () => {
    if (!brief.trim() || !project) return;
    setLoading(true);
    setError('');
    try {
      const { apiKey, provider, model, voicePrompt } = getAiConfig();
      const res = await fetch('/api/ai/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'outline',
          brief,
          previousChapters: project.chapters.filter(c => c.content?.trim()).map(c => ({ title: c.title, content: c.content })),
          worldBible: project.worldBible,
          voicePrompt,
          genre: project.genre,
          synopsis: project.description,
          apiKey, provider, model,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      if (data.outline) { setOutline(data.outline); setStage('outline'); }
      else { setError('Could not parse outline. Please try again.'); }
    } catch (e) {
      setError('Failed to reach AI. Check your API key.');
    } finally { setLoading(false); }
  }, [brief, project, getAiConfig]);

  const handleDraftChapter = useCallback(async () => {
    if (!outline || !project) return;
    setLoading(true);
    setStage('drafting');
    setError('');
    try {
      const { apiKey, provider, model, voicePrompt } = getAiConfig();
      const res = await fetch('/api/ai/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'draft',
          brief,
          outline,
          previousChapters: project.chapters.filter(c => c.content?.trim()).map(c => ({ title: c.title, content: c.content })),
          worldBible: project.worldBible,
          voicePrompt,
          genre: project.genre,
          synopsis: project.description,
          apiKey, provider, model,
        }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setStage('outline'); return; }
      if (data.chapter) { setDraftText(data.chapter); setStage('review'); }
      else { setError('No chapter generated. Try again.'); setStage('outline'); }
    } catch (e) {
      setError('Failed to generate chapter. Check your API key.');
      setStage('outline');
    } finally { setLoading(false); }
  }, [outline, brief, project, getAiConfig]);

  const handleInsert = useCallback(() => {
    const html = draftText.split('\n').map(p => p.trim() ? '<p>' + p + '</p>' : '').filter(Boolean).join('');
    onInsert(html);
    onClose();
  }, [draftText, onInsert, onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: 720, maxHeight: '85vh', overflow: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--accent-gold)', fontFamily: 'Cinzel, serif' }}>
            {String.fromCodePoint(0x1F3D7, 0xFE0F)} Chapter Architect
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>{'\u2715'}</button>
        </div>

        {/* Brief Input */}
        {(stage === 'brief' || stage === 'outline') && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: 0.5 }}>
              What happens in this chapter?
            </label>
            <textarea
              value={brief}
              onChange={e => setBrief(e.target.value)}
              placeholder="Describe the key events in 2-3 sentences... e.g. 'Rand arrives at the village market and notices something is wrong. People are afraid. He encounters a mysterious woman who seems to know his name.'"
              style={{ width: '100%', minHeight: 80, padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'Georgia, serif', resize: 'vertical' }}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{brief.length} chars</div>
          </div>
        )}

        {/* Generate Outline Button */}
        {stage === 'brief' && (
          <button
            onClick={handleGenerateOutline}
            disabled={loading || brief.trim().length < 10}
            style={{ width: '100%', padding: '12px 20px', borderRadius: 8, border: 'none', background: brief.trim().length >= 10 ? 'linear-gradient(135deg, var(--accent-gold), #d4a030)' : 'var(--bg-secondary)', color: brief.trim().length >= 10 ? '#1a1a1a' : 'var(--text-muted)', fontSize: 14, fontWeight: 600, cursor: brief.trim().length >= 10 ? 'pointer' : 'default' }}
          >
            {loading ? '\u2728 Designing scenes...' : '\u2728 Generate Scene Outline'}
          </button>
        )}

        {/* Outline Preview */}
        {stage === 'outline' && outline && (
          <div>
            {outline.pacing_notes && (
              <div style={{ padding: 10, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 12, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {String.fromCodePoint(0x1F3AF)} {outline.pacing_notes}
              </div>
            )}
            
            {outline.opening_hook && (
              <div style={{ padding: 8, marginBottom: 8, borderLeft: '3px solid var(--accent-gold)', paddingLeft: 12, fontSize: 13, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                Opening: {'“'}{outline.opening_hook}{'”'}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {outline.scenes.map((scene, i) => (
                <div key={i} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: BEAT_COLORS[scene.beat] || '#6b7280', color: '#fff' }}>
                      {scene.beat.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{scene.title}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>~{scene.estimated_words}w</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{scene.purpose}</div>
                  {scene.elements?.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {scene.elements.map((el, j) => (
                        <span key={j} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(212,173,74,0.1)', color: 'var(--accent-gold)' }}>{el}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {outline.closing_hook && (
              <div style={{ padding: 8, marginBottom: 12, borderLeft: '3px solid #ef4444', paddingLeft: 12, fontSize: 13, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                Closing: {'“'}{outline.closing_hook}{'”'}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setOutline(null); setStage('brief'); }} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                {'←'} Revise Brief
              </button>
              <button onClick={handleDraftChapter} disabled={loading} style={{ flex: 2, padding: '10px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, var(--accent-gold), #d4a030)', color: '#1a1a1a', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                {loading ? '{'{"✍"}\ufe0f'} Writing chapter...' : '{'{"✍"}\ufe0f'} Draft Full Chapter'}
              </button>
            </div>
          </div>
        )}

        {/* Drafting State */}
        {stage === 'drafting' && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{'{"✍"}\ufe0f'}</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Writing your chapter...</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>This may take 20-30 seconds for a full chapter</div>
          </div>
        )}

        {/* Review Draft */}
        {stage === 'review' && draftText && (
          <div>
            <div style={{ maxHeight: 400, overflow: 'auto', padding: 16, background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 16, fontFamily: 'Georgia, serif', fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
              {draftText}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              {draftText.split(/\s+/).length} words generated
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setStage('outline')} style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                {'←'} Back to Outline
              </button>
              <button onClick={handleInsert} style={{ flex: 2, padding: '10px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                {'✅'} Insert into Editor
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginTop: 12, padding: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 12, color: '#f87171' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
