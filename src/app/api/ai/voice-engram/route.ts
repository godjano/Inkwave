import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chapters, apiKey, provider, model } = body;

    if (!chapters || !Array.isArray(chapters) || chapters.length === 0) {
      return new Response(JSON.stringify({ error: 'Chapters array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const samples = chapters
      .slice(0, 4)
      .map((ch: { title: string; content: string }) => {
        const plain = ch.content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
        return `## ${ch.title}\n${plain.slice(0, 1500)}`;
      })
      .join('\n\n---\n\n');

    const systemPrompt = `You are a literary style analyst. Analyze the writing samples and extract the author's unique voice characteristics. Return ONLY valid JSON with this exact structure:
{
  "tone": "description of overall tone and mood",
  "povStyle": "point of view and narrative distance",
  "imageryPreferences": "what kinds of imagery and metaphors they favor",
  "pacingPattern": "how they handle pacing, scene transitions, buildup",
  "dialogueStyle": "how they write dialogue (or if sparse, note that)",
  "uniqueFingerprints": ["trait1", "trait2", "trait3"],
  "summary": "A 2-3 sentence summary of this author's voice that could be used as a writing instruction"
}`;

    const userPrompt = `Analyze these writing samples and extract the author's unique voice fingerprint:\n\n${samples}`;

    const content = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.3, max_tokens: 1000, apiKey, provider, model },
    );

    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      analysis = { summary: content, tone: '', povStyle: '', imageryPreferences: '', pacingPattern: '', dialogueStyle: '', uniqueFingerprints: [] };
    }

    return new Response(JSON.stringify({ analysis }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Voice Engram error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
