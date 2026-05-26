'use client';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import EditorShell from '@/components/EditorShell';
import BackupIndicator from '@/components/BackupIndicator';

export default function Home() {
  const activeProjectId = useStore(s => s.activeProjectId);
  const focusMode = useStore(s => s.focusMode);
  const setFocusMode = useStore(s => s.setFocusMode);
  const setActiveProject = useStore(s => s.setActiveProject);

  /* Keyboard shortcuts */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+F or Cmd+Shift+F: Toggle focus/zen mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setFocusMode(!focusMode);
      }
      // Escape: Exit focus mode
      if (e.key === 'Escape' && focusMode) {
        setFocusMode(false);
      }
      // Ctrl+Shift+H or Cmd+Shift+H: Back to shelf
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        setActiveProject(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusMode, setFocusMode, setActiveProject]);

  return (
    <div className="flex h-screen overflow-hidden">
      {!focusMode && activeProjectId && <Sidebar />}
      {activeProjectId ? <EditorShell /> : <Dashboard />}
      <BackupIndicator />
      {/* Focus mode escape hint */}
      {focusMode && (
        <div
          className="fixed top-3 right-3 z-50 px-3 py-1.5 rounded-full text-xs opacity-0 hover:opacity-70 transition-opacity duration-300"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-muted)',
          }}
          title="Press Escape or Ctrl+Shift+F to exit focus mode"
        >
          ESC to exit focus
        </div>
      )}
    </div>
  );
}
