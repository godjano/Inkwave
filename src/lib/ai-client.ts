/**
 * AI client — works with both server-side env vars AND client-provided API keys.
 *
 * Supports multiple AI providers through a unified OpenAI-compatible interface.
 * The API key can come from:
 *   1. Environment variables (server-side, for Vercel)
 *   2. Client-provided key passed in request body (stored in browser localStorage)
 *
 * Supported providers:
 *   - openrouter  (https://openrouter.ai — free tier available)
 *   - groq       (https://groq.com — free tier, very fast)
 *   - openai     (https://openai.com — paid)
 *   - zai        (local dev — internal endpoint)
 *   - custom     (any OpenAI-compatible endpoint)
 */

// ── Types ──

type Provider = 'zai' | 'openrouter' | 'groq' | 'openai' | 'custom';

interface ProviderDefaults {
  baseUrl: string;
  model: string;
}

const PROVIDER_DEFAULTS: Record<Provider, ProviderDefaults> = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemma-3-27b-it:free',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  zai: {
    baseUrl: 'http://172.25.136.193:8080/v1',
    model: 'default',
  },
  custom: {
    baseUrl: '',
    model: '',
  },
};

// ── Build provider config from explicit key/provider ──

export function buildProviderConfig(
  apiKey: string,
  provider: Provider = 'openrouter',
  model?: string,
): { baseUrl: string; headers: Record<string, string>; model: string } {
  const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openrouter;
  const baseUrl = defaults.baseUrl;
  const selectedModel = model || defaults.model;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === 'zai') {
    headers['X-Z-AI-From'] = 'Z';
    const chatId = process.env.ZAI_CHAT_ID || '';
    const userId = process.env.ZAI_USER_ID || '';
    const token = process.env.ZAI_TOKEN || '';
    if (chatId) headers['X-Chat-Id'] = chatId;
    if (userId) headers['X-User-Id'] = userId;
    if (token) headers['X-Token'] = token;
  }

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://inkweave-nu.vercel.app';
    headers['X-Title'] = 'Inkweave - Fantasy Writing Studio';
  }

  return { baseUrl, headers, model: selectedModel };
}

// ── Chat completion using client-provided credentials ──

type ChatRole = 'system' | 'user' | 'assistant';

// Fallback models for OpenRouter free tier (verified available on OpenRouter)
// Primary model is passed from client; these are tried in order if it fails
const OPENROUTER_FALLBACKS = [
  'google/gemma-3-27b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'google/gemma-3-12b-it:free',
  'minimax/minimax-m2.5:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-4-26b-a4b-it:free',
];

export async function chatCompletion(
  messages: Array<{ role: string; content: string }>,
  opts?: { temperature?: number; max_tokens?: number; apiKey?: string; provider?: Provider; model?: string },
): Promise<string> {
  // Support both env-var-based and client-provided auth
  const apiKey = opts?.apiKey || process.env.AI_API_KEY || process.env.ZAI_API_KEY || '';
  const provider = opts?.provider || (process.env.AI_PROVIDER as Provider) || 'openrouter';

  if (!apiKey) {
    throw new Error('No API key provided. Please configure AI settings in the app.');
  }

  const requestedModel = opts?.model;
  const modelsToTry = provider === 'openrouter'
    ? [requestedModel, ...OPENROUTER_FALLBACKS].filter((m, i, a) => m && a.indexOf(m) === i)
    : [requestedModel];

  // Run up to 2 full passes through the model list before giving up
  const MAX_PASSES = 2;
  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    for (const model of modelsToTry) {
      if (!model) continue;

      const config = buildProviderConfig(apiKey, provider, model);
      const url = `${config.baseUrl}/chat/completions`;

      const body: Record<string, unknown> = {
        model,
        messages: messages.map((m) => ({ role: m.role as ChatRole, content: m.content })),
        temperature: opts?.temperature ?? 0.7,
        max_tokens: opts?.max_tokens ?? 2048,
      };

      if (provider === 'zai') {
        body.thinking = { type: 'disabled' };
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: config.headers,
          body: JSON.stringify(body),
        });

        if (response.status === 429) {
          // Rate limited — try next model silently
          console.log(`[ai-client] Model "${model}" rate-limited. Trying fallback... (pass ${pass}/${MAX_PASSES})`);
          await new Promise(r => setTimeout(r, 2000)); // wait before retry
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[ai-client] Model "${model}" error (${response.status}): ${errorText.slice(0, 100)}`);
          // For OpenRouter, always fallback on any error
          if (provider === 'openrouter') {
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          throw new Error(`AI API error (${response.status}): ${errorText.slice(0, 200)}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      } catch (err) {
        if (err instanceof Error) {
          console.warn(`[ai-client] Model "${model}" failed: ${err.message}`);
          // For OpenRouter, always try next model regardless of error type
          if (provider === 'openrouter') {
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          throw err;
        }
      }
    }

    // After first full pass, wait longer before retrying the entire chain
    if (pass < MAX_PASSES) {
      console.log(`[ai-client] All models failed on pass ${pass}. Waiting 5s and retrying...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  throw new Error('All free AI models are currently busy. Please wait a moment and try again.');
}

// ── Image generation ──

type ImageSize =
  | '1024x1024' | '768x1344' | '864x1152'
  | '1344x768' | '1152x864' | '1440x720' | '720x1440';

const DEFAULT_IMAGE_SIZE: ImageSize = '864x1152';
const VALID_SIZES: ImageSize[] = [
  '1024x1024', '768x1344', '864x1152',
  '1344x768', '1152x864', '1440x720', '720x1440',
];

export async function imageGeneration(
  prompt: string,
  size?: string,
  _opts?: { apiKey?: string; provider?: Provider; model?: string; seed?: string },
): Promise<string> {
  // Image generation via Pollinations.ai — free, no auth, works in serverless (Vercel)
  try {
    const s = VALID_SIZES.includes(size as ImageSize) ? (size as ImageSize) : DEFAULT_IMAGE_SIZE;
    const [width, height] = s.split('x').map(Number);
    const encodedPrompt = encodeURIComponent(prompt);
    const seedValue = _opts?.seed || String(Math.floor(Math.random() * 999999));
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=flux&nologo=true&enhance=true&seed=${seedValue}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Inkweave/1.0' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from image service`);
    }

    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
  } catch (err) {
    throw new Error(`Image generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Status check ──

export function getAiStatus(): { available: boolean; provider: string | null } {
  const apiKey = process.env.AI_API_KEY || process.env.ZAI_API_KEY || '';
  const provider = (process.env.AI_PROVIDER as Provider) || null;
  return { available: !!apiKey, provider };
}

// ── List supported providers (for UI) ──

export function getSupportedProviders(): Array<{ id: Provider; name: string; free: boolean; signupUrl: string }> {
  return [
    { id: 'openrouter', name: 'OpenRouter', free: true, signupUrl: 'https://openrouter.ai/keys' },
    { id: 'groq', name: 'Groq', free: true, signupUrl: 'https://console.groq.com/keys' },
    { id: 'openai', name: 'OpenAI', free: false, signupUrl: 'https://platform.openai.com/api-keys' },
  ];
}
