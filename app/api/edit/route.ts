import { NextRequest, NextResponse } from 'next/server';

const HF_MODELS = {
  remix: 'https://api-inference.huggingface.co/models/timbrooks/instruct-pix2pix',
  background: 'https://api-inference.huggingface.co/models/briaai/RMBG-1.4'
} as const;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface RequestPayload {
  image?: string;
  prompt?: string;
  apiKey?: string;
  guidance?: number;
  mode?: keyof typeof HF_MODELS;
}

function sanitizeDataUrl(dataUrl: string | undefined) {
  if (!dataUrl) return null;
  if (!dataUrl.startsWith('data:image')) return null;
  const [, base64] = dataUrl.split(',');
  return base64 ?? null;
}

export async function POST(request: NextRequest) {
  let payload: RequestPayload;

  try {
    payload = (await request.json()) as RequestPayload;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const { image, prompt, apiKey, guidance = 1.5, mode = 'remix' } = payload;

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing Hugging Face API token.' }, { status: 401 });
  }

  if (!HF_MODELS[mode]) {
    return NextResponse.json({ error: `Unsupported mode: ${mode}` }, { status: 400 });
  }

  if (mode === 'remix' && (!prompt || !prompt.trim())) {
    return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
  }

  const base64Image = sanitizeDataUrl(image);
  if (!base64Image) {
    return NextResponse.json({ error: 'Image data is missing or invalid.' }, { status: 400 });
  }

  try {
    const targetUrl = HF_MODELS[mode];
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'image/png'
    };

    let body: BodyInit;
    if (mode === 'remix') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({
        inputs: prompt,
        image: base64Image,
        image_guidance_scale: guidance
      });
    } else {
      headers['Content-Type'] = 'application/octet-stream';
      body = Buffer.from(base64Image, 'base64');
    }

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message =
        typeof errorBody.error === 'string'
          ? errorBody.error
          : `Inference request failed (${response.status}).`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const result = `data:image/png;base64,${buffer.toString('base64')}`;
    return NextResponse.json({ image: result });
  } catch (error) {
    console.error('AI edit failed', error);
    return NextResponse.json({ error: 'Failed to reach the inference endpoint.' }, { status: 500 });
  }
}
