import { NextRequest } from 'next/server';
import { chatCompletion, imageGeneration } from '@/lib/ai-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, data, apiKey, provider, model } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: 'Action is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const opts = { apiKey, provider, model };

    switch (action) {
      case 'generate-cover': {
        const { title, genre, synopsis, chapterContent } = data || {};
        const prompt = buildCoverPrompt(title, genre, synopsis, chapterContent);
        const seed = Math.random().toString(36).slice(2, 10);
        const base64 = await imageGeneration(prompt, undefined, { ...opts, seed });
        return new Response(JSON.stringify({ content: base64 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'enrich-entry': {
        const { entryName, category, existingFields, chapterContext, worldContext } = data || {};
        const prompt = buildEnrichPrompt(entryName, category, existingFields, chapterContext, worldContext);
        const content = await chatCompletion(
          [
            { role: 'system', content: 'You are a fantasy world-building expert. Generate rich, detailed entries consistent with the story context. Return your response as valid JSON.' },
            { role: 'user', content: prompt },
          ],
          { temperature: 0.8, max_tokens: 1500, ...opts },
        );
        return new Response(JSON.stringify({ content }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'check-consistency': {
        const { chapters } = data || {};
        const prompt = buildConsistencyPrompt(chapters);
        const content = await chatCompletion(
          [
            { role: 'system', content: 'You are a meticulous story editor. Analyze chapters for continuity errors and plot holes. Return findings as structured text.' },
            { role: 'user', content: prompt },
          ],
          { temperature: 0.3, max_tokens: 2048, ...opts },
        );
        return new Response(JSON.stringify({ content }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'suggest-chapter': {
        const { title, genre, synopsis, previousChapters, worldBible } = data || {};
        const prompt = buildChapterSuggestionPrompt(title, genre, synopsis, previousChapters, worldBible);
        const content = await chatCompletion(
          [
            { role: 'system', content: 'You are a creative fantasy author assistant. Help outline the next chapter.' },
            { role: 'user', content: prompt },
          ],
          { temperature: 0.85, max_tokens: 1500, ...opts },
        );
        return new Response(JSON.stringify({ content }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'generate-names': {
        const { culture, existingNames, worldTone } = data || {};
        const prompt = buildNamesPrompt(culture, existingNames, worldTone);
        const content = await chatCompletion(
          [
            { role: 'system', content: 'You are a fantasy naming expert. Generate 10 names with brief etymology in parentheses.' },
            { role: 'user', content: prompt },
          ],
          { temperature: 0.9, max_tokens: 800, ...opts },
        );
        return new Response(JSON.stringify({ content }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'generate-entry': {
        const { genre, synopsis, category, existingEntries, schemaFields, chapterContent } = data || {};
        const prompt = buildGenerateEntryPrompt(genre, synopsis, category, existingEntries, schemaFields, chapterContent);
        const content = await chatCompletion(
          [
            { role: 'system', content: 'You are an expert literary analyst extracting world-building data from written chapters. Your rules:\n1. NAMES must appear explicitly in the text (proper nouns only).\n2. For descriptive fields (personality, appearance, relationships), you MAY infer from context: actions reveal personality, described features reveal appearance, interactions reveal relationships.\n3. Mark inferred details with [inferred] so the author can review.\n4. For fields with NO textual basis at all, write "Not yet revealed".\n5. Be thorough \u2014 fill every field you can with evidence from the text. Writers want RICH entries, not sparse ones.\n6. For relationships, trace every character interaction and name every connection.\n7. NEVER invent names, places, or events not in the text.\nAlways return valid JSON.' },
            { role: 'user', content: prompt },
          ],
          { temperature: 0.2, max_tokens: 2000, ...opts },
        );
        return new Response(JSON.stringify({ content }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      case 'generate-edges': {
        const { worldBible, chapterContent } = data || {};
        const prompt = buildGenerateEdgesPrompt(worldBible, chapterContent);
        const content = await chatCompletion(
          [
            { role: 'system', content: 'You are a strict story relationship analyst. You ONLY extract relationships that are EXPLICITLY described in the chapter text. You NEVER invent or fabricate relationships. Every relationship must be directly traceable to a sentence in the text. Always return valid JSON.' },
            { role: 'user', content: prompt },
          ],
          { temperature: 0.15, max_tokens: 3000, ...opts },
        );
        return new Response(JSON.stringify({ content }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown AI error';
    console.error('AI Enrich error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function buildCoverPrompt(title?: string, genre?: string, synopsis?: string, chapterContent?: string): string {
  const parts = [
    'Professional fantasy book cover art, portrait orientation,',
    genre ? `${genre} genre,` : 'epic fantasy,',
    'digital painting, cinematic composition, dramatic lighting, no text, no fonts, no words, no title, no author name, highly detailed, professional quality, evocative mood',
  ];

  if (title) parts.push(`thematic essence inspired by "${title}"`);

  if (synopsis) {
    // Extract key visual elements from synopsis
    parts.push(`narrative setting: ${synopsis.slice(0, 300)}`);
  }

  // Use chapter content for unique visual elements — increased to 2000 chars
  if (chapterContent && chapterContent.trim()) {
    const plainText = chapterContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    const visualSnippet = plainText.slice(0, 2000);

    // Build a more specific visual extraction prompt
    parts.push(`Based on this story excerpt, create a unique cover composition featuring: ${visualSnippet}`);
    parts.push('Extract and depict: the dominant landscape or setting, any key characters described, the emotional atmosphere, symbolic objects or creatures mentioned, the time of day and lighting mood');
    parts.push('Create a composition that feels like a real published fantasy novel cover with depth, layering, and a compelling focal point');
  } else {
    parts.push('Create a generic but evocative fantasy landscape with atmospheric depth, mysterious elements, and a sense of adventure');
  }

  parts.push('Style: rich color palette, painterly brushwork, dramatic contrast between light and shadow, cinematic framing with foreground and background depth layers');

  // Unique identifier ensures different results each time
  parts.push(`unique cover composition seed ${Date.now()}`);

  return parts.join(' ');
}

function buildEnrichPrompt(entryName: string, category: string, existingFields: Record<string, string>, chapterContext: string, worldContext: string): string {
  const descs: Record<string, string> = {
    characters: 'a character profile with personality, appearance, backstory, motivations, relationships',
    locations: 'a detailed location with geography, climate, culture, landmarks, and history',
    magic: 'a magic system entry with rules, limitations, practitioners, and visual effects',
    lore: 'a lore/historical entry with timeline, key events, and consequences',
    items: 'an artifact/item with origin, appearance, powers, and significance',
    factions: 'a faction/group with hierarchy, goals, territory, allies, and enemies',
  };
  let p = `Create ${descs[category] || 'a world bible entry'} for "${entryName}".\n`;
  const filled = Object.entries(existingFields).filter(([, v]) => v);
  if (filled.length > 0) {
    p += 'Existing info:\n' + filled.map(([k, v]) => `  ${k}: ${v}`).join('\n') + '\n';
  }
  if (chapterContext) p += `Story context:\n${chapterContext.slice(0, 2000)}\n`;
  if (worldContext) p += `World context:\n${worldContext.slice(0, 1000)}\n`;
  p += 'Generate a JSON object with name and 4-6 relevant fields with rich descriptions. Be consistent with the story.';
  return p;
}

function buildConsistencyPrompt(chapters: { title: string; content: string; order: number }[]): string {
  let p = 'Analyze these chapters for continuity errors:\n\n';
  for (const ch of chapters) {
    p += `--- Ch ${ch.order + 1}: "${ch.title}" ---\n${ch.content.replace(/<[^>]*>/g, '').slice(0, 3000)}\n\n`;
  }
  p += 'Check: character consistency, timeline, geography, plot holes, name spelling. Return by severity (Critical/Moderate/Minor).';
  return p;
}

function buildChapterSuggestionPrompt(title: string, genre: string, synopsis: string, prev: { title: string; summary: string; wordCount: number; order: number }[], wb: { name: string; category: string; notes: string }[]): string {
  let p = `${genre} novel: "${title}". Synopsis: ${synopsis}\n\n`;
  if (prev.length > 0) {
    p += 'Previous chapters:\n' + prev.slice(-5).map(c => `  Ch ${c.order + 1}: "${c.title}" (${c.wordCount}w)${c.summary ? ` - ${c.summary}` : ''}`).join('\n') + '\n\n';
  }
  if (wb.length > 0) {
    p += 'World elements:\n' + wb.slice(0, 15).map(e => `  [${e.category}] ${e.name}${e.notes ? `: ${e.notes.slice(0, 80)}` : ''}`).join('\n') + '\n\n';
  }
  p += 'Suggest the next chapter: title, 3-5 plot points, characters, setting, opening hook, cliffhanger.';
  return p;
}

function buildNamesPrompt(culture: string, existingNames: string[], worldTone: string): string {
  let p = `Generate 10 fantasy names in ${culture} tradition.`;
  if (worldTone) p += ` World tone: ${worldTone}.`;
  if (existingNames.length > 0) p += ` Existing names: ${existingNames.join(', ')}.`;
  p += ' For each name, give a brief meaning in parentheses.';
  return p;
}

function buildGenerateEntryPrompt(
  genre: string | undefined,
  synopsis: string | undefined,
  category: string,
  existingEntries: { name: string; notes: string }[] | undefined,
  schemaFields: { key: string; label: string }[] | undefined,
  chapterContent: string | undefined,
): string {
  const categoryInstructions: Record<string, string> = {
    characters: `CRITICAL RULE: You must ONLY extract a character whose name appears EXPLICITLY in the chapter text. Look for proper nouns — names with capital first letters that are used to refer to people (e.g., "Raven", "Elara", "Thorne"). Do NOT invent any character name. Pick the most prominent named character who is NOT in the "ALREADY CATALOGUED" list. Extract: appearance (if described), personality traits shown through actions/dialogue, role in the story, relationships to other named characters, and any backstory mentioned.`,
    locations: `CRITICAL RULE: You must ONLY extract a location whose name appears EXPLICITLY in the chapter text. Look for proper nouns that refer to places (e.g., "Ironhold", "the Whispering Forest", "Thornwall"). Do NOT invent any place name. Pick the most distinct named location that is NOT in the "ALREADY CATALOGUED" list. Extract: geographical details, atmosphere, any culture or history mentioned, and its significance to the story.`,
    magic: `CRITICAL RULE: You must ONLY document magical elements that are EXPLICITLY mentioned or demonstrated in the chapter text. Look for spells, enchantments, supernatural abilities, magical objects with powers, or magic systems referenced by name. Do NOT invent magic that does not appear in the text. Extract: the name of the magic/spell/system, how it works (if explained), its limitations, who uses it, and visual effects described.`,
    lore: `CRITICAL RULE: You must ONLY extract lore, history, legends, or world events that are EXPLICITLY mentioned in the chapter text. Look for references to past events, prophecies, historical figures, wars, treaties, or world-building details in dialogue or narration. Do NOT invent history. Extract: what happened, when, who was involved, and its significance to the current story.`,
    items: `CRITICAL RULE: You must ONLY extract items or artifacts that are EXPLICITLY named in the chapter text. Look for weapons, relics, tools, clothing, or objects with proper names or special significance. Do NOT invent items. Extract: its name, appearance, origin (if mentioned), special properties or powers, and its role in the story.`,
    factions: `CRITICAL RULE: You must ONLY extract factions, groups, or organizations that are EXPLICITLY named in the chapter text. Look for mentions of kingdoms, guilds, orders, armies, clans, or political groups by name. Do NOT invent factions. Extract: the group's name, its structure/hierarchy (if mentioned), its goals or purpose, its territory, and its allies and enemies.`,
  };

  const hasChapters = chapterContent && chapterContent.trim().length > 0;

  let p = '';

  if (hasChapters) {
    // ═══ CHAPTERS EXIST — EXTRACTION-ONLY MODE ═══
    p += `You are an expert story analyst. Your job is to read the written chapters below and extract a ${category} entry.\n\n`;
    p += `╔══════════════════════════════════════════════════════════════╗\n`;
    p += `║  ABSOLUTE RULE: You may ONLY use information that appears   ║\n`;
    p += `║  in the chapter text below. You must NOT invent, guess,     ║\n`;
    p += `║  imagine, or fabricate ANY detail. Every single field you    ║\n`;
    p += `║  fill must be traceable to a specific sentence in the text. ║\n`;
    p += `║  If the text does not mention something, write "Unknown".    ║\n`;
    p += `║  You must pick a subject whose NAME appears in the text.     ║\n`;
    p += `╚══════════════════════════════════════════════════════════════╝\n\n`;

    if (synopsis) {
      p += `Story context: ${synopsis.slice(0, 300)}\n\n`;
    }

    p += `═══ WRITTEN CHAPTERS (read these carefully) ═══\n\n`;
    // Send up to 8000 chars of chapter content for better extraction
    p += chapterContent.slice(0, 12000);
    p += '\n\n';

    p += `═══ EXTRACTION INSTRUCTIONS ═══\n`;
    p += `Category: ${category}\n`;
    p += `${categoryInstructions[category] || ''}\n\n`;
  } else {
    // ═══ NO CHAPTERS — tell the user, don't invent ═══
    p += `No chapters have been written yet. You cannot extract any ${category} entries because there is no source text to analyze. Please write some chapters first, then use this feature to extract characters, locations, and other elements from your actual writing.\n\n`;
    p += `Respond with a JSON object: { "name": "Write chapters first", "notes": "No chapters available to extract from. Please write at least one chapter before using AI generation." }`;
    return p;
  }

  if (existingEntries && existingEntries.length > 0) {
    p += '═══ ALREADY CATALOGUED (do NOT pick any of these) ═══\n';
    p += existingEntries.slice(0, 20).map(e => `  ✗ ${e.name}`).join('\n');
    p += '\n\n';
  }

  if (schemaFields && schemaFields.length > 0) {
    p += '═══ FIELDS TO FILL ═══\n';
    p += 'Fill each field ONLY from what the chapter text reveals. Use "Unknown" if not mentioned:\n';
    p += schemaFields.map(f => `  - "${f.key}": ${f.label}`).join('\n');
    p += '\n';
  }

  p += '═══ OUTPUT FORMAT ═══\n';
  p += 'Return a JSON object with:\n';
  p += '  "name": The EXACT name as it appears in the chapter text (proper noun)\n';
  p += '  One key for each field above, populated ONLY from the text\n';
  p += '  "notes": A brief summary citing what chapter(s) this entry appears in\n\n';
  p += 'REMEMBER: If you cannot find a named ' + category + ' in the text that is not already catalogued, respond with:\n';
  p += '{ "name": "All known entries catalogued", "notes": "No new uncatalogued ' + category + ' found in the current chapters. Write more chapters and try again." }';

  return p;
}

function buildGenerateEdgesPrompt(
  worldBible: { name: string; category: string; notes: string }[] | undefined,
  chapterContent: string | undefined,
): string {
  const hasChapters = chapterContent && chapterContent.trim().length > 0;
  const entries = worldBible || [];

  if (!hasChapters || entries.length < 2) {
    return JSON.stringify({
      edges: [],
      message: entries.length < 2
        ? 'Need at least 2 World Bible entries to create relationships.'
        : 'No chapters available. Write chapters first.',
    });
  }

  let p = `You are a story relationship analyst. Read the chapter text below and identify relationships between these named entities.

`;
  p += `╔══════════════════════════════════════════════════════════════╗\n`;
  p += `║  ABSOLUTE RULE: You may ONLY extract relationships that     ║\n`;
  p += `║  are EXPLICITLY described in the chapter text. Do NOT invent  ║\n`;
  p += `║  any relationships. Every edge must be traceable to the text. ║\n`;
  p += `╚══════════════════════════════════════════════════════════════╝\n\n`;

  p += `═══ NAMED ENTITIES ═══\n`;
  p += entries.map(e => `  [${e.category}] ${e.name}`).join('\n');
  p += '\n\n';

  p += `═══ CHAPTER TEXT ═══\n\n`;
  p += chapterContent.slice(0, 8000);
  p += '\n\n';

  p += `═══ INSTRUCTIONS ═══\n`;
  p += `Look for explicit mentions of how any two entities from the list interact, relate to, or are connected.
`;
  p += `Examples: "Raven fought alongside Kira", "Thornwall is the capital of the Northern Kingdom", "the sword was forged by Mordain"\n\n`;
  p += `Types of relationships to look for:
`;
  p += `  - Character to Character: allies, enemies, family, mentor, lover, rival, servant, leader
`;
  p += `  - Character to Location: lives in, rules, was born in, traveled to, guards
`;
  p += `  - Character to Item: wields, owns, seeks, created, destroyed
`;
  p += `  - Character to Faction: member of, leads, opposes, founded
`;
  p += `  - Location to Faction: controlled by, capital of, base of
`;
  p += `  - Faction to Faction: allied with, at war with, merged with

`;
  p += `═══ OUTPUT FORMAT ═══\n`;
  p += `Return a JSON object:\n`;
  p += `{\n`;
  p += `  "edges": [\n`;
  p += `    { "from": "Entity Name A", "to": "Entity Name B", "label": "relationship description" },\n`;
  p += `    ...\n`;
  p += `  ]\n`;
  p += `}\n\n`;
  p += `IMPORTANT: Use EXACT entity names from the entity list. If no relationships are found, return { "edges": [] }.`;

  return p;
}
