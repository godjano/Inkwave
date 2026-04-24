import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/ai-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, temperature = 0.7, apiKey, provider, model } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const content = await chatCompletion(messages, { temperature, max_tokens: 2048, apiKey, provider, model });

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown AI error';
    console.error('AI Chat error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
