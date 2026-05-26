'use client';

import { useState } from 'react';
import { useAutoBackup } from '@/hooks/useAutoBackup';
import { Download, X, Shield, Clock } from 'lucide-react';

export default function BackupIndicator() {
  const { lastSaved, showReminder, exportAll, dismissReminder } = useAutoBackup();
  const [dismissed, setDismissed] = useState(false);

  const formatTime = (date: Date | null) => {
    if (!date) return 'Saving...';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 5000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <div
        className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-opacity duration-300"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-muted)',
          opacity: lastSaved ? 0.7 : 0.4,
        }}
        title="Your work is auto-saved locally every 60 seconds"
      >
        <Shield size={12} style={{ color: 'var(--accent-green)' }} />
        <span>Saved {formatTime(lastSaved)}</span>
      </div>

      {showReminder && !dismissed && (
        <div
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl p-4 shadow-lg"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent-gold-dim)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(184,145,46,0.15)' }}
            >
              <Clock size={16} style={{ color: 'var(--accent-gold)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Time to back up your stories
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                It has been a while since you downloaded a backup. Your work lives in this browser &mdash; keep a copy safe.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={exportAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'var(--accent-gold)', color: 'var(--text-primary)' }}
                >
                  <Download size={12} />
                  Download Backup
                </button>
                <button
                  onClick={() => { dismissReminder(); setDismissed(true); }}
                  className="px-3 py-1.5 rounded-lg text-xs transition-all"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Remind me later
                </button>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="flex-shrink-0 p-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
