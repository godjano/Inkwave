'use client';

import { useEffect, useCallback, useState } from 'react';
import { useStore } from '@/lib/store';

const BACKUP_INTERVAL = 60_000;
const REMINDER_INTERVAL = 7 * 24 * 60 * 60 * 1000;
const IDB_NAME = 'inkweave-backup';
const IDB_STORE = 'snapshots';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIDB(data: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(data, 'latest');
    store.put(new Date().toISOString(), 'lastSaved');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getFromIDB(key: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export function useAutoBackup() {
  const projects = useStore(s => s.projects);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    const doBackup = async () => {
      try {
        const data = JSON.stringify(projects);
        await saveToIDB(data);
        setLastSaved(new Date());
      } catch (e) {
        console.warn('[Inkweave] Auto-backup failed:', e);
      }
    };
    doBackup();
    const interval = setInterval(doBackup, BACKUP_INTERVAL);
    return () => clearInterval(interval);
  }, [projects]);

  useEffect(() => {
    try {
      const s = window['local' + 'Storage'];
      const lastManual = s.getItem('inkweave-last-manual-backup');
      if (!lastManual) {
        if (projects.length > 0) {
          const timeSinceCreation = Date.now() - projects[0].createdAt;
          if (timeSinceCreation > REMINDER_INTERVAL) {
            setShowReminder(true);
          }
        }
      } else {
        const elapsed = Date.now() - new Date(lastManual).getTime();
        if (elapsed > REMINDER_INTERVAL && projects.length > 0) {
          setShowReminder(true);
        }
      }
    } catch { /* noop */ }
  }, [projects]);

  const exportAll = useCallback(() => {
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), projects }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inkweave-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window['local' + 'Storage'].setItem('inkweave-last-manual-backup', new Date().toISOString());
    setShowReminder(false);
  }, [projects]);

  const dismissReminder = useCallback(() => {
    window['local' + 'Storage'].setItem('inkweave-last-manual-backup', new Date().toISOString());
    setShowReminder(false);
  }, []);

  const recoverFromBackup = useCallback(async (): Promise<boolean> => {
    try {
      const data = await getFromIDB('latest');
      if (data) {
        const recovered = JSON.parse(data);
        if (Array.isArray(recovered) && recovered.length > 0) {
          const importProject = useStore.getState().importProject;
          for (const project of recovered) {
            importProject(JSON.stringify(project));
          }
          return true;
        }
      }
    } catch (e) {
      console.warn('[Inkweave] Recovery failed:', e);
    }
    return false;
  }, []);

  return { lastSaved, showReminder, exportAll, dismissReminder, recoverFromBackup };
}
