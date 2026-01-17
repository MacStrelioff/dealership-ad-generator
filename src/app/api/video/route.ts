import { NextRequest, NextResponse } from 'next/server';

// Video models available on Venice (text-to-video)
const VIDEO_MODELS = [
  { id: 'sora-2-text-to-video', name: 'Sora 2', description: 'OpenAI Sora 2 - High quality video generation' },
  { id: 'kling-2.6-pro-text-to-video', name: 'Kling 2.6 Pro', description: 'High quality, professional video generation' },
];

// Queue a video generation
export async function POST(request: NextRequest) {
  try {
    const { prompt, model, duration, aspect_ratio } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'VENICE_API_KEY is not configured' }, { status: 500 });
    }

    const selectedModel = model || 'sora-2-text-to-video';
    const selectedDuration = duration || '4s';
    const selectedAspectRatio = aspect_ratio || '16:9';

    console.log('Queueing video generation with model:', selectedModel);

    // Queue video generation with Venice API
    const response = await fetch('https://api.venice.ai/api/v1/video/queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        prompt: prompt,
        duration: selectedDuration,
        aspect_ratio: selectedAspectRatio,
      }),
    });

    const responseText = await response.text();
    console.log('Venice API response:', response.status, responseText);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Video generation failed: ${response.status} - ${responseText}` },
        { status: response.status }
      );
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      return NextResponse.json(
        { error: `Invalid response from Venice API: ${responseText}` },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      id: data.queue_id || data.id,
      status: 'queued',
    });
  } catch (error) {
    console.error('Video generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to queue video generation' },
      { status: 500 }
    );
  }
}

// Get available video models
export async function GET() {
  return NextResponse.json({ models: VIDEO_MODELS });
}
