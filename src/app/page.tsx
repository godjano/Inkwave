'use client';
import { useStore } from '@/lib/store';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import EditorShell from '@/components/EditorShell';
import BackupIndicator from '@/components/BackupIndicator';

export default function Home() {
  const activeProjectId = useStore(s => s.activeProjectId);
  const focusMode = useStore(s => s.focusMode);

  return (
    <div className="flex h-screen overflow-hidden">
      {!focusMode && activeProjectId && <Sidebar />}
      {activeProjectId ? <EditorShell /> : <Dashboard />}
      <BackupIndicator />
    </div>
  );
}
