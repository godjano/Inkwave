export interface MapPin {
  id: string;
  x: number;
  y: number;
  label: string;
  type: 'city' | 'town' | 'mountain' | 'forest' | 'dungeon' | 'port' | 'ruins' | 'temple' | 'capital';
  description: string;
}

export interface FamilyRelation {
  id: string;
  fromCharacter: string;
  toCharacter: string;
  type: 'parent' | 'partner' | 'sibling' | 'child';
}

export interface Project {
  id: string;
  name: string;
  genre: string;
  description: string;
  chapters: Chapter[];
  worldBible: WorldEntry[];
  masterBibleNodes: MasterBibleNode[];
  masterBibleEdges: MasterBibleEdge[];
  mapPins: MapPin[];
  familyRelations: FamilyRelation[];
  notes: Note[];
  createdAt: number;
  updatedAt: number;
  writingGoals: { dailyWords: number; dailyMinutes: number };
  stats: ProjectStats;
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  summary: string;
  status: 'draft' | 'revised' | 'final' | 'outline';
  wordCount: number;
  order: number;
  createdAt: number;
  updatedAt: number;
  pov?: string;
  location?: string;
  timelineEvent?: string;
}

export interface WorldEntry {
  id: string;
  category: WorldCategory;
  name: string;
  fields: Record<string, string>;
  notes: string;
  linkedChapters: string[];
  createdAt: number;
  updatedAt: number;
}

export type WorldCategory = 'characters' | 'locations' | 'magic' | 'lore' | 'items' | 'factions';

export interface MasterBibleNode {
  id: string;
  label: string;
  x: number;
  y: number;
  color: string;
  category: WorldCategory;
}

export interface MasterBibleEdge {
  id: string;
  from: string;
  to: string;
  label: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectStats {
  totalWords: number;
  totalMinutes: number;
  currentStreak: number;
  longestStreak: number;
  sessions: WritingSession[];
  achievements: string[];
  weeklyGoal: number;
}

export interface WritingSession {
  date: string;
  words: number;
  minutes: number;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AiSettings {
  model: string;
  temperature: number;
  systemPrompt: string;
  ollamaUrl: string;
  contextMode: 'chapter' | 'project' | 'world-bible' | 'custom';
}

export type EditorMode = 'write' | 'grid' | 'outline' | 'timeline' | 'read' | 'stats' | 'generators' | 'world-map' | 'family-tree' | 'scenes';
export type SidePanel = 'chapters' | 'world-bible' | 'master-bible' | 'ai' | 'notes' | 'none';
