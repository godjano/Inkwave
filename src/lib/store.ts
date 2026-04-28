import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Project, Chapter, WorldEntry, MasterBibleNode, MasterBibleEdge,
  Note, WritingSession, AiMessage, AiSettings, EditorMode, SidePanel, WorldCategory, ProjectStats, MapPin, FamilyRelation,
} from './types';
import { achievements } from './schemas';

const uid = () => Math.random().toString(36).slice(2, 11);

function emptyStats(): ProjectStats {
  return { totalWords: 0, totalMinutes: 0, currentStreak: 0, longestStreak: 0, sessions: [], achievements: [], weeklyGoal: 7000 };
}

export interface AppState {
  // Projects
  projects: Project[];
  activeProjectId: string | null;
  activeChapterId: string | null;
  editorMode: EditorMode;
  sidePanel: SidePanel;

  // AI
  aiMessages: AiMessage[];
  aiSettings: AiSettings;

  // UI
  sidebarCollapsed: boolean;
  focusMode: boolean;
  sprintActive: boolean;
  sprintWordGoal: number;
  sprintStartTime: number;
  sprintWordsWritten: number;

  // Actions - Projects
  addProject: (name: string, genre: string, description: string) => string;
  deleteProject: (id: string) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  setActiveProject: (id: string | null) => void;

  // Actions - Chapters
  addChapter: (projectId: string, title?: string) => string;
  deleteChapter: (projectId: string, chapterId: string) => void;
  updateChapter: (projectId: string, chapterId: string, data: Partial<Chapter>) => void;
  reorderChapters: (projectId: string, chapterIds: string[]) => void;
  setActiveChapter: (id: string | null) => void;

  // Actions - World Bible
  addWorldEntry: (projectId: string, category: WorldCategory, name: string) => string;
  deleteWorldEntry: (projectId: string, entryId: string) => void;
  updateWorldEntry: (projectId: string, entryId: string, data: Partial<WorldEntry>) => void;

  // Actions - Master Bible
  addMasterNode: (projectId: string, label: string, x: number, y: number, color: string, category: WorldCategory) => string;
  updateMasterNode: (projectId: string, nodeId: string, data: Partial<MasterBibleNode>) => void;
  deleteMasterNode: (projectId: string, nodeId: string) => void;
  addMasterEdge: (projectId: string, from: string, to: string, label: string) => string;
  deleteMasterEdge: (projectId: string, edgeId: string) => void;

  // Actions - Map Pins
  addMapPin: (projectId: string, pin: Omit<MapPin, 'id'>) => string;
  deleteMapPin: (projectId: string, pinId: string) => void;
  updateMapPin: (projectId: string, pinId: string, data: Partial<MapPin>) => void;

  // Actions - Family Relations
  addFamilyRelation: (projectId: string, rel: Omit<FamilyRelation, 'id'>) => string;
  deleteFamilyRelation: (projectId: string, relId: string) => void;

  // Actions - Notes
  addNote: (projectId: string, title?: string) => string;
  deleteNote: (projectId: string, noteId: string) => void;
  updateNote: (projectId: string, noteId: string, data: Partial<Note>) => void;

  // Actions - Stats
  recordSession: (projectId: string, words: number, minutes: number) => void;

  // Actions - AI
  addAiMessage: (msg: Omit<AiMessage, 'id' | 'timestamp'>) => void;
  clearAiMessages: () => void;
  updateAiSettings: (data: Partial<AiSettings>) => void;

  // Actions - UI
  setEditorMode: (mode: EditorMode) => void;
  setSidePanel: (panel: SidePanel) => void;
  toggleSidebar: () => void;
  setFocusMode: (v: boolean) => void;
  startSprint: (goal: number) => void;
  endSprint: () => void;
  updateSprintWords: (words: number) => void;

  // Helpers
  getActiveProject: () => Project | undefined;
  getActiveChapter: () => Chapter | undefined;

  // Import/Export
  importProject: (data: string) => void;
  exportProject: (projectId: string) => string;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      activeChapterId: null,
      editorMode: 'write',
      sidePanel: 'none',
      aiMessages: [],
      aiSettings: {
        model: 'llama3',
        temperature: 0.7,
        systemPrompt: 'You are a creative writing assistant for fantasy fiction. Help the author develop their story, characters, and world. Be descriptive and imaginative.',
        ollamaUrl: 'http://localhost:11434',
        contextMode: 'chapter',
      },
      sidebarCollapsed: false,
      focusMode: false,
      sprintActive: false,
      sprintWordGoal: 1000,
      sprintStartTime: 0,
      sprintWordsWritten: 0,

      addProject: (name, genre, description) => {
        const id = uid();
        const project: Project = {
          id, name, genre, description,
          chapters: [],
          worldBible: [],
          masterBibleNodes: [],
          masterBibleEdges: [],
          mapPins: [],
          familyRelations: [],
          notes: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          writingGoals: { dailyWords: 1000, dailyMinutes: 30 },
          stats: emptyStats(),
        };
        set(s => ({ projects: [...s.projects, project] }));
        return id;
      },

      deleteProject: (id) => set(s => ({ projects: s.projects.filter(p => p.id !== id), activeProjectId: s.activeProjectId === id ? null : s.activeProjectId })),

      updateProject: (id, data) => set(s => ({
        projects: s.projects.map(p => p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p),
      })),

      setActiveProject: (id) => set({ activeProjectId: id, activeChapterId: null, editorMode: 'write' }),

      addChapter: (projectId, title) => {
        const id = uid();
        const chapter: Chapter = {
          id,
          title: title || `Chapter ${(get().projects.find(p => p.id === projectId)?.chapters.length || 0) + 1}`,
          content: '',
          summary: '',
          status: 'draft',
          wordCount: 0,
          order: get().projects.find(p => p.id === projectId)?.chapters.length || 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set(s => ({
          projects: s.projects.map(p => p.id === projectId ? { ...p, chapters: [...p.chapters, chapter], updatedAt: Date.now() } : p),
        }));
        return id;
      },

      deleteChapter: (projectId, chapterId) => set(s => ({
        projects: s.projects.map(p => {
          if (p.id !== projectId) return p;
          return { ...p, chapters: p.chapters.filter(c => c.id !== chapterId).map((c, i) => ({ ...c, order: i })), updatedAt: Date.now() };
        }),
        activeChapterId: s.activeChapterId === chapterId ? null : s.activeChapterId,
      })),

      updateChapter: (projectId, chapterId, data) => set(s => ({
        projects: s.projects.map(p => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            chapters: p.chapters.map(c => {
              if (c.id !== chapterId) return c;
              const updated = { ...c, ...data, updatedAt: Date.now() };
              if (data.content !== undefined) {
                const plainText = (data.content || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
                updated.wordCount = plainText.split(/\s+/).filter(Boolean).length;
              }
              return updated;
            }),
            updatedAt: Date.now(),
          };
        }),
      })),

      reorderChapters: (projectId, chapterIds) => set(s => ({
        projects: s.projects.map(p => {
          if (p.id !== projectId) return p;
          const chapterMap = new Map(p.chapters.map(c => [c.id, c]));
          const reordered = chapterIds.map((id, i) => ({ ...chapterMap.get(id)!, order: i })).filter(Boolean);
          return { ...p, chapters: reordered, updatedAt: Date.now() };
        }),
      })),

      setActiveChapter: (id) => set({ activeChapterId: id }),

      addWorldEntry: (projectId, category, name) => {
        const id = uid();
        const entry: WorldEntry = { id, category, name, fields: {}, notes: '', linkedChapters: [], createdAt: Date.now(), updatedAt: Date.now() };
        set(s => ({ projects: s.projects.map(p => p.id === projectId ? { ...p, worldBible: [...p.worldBible, entry], updatedAt: Date.now() } : p) }));
        return id;
      },

      deleteWorldEntry: (projectId, entryId) => set(s => ({
        projects: s.projects.map(p => p.id === projectId ? { ...p, worldBible: p.worldBible.filter(e => e.id !== entryId), updatedAt: Date.now() } : p),
      })),

      updateWorldEntry: (projectId, entryId, data) => set(s => ({
        projects: s.projects.map(p => p.id === projectId ? {
          ...p,
          worldBible: p.worldBible.map(e => e.id === entryId ? { ...e, ...data, updatedAt: Date.now() } : e),
          updatedAt: Date.now(),
        } : p),
      })),

      addMasterNode: (projectId, label, x, y, color, category) => {
        const id = uid();
        const node: MasterBibleNode = { id, label, x, y, color, category };
        set(s => ({ projects: s.projects.map(p => p.id === projectId ? { ...p, masterBibleNodes: [...p.masterBibleNodes, node], updatedAt: Date.now() } : p) }));
        return id;
      },

      updateMasterNode: (projectId, nodeId, data) => set(s => ({
        projects: s.projects.map(p => p.id === projectId ? {
          ...p,
          masterBibleNodes: p.masterBibleNodes.map(n => n.id === nodeId ? { ...n, ...data } : n),
          updatedAt: Date.now(),
        } : p),
      })),

      deleteMasterNode: (projectId, nodeId) => set(s => ({
        projects: s.projects.map(p => p.id === projectId ? {
          ...p,
          masterBibleNodes: p.masterBibleNodes.filter(n => n.id !== nodeId),
          masterBibleEdges: p.masterBibleEdges.filter(e => e.from !== nodeId && e.to !== nodeId),
          updatedAt: Date.now(),
        } : p),
      })),

      addMasterEdge: (projectId, from, to, label) => {
        const id = uid();
        const edge: MasterBibleEdge = { id, from, to, label };
        set(s => ({ projects: s.projects.map(p => p.id === projectId ? { ...p, masterBibleEdges: [...p.masterBibleEdges, edge], updatedAt: Date.now() } : p) }));
        return id;
      },

      deleteMasterEdge: (projectId, edgeId) => set(s => ({
        projects: s.projects.map(p => p.id === projectId ? { ...p, masterBibleEdges: p.masterBibleEdges.filter(e => e.id !== edgeId), updatedAt: Date.now() } : p),
      })),

      addMapPin: (projectId, pin) => {
        const id = uid();
        const mapPin: MapPin = { id, ...pin };
        set(s => ({ projects: s.projects.map(p => p.id === projectId ? { ...p, mapPins: [...(p.mapPins || []), mapPin], updatedAt: Date.now() } : p) }));
        return id;
      },

      deleteMapPin: (projectId, pinId) => set(s => ({
        projects: s.projects.map(p => p.id === projectId ? { ...p, mapPins: (p.mapPins || []).filter(pin => pin.id !== pinId), updatedAt: Date.now() } : p),
      })),

      updateMapPin: (projectId, pinId, data) => set(s => ({
        projects: s.projects.map(p => p.id === projectId ? {
          ...p,
          mapPins: (p.mapPins || []).map(pin => pin.id === pinId ? { ...pin, ...data } : pin),
          updatedAt: Date.now(),
        } : p),
      })),

      addFamilyRelation: (projectId, rel) => {
        const id = uid();
        const familyRel: FamilyRelation = { id, ...rel };
        set(s => ({ projects: s.projects.map(p => p.id === projectId ? { ...p, familyRelations: [...(p.familyRelations || []), familyRel], updatedAt: Date.now() } : p) }));
        return id;
      },

      deleteFamilyRelation: (projectId, relId) => set(s => ({
        projects: s.projects.map(p => p.id === projectId ? { ...p, familyRelations: (p.familyRelations || []).filter(r => r.id !== relId), updatedAt: Date.now() } : p),
      })),

      addNote: (projectId, title) => {
        const id = uid();
        const note: Note = { id, title: title || 'New Note', content: '', color: '#fbbf24', createdAt: Date.now(), updatedAt: Date.now() };
        set(s => ({ projects: s.projects.map(p => p.id === projectId ? { ...p, notes: [...p.notes, note], updatedAt: Date.now() } : p) }));
        return id;
      },

      deleteNote: (projectId, noteId) => set(s => ({
        projects: s.projects.map(p => p.id === projectId ? { ...p, notes: p.notes.filter(n => n.id !== noteId), updatedAt: Date.now() } : p),
      })),

      updateNote: (projectId, noteId, data) => set(s => ({
        projects: s.projects.map(p => p.id === projectId ? {
          ...p,
          notes: p.notes.map(n => n.id === noteId ? { ...n, ...data, updatedAt: Date.now() } : n),
          updatedAt: Date.now(),
        } : p),
      })),

      recordSession: (projectId, words, minutes) => {
        const today = new Date().toISOString().split('T')[0];
        set(s => ({
          projects: s.projects.map(p => {
            if (p.id !== projectId) return p;
            const sessions = [...p.stats.sessions];
            const existing = sessions.findIndex(s => s.date === today);
            if (existing >= 0) {
              sessions[existing] = { ...sessions[existing], words: sessions[existing].words + words, minutes: sessions[existing].minutes + minutes };
            } else {
              sessions.push({ date: today, words, minutes });
            }
            // Calculate streak
            let streak = 0;
            const date = new Date();
            for (let i = 0; i < 365; i++) {
              const d = new Date(date);
              d.setDate(d.getDate() - i);
              const ds = d.toISOString().split('T')[0];
              if (sessions.some(s => s.date === ds)) { streak++; } else if (i > 0) { break; }
            }
            const totalWords = sessions.reduce((a, s) => a + s.words, 0);
            const newAchievements = [...p.stats.achievements];
            for (const a of achievements) {
              if (!newAchievements.includes(a.id) && a.check(totalWords, streak, p.chapters.length, p.worldBible.length)) {
                newAchievements.push(a.id);
              }
            }
            return {
              ...p,
              stats: {
                ...p.stats,
                sessions,
                totalWords,
                totalMinutes: sessions.reduce((a, s) => a + s.minutes, 0),
                currentStreak: streak,
                longestStreak: Math.max(p.stats.longestStreak, streak),
                achievements: newAchievements,
              },
              updatedAt: Date.now(),
            };
          }),
        }));
      },

      addAiMessage: (msg) => set(s => ({
        aiMessages: [...s.aiMessages, { ...msg, id: uid(), timestamp: Date.now() }],
      })),

      clearAiMessages: () => set({ aiMessages: [] }),

      updateAiSettings: (data) => set(s => ({ aiSettings: { ...s.aiSettings, ...data } })),

      setEditorMode: (mode) => set({ editorMode: mode }),
      setSidePanel: (panel) => set({ sidePanel: panel }),
      toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setFocusMode: (v) => set({ focusMode: v }),
      startSprint: (goal) => set({ sprintActive: true, sprintWordGoal: goal, sprintStartTime: Date.now(), sprintWordsWritten: 0 }),
      endSprint: () => set({ sprintActive: false }),
      updateSprintWords: (words) => set({ sprintWordsWritten: words }),

      getActiveProject: () => {
        const { projects, activeProjectId } = get();
        return projects.find(p => p.id === activeProjectId);
      },

      getActiveChapter: () => {
        const project = get().getActiveProject();
        if (!project) return undefined;
        return project.chapters.find(c => c.id === get().activeChapterId);
      },

      importProject: (data) => {
        try {
          const project = JSON.parse(data) as Project;
          if (!project.id || !project.name) return;
          set(s => ({ projects: [...s.projects.filter(p => p.id !== project.id), project] }));
        } catch { /* invalid JSON */ }
      },

      exportProject: (projectId) => {
        const project = get().projects.find(p => p.id === projectId);
        return project ? JSON.stringify(project, null, 2) : '';
      },
    }),
    { name: 'inkweave-storage' }
  )
);
