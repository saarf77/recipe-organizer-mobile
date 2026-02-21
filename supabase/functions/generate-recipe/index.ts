/**
 * Supabase Edge Function: generate-recipe
 *
 * Two modes:
 *  - Text mode:  { ingredients: string[] }
 *  - Vision mode: { image_base64: string, mime_type?: string }
 *
 * Text mode uses Groq llama-3.1-8b-instant (fast, free).
 * Vision mode uses Groq llama-3.2-11b-vision-preview to identify fridge
 * contents and generate a recipe in one shot.
 *
 * Set GROQ_API_KEY in Supabase secrets (free at console.groq.com).
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEXT_MODEL = 'llama-3.1-8b-instant';
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const JSON_SHAPE = `{
  "title": string,
  "description": string,
  "difficulty": "easy" | "medium" | "hard",
  "prep_time_minutes": number | null,
  "cook_time_minutes": number | null,
  "servings": number,
  "cuisine": string | null,
  "category": string | null,
  "tags": string[],
  "ingredients": [{ "name": string, "quantity": string | null, "unit": string | null }],
  "steps": string[]
}`;

const RULES = `Rules:
- Use realistic, household-friendly quantities
- Keep instructions clear and concise
- servings should be between 2 and 6
- tags can include dietary labels (vegan, vegetarian, gluten-free), meal type
- Respond ONLY with the JSON object, nothing else — no markdown, no code blocks`;

const SYSTEM_PROMPT = `You are a professional chef and recipe writer.
Given a list of available ingredients, create ONE practical, delicious recipe that uses primarily those ingredients.
You MUST respond with valid JSON only matching this exact shape:\n${JSON_SHAPE}\n${RULES}`;

const VISION_PROMPT = `Look at this photo of a fridge or pantry and identify all the visible food ingredients.
Then create ONE practical, delicious recipe using those ingredients.
You MUST respond with valid JSON only matching this exact shape:\n${JSON_SHAPE}\n${RULES}`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get('GROQ_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GROQ_API_KEY not set. Get a free key at console.groq.com' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json() as {
      ingredients?: string[];
      image_base64?: string;
      mime_type?: string;
    };

    let groqBody: unknown;

    if (body.image_base64) {
      // ── Vision mode ──────────────────────────────────────────────────────────
      const mimeType = body.mime_type ?? 'image/jpeg';
      groqBody = {
        model: VISION_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${body.image_base64}` },
              },
              { type: 'text', text: VISION_PROMPT },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      };
    } else if (body.ingredients?.length) {
      // ── Text mode ─────────────────────────────────────────────────────────────
      const list = body.ingredients.map((i: string) => `- ${i}`).join('\n');
      groqBody = {
        model: TEXT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `I have these ingredients:\n${list}\n\nPlease suggest a recipe.` },
        ],
        max_tokens: 1500,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      };
    } else {
      return new Response(
        JSON.stringify({ error: 'Provide either an ingredients array or an image_base64 string' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const groqRes = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(groqBody),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      return new Response(
        JSON.stringify({ error: `Groq error: ${errText}` }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const groqData = await groqRes.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = groqData.choices?.[0]?.message?.content ?? '{}';

    // Strip markdown code fences if the model wrapped its output
    const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});
