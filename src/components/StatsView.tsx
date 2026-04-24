'use client';

import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { achievements } from '@/lib/schemas';

export function StatsView() {
  const project = useStore(s => s.getActiveProject());

  const stats = useMemo(() => {
    if (!project) return null;
    return project.stats;
  }, [project]);

  const last14Days = useMemo(() => {
    if (!stats) return [];
    const days: { date: string; label: string; words: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const session = stats.sessions.find(s => s.date === ds);
      const dayName = d.toLocaleDateString('en', { weekday: 'short' });
      const dayNum = d.getDate();
      days.push({
        date: ds,
        label: `${dayName} ${dayNum}`,
        words: session?.words || 0,
      });
    }
    return days;
  }, [stats]);

  const heatmapData = useMemo(() => {
    if (!stats) return { grid: [], maxWords: 0 };
    // 5 weeks × 7 days grid
    const grid: { date: string; words: number; dayOfWeek: number }[][] = [];
    const today = new Date();
    // Start from 35 days ago, aligned to the previous Sunday
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 34);
    // Align to Sunday (day 0)
    const dayOffset = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOffset);

    let maxWords = 0;
    for (let week = 0; week < 5; week++) {
      const weekData: { date: string; words: number; dayOfWeek: number }[] = [];
      for (let day = 0; day < 7; day++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + week * 7 + day);
        const ds = d.toISOString().split('T')[0];
        const session = stats.sessions.find(s => s.date === ds);
        const words = session?.words || 0;
        if (words > maxWords) maxWords = words;
        weekData.push({ date: ds, words, dayOfWeek: day });
      }
      grid.push(weekData);
    }
    return { grid, maxWords };
  }, [stats]);

  const vocabularyData = useMemo(() => {
    if (!project) return [];
    // Strip HTML tags before analyzing vocabulary
    const allText = project.chapters
      .map(c => (c.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' '))
      .join(' ');
    if (!allText.trim()) return [];

    const words = allText.toLowerCase().replace(/[^a-z'\s]/g, '').split(/\s+/).filter(w => w.length > 3);
    const freq: Record<string, number> = {};
    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1;
    }

    // Common English stop words to exclude
    const stopWords = new Set([
      'that', 'this', 'with', 'from', 'have', 'they', 'been', 'will', 'would',
      'there', 'their', 'what', 'about', 'which', 'when', 'were', 'them', 'some',
      'than', 'into', 'could', 'other', 'more', 'very', 'just', 'like', 'also',
      'then', 'over', 'only', 'even', 'back', 'after', 'where', 'much', 'does',
      'still', 'through', 'before', 'between', 'such', 'these', 'being', 'each',
      'should', 'because', 'while', 'going', 'think', 'said', 'were', 'thing',
    ]);

    const sorted = Object.entries(freq)
      .filter(([word]) => !stopWords.has(word))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20);

    return sorted;
  }, [project]);

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 animate-fade-in" style={{ color: 'var(--text-muted)' }}>
        <span style={{ fontSize: '48px' }}>📊</span>
        <p>No project selected</p>
      </div>
    );
  }

  // Calculate real total from actual content (strips HTML, more reliable than stored wordCount)
  const actualTotalWords = project ? project.chapters.reduce((sum, c) => {
    const plain = (c.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    return sum + plain.split(/\s+/).filter(Boolean).length;
  }, 0) : 0;
  const totalSessions = stats.sessions.length;
  const dailyAverage = totalSessions > 0 ? Math.round(Math.max(actualTotalWords, stats.totalWords) / totalSessions) : 0;
  const displayTotal = Math.max(actualTotalWords, stats.totalWords);

  // Heatmap color scale (green)
  const getHeatColor = (words: number, max: number) => {
    if (max === 0) return 'var(--bg-elevated)';
    const intensity = words / max;
    if (intensity === 0) return 'var(--bg-elevated)';
    if (intensity <= 0.25) return '#0e4429';
    if (intensity <= 0.5) return '#006d32';
    if (intensity <= 0.75) return '#26a641';
    return '#39d353';
  };

  // Bar chart color intensity (gold)
  const getBarColor = (words: number, max: number) => {
    if (max === 0 || words === 0) return 'var(--bg-elevated)';
    const intensity = words / max;
    if (intensity <= 0.25) return 'var(--accent-gold-dim)';
    if (intensity <= 0.5) return 'var(--accent-gold-dim)';
    if (intensity <= 0.75) return 'var(--accent-gold)';
    return 'var(--accent-gold)';
  };

  const maxBarWords = Math.max(...last14Days.map(d => d.words), 1);

  const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', ''];

  return (
    <div className="p-6 space-y-6 animate-fade-in overflow-y-auto" style={{ maxHeight: '100vh' }}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <span style={{ fontSize: '24px' }}>📊</span>
        <h1 className="text-xl font-bold" style={{ color: 'var(--accent-gold)' }}>Writing Statistics</h1>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          label="Total Words"
          value={displayTotal.toLocaleString()}
          icon="📝"
        />
        <StatCard
          label="Total Sessions"
          value={totalSessions.toString()}
          icon="⏱️"
        />
        <StatCard
          label="Current Streak"
          value={stats.currentStreak.toString()}
          icon="🔥"
          highlight
        />
        <StatCard
          label="Longest Streak"
          value={stats.longestStreak.toString()}
          icon="🏆"
        />
        <StatCard
          label="Daily Average"
          value={dailyAverage.toLocaleString()}
          icon="📈"
        />
      </div>

      {/* Word Count Chart - Last 14 Days */}
      <div className="inkweave-card">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          📊 Word Count — Last 14 Days
        </h3>
        <div className="flex items-end gap-1.5" style={{ height: '140px' }}>
          {last14Days.map(day => {
            const height = maxBarWords > 0 ? Math.max((day.words / maxBarWords) * 120, day.words > 0 ? 4 : 2) : 2;
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                  {day.words > 0 ? day.words.toLocaleString() : ''}
                </span>
                <div
                  className="w-full rounded-t transition-all duration-300"
                  style={{
                    height: `${height}px`,
                    background: getBarColor(day.words, maxBarWords),
                    minHeight: '2px',
                  }}
                  title={`${day.label}: ${day.words} words`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex gap-1.5 mt-2">
          {last14Days.map(day => (
            <div key={day.date} className="flex-1 text-center">
              <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>
                {day.label.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Writing Heatmap */}
      <div className="inkweave-card">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          🟩 Writing Activity
        </h3>
        <div className="flex gap-2">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 pt-0">
            {dayLabels.map((label, i) => (
              <div key={i} style={{ height: '14px', lineHeight: '14px', fontSize: '10px', color: 'var(--text-muted)' }}>
                {label}
              </div>
            ))}
          </div>
          {/* Heatmap grid */}
          <div className="flex gap-0.5 flex-1">
            {heatmapData.grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5 flex-1">
                {week.map((cell, di) => (
                  <div
                    key={di}
                    className="heatmap-cell"
                    style={{
                      background: getHeatColor(cell.words, heatmapData.maxWords),
                      width: '100%',
                    }}
                    title={`${cell.date}: ${cell.words} words`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2 mt-3" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
          <span>Less</span>
          <div className="heatmap-cell" style={{ background: 'var(--bg-elevated)' }} />
          <div className="heatmap-cell" style={{ background: '#0e4429' }} />
          <div className="heatmap-cell" style={{ background: '#006d32' }} />
          <div className="heatmap-cell" style={{ background: '#26a641' }} />
          <div className="heatmap-cell" style={{ background: '#39d353' }} />
          <span>More</span>
        </div>
      </div>

      {/* Vocabulary Section */}
      <div className="inkweave-card">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          📖 Top Vocabulary
        </h3>
        {vocabularyData.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Write some content to see your vocabulary stats.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {vocabularyData.map(([word, count]) => {
              const maxCount = vocabularyData[0]?.[1] || 1;
              const width = (count / maxCount) * 100;
              return (
                <div key={word} className="flex items-center gap-3">
                  <span
                    className="text-xs font-mono shrink-0"
                    style={{ color: 'var(--text-primary)', width: '80px', textAlign: 'right' }}
                  >
                    {word}
                  </span>
                  <div
                    className="h-3 rounded-sm transition-all duration-300"
                    style={{
                      width: `${Math.max(width, 2)}%`,
                      background: `linear-gradient(90deg, var(--accent-gold-dim), var(--accent-gold))`,
                      opacity: 0.6 + (count / maxCount) * 0.4,
                    }}
                  />
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)', width: '30px' }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Achievements Grid */}
      <div className="inkweave-card">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          🏅 Achievements
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {achievements.map(ach => {
            const unlocked = stats.achievements.includes(ach.id);
            return (
              <div
                key={ach.id}
                className={`rounded-lg p-3 text-center transition-all duration-300 ${
                  unlocked ? 'animate-fade-in' : ''
                }`}
                style={{
                  background: unlocked ? 'rgba(212, 168, 83, 0.1)' : 'var(--bg-tertiary)',
                  border: `1px solid ${unlocked ? 'var(--accent-gold)' : 'var(--border-color)'}`,
                  opacity: unlocked ? 1 : 0.5,
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>
                  {unlocked ? ach.icon : '🔒'}
                </div>
                <div
                  className="text-xs font-semibold"
                  style={{ color: unlocked ? 'var(--accent-gold)' : 'var(--text-muted)' }}
                >
                  {ach.label}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                  {ach.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom spacing for scroll */}
      <div style={{ height: '32px' }} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="inkweave-card flex flex-col items-center gap-1 text-center"
      style={highlight ? { borderColor: 'var(--accent-gold)', background: 'rgba(212, 168, 83, 0.08)' } : {}}
    >
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <span
        className="text-lg font-bold"
        style={{ color: highlight ? 'var(--accent-gold)' : 'var(--text-primary)' }}
      >
        {value}
      </span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
    </div>
  );
}
