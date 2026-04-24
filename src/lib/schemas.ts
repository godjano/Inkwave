import { WorldCategory, WorldEntry } from './types';

export interface SchemaField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
}

export interface WorldSchema {
  category: WorldCategory;
  label: string;
  icon: string;
  color: string;
  fields: SchemaField[];
}

export const worldSchemas: WorldSchema[] = [
  {
    category: 'characters',
    label: 'Characters',
    icon: '👤',
    color: '#a78bfa',
    fields: [
      { key: 'race', label: 'Race', type: 'text' },
      { key: 'class', label: 'Class / Role', type: 'text' },
      { key: 'age', label: 'Age', type: 'text' },
      { key: 'description', label: 'Physical Description', type: 'textarea' },
      { key: 'personality', label: 'Personality', type: 'textarea' },
      { key: 'backstory', label: 'Backstory', type: 'textarea' },
      { key: 'goals', label: 'Goals & Motivations', type: 'textarea' },
      { key: 'relationships', label: 'Key Relationships', type: 'textarea' },
      { key: 'abilities', label: 'Abilities / Skills', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Deceased', 'Missing', 'Unknown'] },
    ],
  },
  {
    category: 'locations',
    label: 'Locations',
    icon: '🌍',
    color: '#34d399',
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: ['City', 'Village', 'Kingdom', 'Forest', 'Mountain', 'Dungeon', 'Ocean', 'Other'] },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'history', label: 'History', type: 'textarea' },
      { key: 'inhabitants', label: 'Inhabitants', type: 'textarea' },
      { key: 'climate', label: 'Climate / Terrain', type: 'text' },
      { key: 'notable_features', label: 'Notable Features', type: 'textarea' },
      { key: 'dangers', label: 'Dangers', type: 'textarea' },
    ],
  },
  {
    category: 'magic',
    label: 'Magic Systems',
    icon: '✨',
    color: '#f472b6',
    fields: [
      { key: 'type', label: 'Magic Type', type: 'text' },
      { key: 'source', label: 'Power Source', type: 'textarea' },
      { key: 'rules', label: 'Rules & Limitations', type: 'textarea' },
      { key: 'cost', label: 'Cost / Consequence', type: 'textarea' },
      { key: 'practitioners', label: 'Known Practitioners', type: 'textarea' },
      { key: 'spells', label: 'Notable Spells / Abilities', type: 'textarea' },
    ],
  },
  {
    category: 'lore',
    label: 'Lore & History',
    icon: '📜',
    color: '#fbbf24',
    fields: [
      { key: 'era', label: 'Era / Time Period', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'key_events', label: 'Key Events', type: 'textarea' },
      { key: 'factions_involved', label: 'Factions Involved', type: 'textarea' },
      { key: 'significance', label: 'Significance', type: 'textarea' },
    ],
  },
  {
    category: 'items',
    label: 'Items & Artifacts',
    icon: '⚔️',
    color: '#fb923c',
    fields: [
      { key: 'type', label: 'Item Type', type: 'select', options: ['Weapon', 'Armor', 'Accessory', 'Potion', 'Scroll', 'Artifact', 'Other'] },
      { key: 'rarity', label: 'Rarity', type: 'select', options: ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic'] },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'abilities', label: 'Abilities / Effects', type: 'textarea' },
      { key: 'history', label: 'History', type: 'textarea' },
      { key: 'current_owner', label: 'Current Owner / Location', type: 'text' },
    ],
  },
  {
    category: 'factions',
    label: 'Factions & Organizations',
    icon: '🏴',
    color: '#60a5fa',
    fields: [
      { key: 'type', label: 'Type', type: 'select', options: ['Guild', 'Kingdom', 'Cult', 'Military', 'Mercenary', 'Religious', 'Political', 'Other'] },
      { key: 'leader', label: 'Leader', type: 'text' },
      { key: 'headquarters', label: 'Headquarters', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'goals', label: 'Goals & Motivations', type: 'textarea' },
      { key: 'members', label: 'Notable Members', type: 'textarea' },
      { key: 'allies', label: 'Allies', type: 'textarea' },
      { key: 'enemies', label: 'Enemies', type: 'textarea' },
    ],
  },
];

export const achievements = [
  { id: 'first_words', label: 'First Words', description: 'Write your first 100 words', icon: '✒️', check: (w: number) => w >= 100 },
  { id: '1k_words', label: 'Wordsmith', description: 'Reach 1,000 total words', icon: '📝', check: (w: number) => w >= 1000 },
  { id: '10k_words', label: 'Prolific Author', description: 'Reach 10,000 total words', icon: '📚', check: (w: number) => w >= 10000 },
  { id: '50k_words', label: 'Novelist', description: 'Reach 50,000 total words', icon: '📖', check: (w: number) => w >= 50000 },
  { id: '100k_words', label: 'Epic Creator', description: 'Reach 100,000 total words', icon: '🏆', check: (w: number) => w >= 100000 },
  { id: 'streak_3', label: 'On a Roll', description: 'Maintain a 3-day writing streak', icon: '🔥', check: (_: number, s: number) => s >= 3 },
  { id: 'streak_7', label: 'Dedicated', description: 'Maintain a 7-day writing streak', icon: '⚡', check: (_: number, s: number) => s >= 7 },
  { id: 'streak_30', label: 'Unstoppable', description: 'Maintain a 30-day writing streak', icon: '🌟', check: (_: number, s: number) => s >= 30 },
  { id: 'chapter_1', label: 'First Chapter', description: 'Complete your first chapter', icon: '📋', check: (_w: number, _s: number, c: number) => c >= 1 },
  { id: 'chapter_5', label: 'Five Alive', description: 'Write 5 chapters', icon: '📑', check: (_w: number, _s: number, c: number) => c >= 5 },
  { id: 'chapter_20', label: 'Epic Length', description: 'Write 20 chapters', icon: '📗', check: (_w: number, _s: number, c: number) => c >= 20 },
  { id: 'world_builder', label: 'World Builder', description: 'Add 10 entries to your World Bible', icon: '🏗️', check: (_w: number, _s: number, _c: number, wb: number) => wb >= 10 },
];

export interface NameCulture {
  id: string;
  label: string;
  prefixes: string[];
  middles: string[];
  suffixes: string[];
  lastPrefixes: string[];
  lastSuffixes: string[];
}

export const nameCultures: NameCulture[] = [
  {
    id: 'elvish', label: 'Elvish', prefixes: ['Ael', 'Cir', 'Elo', 'Fael', 'Gal', 'Isil', 'Lor', 'Nim', 'Rin', 'Sil', 'Thal', 'Van'],
    middles: ['a', 'en', 'il', 'o', 'ar', 'el', 'ir', 'on', 'ae', 'ui'],
    suffixes: ['dil', 'fin', 'mir', 'wen', 'ros', 'ath', 'riel', 'wen', 'nor', 'dil', 'las'],
    lastPrefixes: ['Star', 'Moon', 'Sun', 'Silver', 'Gold', 'Night', 'Dawn', 'Dusk', 'Leaf', 'Wind'],
    lastSuffixes: ['whisper', 'weaver', 'singer', 'walker', 'shadow', 'light', 'bower', 'glade', 'bloom', 'fall'],
  },
  {
    id: 'dwarven', label: 'Dwarven', prefixes: ['Thor', 'Durn', 'Brom', 'Grim', 'Krag', 'Thrun', 'Orin', 'Dwal', 'Balin', 'Nor'],
    middles: ['in', 'un', 'ar', 'or', 'al', 'ek', 'um', 'ok', 'ur', 'ak'],
    suffixes: ['dan', 'gar', 'rik', 'mak', 'bak', 'rok', 'dum', 'fur', 'lak', 'rim'],
    lastPrefixes: ['Iron', 'Stone', 'Deep', 'Gold', 'Copper', 'Forge', 'Hammer', 'Anvil', 'Steam', 'Mithril'],
    lastSuffixes: ['beard', 'breaker', 'hammer', 'forge', 'shield', 'heart', 'hand', 'bane', ' fist', 'bane'],
  },
  {
    id: 'orcish', label: 'Orcish', prefixes: ['Gruk', 'Mog', 'Thrak', 'Urz', 'Gash', 'Lug', 'Borg', 'Skrag', 'Draz', 'Kron'],
    middles: ['a', 'u', 'o', 'ar', 'uk', 'ag', 'uz', 'ok', 'ur', 'az'],
    suffixes: ['zog', 'nak', 'ruk', 'gar', 'zul', 'dosh', 'mak', 'groth', 'kash', 'thak'],
    lastPrefixes: ['Blood', 'Skull', 'Bone', 'Ash', 'Dark', 'Iron', 'Black', 'Red', 'War', 'Fang'],
    lastSuffixes: ['crusher', 'render', 'fang', 'tooth', 'claw', 'ripper', 'smasher', 'bane', 'slayer', 'fist'],
  },
  {
    id: 'human_northern', label: 'Human (Northern)', prefixes: ['Ald', 'Bjorn', 'Erik', 'Finn', 'Gunn', 'Har', 'Ivar', 'Kol', 'Leif', 'Magn'],
    middles: ['er', 'ar', 'on', 'in', 'el', 'or', 'an', 'us', 'en', 'ir'],
    suffixes: ['ic', 'son', 'sen', 'red', 'mund', 'gard', 'rik', 'vald', 'stan', 'borg'],
    lastPrefixes: ['Storm', 'Iron', 'Winter', 'Bear', 'Wolf', 'Frost', 'North', 'Snow', 'Oak', 'Shield'],
    lastSuffixes: ['born', 'son', 'sen', 'ward', 'berg', 'holm', 'sted', 'gaard', 'vik', 'lund'],
  },
  {
    id: 'human_southern', label: 'Human (Southern)', prefixes: ['Ant', 'Cas', 'Dom', 'Est', 'Fer', 'Gal', 'Her', 'Isa', 'Jor', 'Lor'],
    middles: ['o', 'an', 'on', 'el', 'in', 'ar', 'us', 'ia', 'en', 'or'],
    suffixes: ['ian', 'eo', 'as', 'io', 'on', 'us', 'ia', 'el', 'is', 'an'],
    lastPrefixes: ['Del', 'Val', 'Mor', 'San', 'Cor', 'Al', 'Bel', 'Ros', 'Sal', 'Mon'],
    lastSuffixes: ['gado', 'rado', 'ante', 'eira', 'ucci', 'ovia', 'ando', 'etti', 'ella', 'ini'],
  },
  {
    id: 'draconic', label: 'Draconic', prefixes: ['Zyr', 'Vor', 'Kry', 'Thar', 'Nex', 'Pha', 'Dra', 'Ign', 'Vor', 'Ash'],
    middles: ['a', 'o', 'u', 'ar', 'ix', 'ul', 'az', 'on', 'ex', 'ur'],
    suffixes: ['gos', 'thos', 'nix', 'dros', 'vex', 'rath', 'zith', 'mon', 'kai', 'vorn'],
    lastPrefixes: ['Flame', 'Scale', 'Wing', 'Claw', 'Dawn', 'Twilight', 'Storm', 'Void', 'Ember', 'Frost'],
    lastSuffixes: ['breath', 'scale', 'wing', 'heart', 'maw', 'claw', 'fire', 'fury', 'bane', 'lord'],
  },
  {
    id: 'fey', label: 'Fey', prefixes: ['Tyl', 'Pip', 'Nyx', 'Zan', 'Bri', 'Fay', 'Lul', 'Ori', 'Syl', 'Whi'],
    middles: ['a', 'i', 'o', 'ee', 'oo', 'ae', 'ai', 'ou', 'ei', 'ia'],
    suffixes: ['kin', 'wick', 'bell', 'fox', 'petal', 'drop', 'twig', 'leaf', 'berry', 'shine'],
    lastPrefixes: ['Moss', 'Bramble', 'Thorn', 'Mist', 'Glimmer', 'Hollow', 'Ripple', 'Dew', 'Petal', 'Fern'],
    lastSuffixes: ['foot', 'whisper', 'cloak', 'heart', 'step', 'shade', 'glow', 'thread', 'bloom', 'song'],
  },
  {
    id: 'undead', label: 'Undead / Dark', prefixes: ['Mor', 'Nul', 'Vor', 'Kael', 'Syl', 'Dre', 'Mal', 'Gor', 'Zar', 'Nex'],
    middles: ['ath', 'ul', 'on', 'ak', 'ez', 'ar', 'el', 'ir', 'os', 'ux'],
    suffixes: ['ius', 'ius', 'oth', 'ath', 'urn', 'ane', 'ek', 'orn', 'ix', 'oth'],
    lastPrefixes: ['Grave', 'Shadow', 'Death', 'Doom', 'Void', 'Hollow', 'Blight', 'Wither', 'Curse', 'Raven'],
    lastSuffixes: ['born', 'walker', 'bane', 'rend', 'caller', 'touched', 'sworn', 'marked', 'bound', 'whisper'],
  },
];

export const writingPrompts = [
  'A mysterious stranger arrives at the inn with a map that leads to a forgotten kingdom.',
  'Your protagonist discovers they can hear the thoughts of ancient statues.',
  'A cursed weapon chooses its next wielder — someone completely unqualified.',
  'The last dragon egg hatches in the hands of a humble farmer.',
  'An ancient treaty between gods is about to expire, and war is imminent.',
  'Your character wakes up in a library with no doors and infinite shelves.',
  'A forbidden spell reveals that the world is actually a dream of a sleeping god.',
  'Two rival assassins are hired to kill each other and end up teaming up.',
  'The moon turns red, and creatures of myth begin walking the streets.',
  'A magical plague transforms the infected into living crystal.',
  'Your protagonist finds a letter addressed to them — written 200 years ago.',
  'The ocean begins to recede, revealing a civilization lost beneath the waves.',
  'A time-traveling bard accidentally changes the outcome of a major battle.',
  'The forest begins to grow overnight, consuming villages and roads.',
  'Your character inherits a haunted castle that is slowly being reclaimed by the sea.',
  'An ancient AI awakens in the ruins of a lost magical civilization.',
  'The gods begin dying one by one, and mortals must take their place.',
  'A blind seer sees a future where magic no longer exists.',
  'The borders between the living world and the fey realm start to dissolve.',
  'A rebellion forms in the underworld, and the demons seek freedom.',
];
