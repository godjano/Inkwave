import { getAiStatus } from '@/lib/ai-client';

export async function GET() {
  const status = getAiStatus();
  return new Response(
    JSON.stringify(status),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
