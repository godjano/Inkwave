import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, brief, outline, previousChapters, worldBible, voicePrompt, genre, synopsis, apiKey, provider, model } = body;

    if (!action || !brief) {
      return new Response(JSON.stringify({ error: 'Action and brief are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const opts = { apiKey, provider, model, max_tokens: action === 'draft' ? 8000 : 2000 };

    if (action === 'outline') {
      const systemPrompt = `You are an expert fiction story architect. Given a chapter brief, you design a compelling scene-by-scene structure that keeps readers engaged.

Your job:
1. Break the brief into 3-5 scenes with clear narrative purpose
2. Assign a beat type to each scene (hook, rising_action, climax, falling_action, transition, revelation, dialogue, introspection)
3. Suggest an opening hook line and a closing hook/cliffhanger
4. Consider pacing: vary tension, mix action with reflection, ensure the chapter has rhythm

${voicePrompt ? '--- AUTHOR VOICE ---\n' + voicePrompt + '\n' : ''}
${genre ? 'Genre: ' + genre : ''}
${synopsis ? 'Synopsis: ' + synopsis : ''}

Return ONLY valid JSON with this structure:
{
  "scenes": [
    { "title": "Scene title", "beat": "beat_type", "purpose": "why this scene exists", "estimated_words": 400, "elements": ["technique1", "technique2"] }
  ],
  "opening_hook": "A suggested compelling first line",
  "closing_hook": "A suggested last line that makes readers turn the page",
  "pacing_notes": "Brief note on overall chapter rhythm and how it fits the story arc"
}`;

      let userPrompt = `Chapter Brief: ${brief}\n\n`;

      if (previousChapters && previousChapters.length > 0) {
        userPrompt += '--- PREVIOUS CHAPTERS (for continuity) ---\n';
        for (const ch of previousChapters.slice(-3)) {
          const plain = ch.content.replace(/<[^>]+>/g, '').trim();
          userPrompt += `\nChapter "${ch.title}" (last 1500 chars):\n${plain.slice(-1500)}\n`;
        }
        userPrompt += '\n';
      }

      if (worldBible && worldBible.length > 0) {
        userPrompt += '--- WORLD BIBLE ENTRIES ---\n';
        for (const entry of worldBible.slice(0, 15)) {
          userPrompt += `[${entry.category}] ${entry.name}: ${entry.notes || Object.values(entry.fields || {}).filter(Boolean).join(', ')}\n`;
        }
        userPrompt += '\n';
      }

      userPrompt += 'Design the scene structure for this chapter. Ensure it flows naturally from previous chapters and builds engagement.';

      const content = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { ...opts, temperature: 0.7 });

      let parsed;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        parsed = null;
      }

      return new Response(JSON.stringify({ outline: parsed, raw: parsed ? undefined : content }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    if (action === 'draft') {
      if (!outline || !outline.scenes) {
        return new Response(JSON.stringify({ error: 'Outline with scenes is required for drafting' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const systemPrompt = `You are a master fiction author writing a chapter of a novel. You write with the skill of a published fantasy author.

CRAFT RULES (follow ALL of these):
- Vary sentence length for rhythm: short punchy sentences for tension, longer flowing ones for atmosphere
- SHOW don't tell emotions: "His hands trembled" not "He was scared"
- Ground every scene in at least 2 sensory details (sight + sound/touch/smell)
- Write dialogue that reveals character: each person speaks differently
- Use subtext in dialogue: what characters DON'T say matters
- End the chapter on a moment of tension, revelation, or emotional shift
- NEVER summarize events: dramatize every single beat with real-time action
- Use paragraph breaks for pacing: short paragraphs = fast pace, longer = contemplation
- Include internal monologue sparingly but powerfully
- Make transitions between scenes smooth: bridge with sensory detail or character thought
- Every scene must advance plot OR deepen character (preferably both)
- Avoid cliches: find fresh metaphors rooted in the world

${voicePrompt ? '--- AUTHOR VOICE PROFILE (match this EXACTLY) ---\n' + voicePrompt + '\n' : ''}
${genre ? 'Genre: ' + genre + '\n' : ''}

STRUCTURE: Follow the scene outline below precisely. Write ~500-800 words per scene.
Do NOT add scene headers or markers in the text. Use natural prose transitions between scenes.
Output the chapter as continuous narrative prose only. No meta-commentary.`;

      let userPrompt = `CHAPTER BRIEF: ${brief}\n\n`;
      userPrompt += `SCENE OUTLINE:\n`;
      for (let i = 0; i < outline.scenes.length; i++) {
        const s = outline.scenes[i];
        userPrompt += `  Scene ${i + 1}: "${s.title}" [beat: ${s.beat}]\n    Purpose: ${s.purpose}\n    Elements: ${(s.elements || []).join(', ')}\n    Target: ~${s.estimated_words} words\n\n`;
      }

      if (outline.opening_hook) userPrompt += `SUGGESTED OPENING: ${outline.opening_hook}\n`;
      if (outline.closing_hook) userPrompt += `SUGGESTED CLOSING: ${outline.closing_hook}\n\n`;

      if (previousChapters && previousChapters.length > 0) {
        userPrompt += '--- PREVIOUS CHAPTERS (maintain continuity) ---\n';
        for (const ch of previousChapters.slice(-2)) {
          const plain = ch.content.replace(/<[^>]+>/g, '').trim();
          userPrompt += `\nChapter "${ch.title}":\n${plain.slice(-2000)}\n`;
        }
        userPrompt += '\n';
      }

      if (worldBible && worldBible.length > 0) {
        userPrompt += '--- WORLD BIBLE (use these details accurately) ---\n';
        for (const entry of worldBible.slice(0, 10)) {
          userPrompt += `[${entry.category}] ${entry.name}: ${entry.notes || Object.values(entry.fields || {}).filter(Boolean).join(', ')}\n`;
        }
        userPrompt += '\n';
      }

      userPrompt += 'Now write the complete chapter as continuous prose. Follow the scene structure exactly. Match the author voice profile precisely.';

      const content = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], { ...opts, temperature: 0.8 });

      return new Response(JSON.stringify({ chapter: content }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action: ' + action }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Architect error:', message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
