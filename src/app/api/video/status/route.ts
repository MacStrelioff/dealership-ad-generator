import { NextRequest, NextResponse } from 'next/server';

// Check video generation status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const model = searchParams.get('model') || 'sora-2-text-to-video';

    if (!id) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'VENICE_API_KEY is not configured' }, { status: 500 });
    }

    // Check video status with Venice API
    const response = await fetch('https://api.venice.ai/api/v1/video/retrieve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        queue_id: id,
        model: model,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Venice video status error:', errorText);
      return NextResponse.json(
        { error: `Failed to check video status: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || '';
    
    // If the response is a video file, the video is ready
    if (contentType.includes('video/')) {
      // The video is ready - we need to get a URL for it
      // Since Venice returns the video directly, we'll convert it to a data URL
      // or store it and return a URL. For now, let's create a blob URL approach
      // by returning the video data as base64
      const videoBuffer = await response.arrayBuffer();
      const base64Video = Buffer.from(videoBuffer).toString('base64');
      const videoUrl = `data:${contentType};base64,${base64Video}`;
      
      return NextResponse.json({
        id: id,
        status: 'completed',
        videoUrl: videoUrl,
      });
    }

    // Otherwise, parse as JSON for status
    const data = await response.json();
    
    // Map Venice API response to our format
    let status: 'queued' | 'processing' | 'completed' | 'failed' = 'processing';
    if (data.status === 'COMPLETED' || data.status === 'completed' || data.status === 'complete') {
      status = 'completed';
    } else if (data.status === 'FAILED' || data.status === 'failed' || data.status === 'error') {
      status = 'failed';
    } else if (data.status === 'QUEUED' || data.status === 'queued' || data.status === 'pending') {
      status = 'queued';
    } else if (data.status === 'PROCESSING' || data.status === 'processing') {
      status = 'processing';
    }

    return NextResponse.json({
      id: data.id || id,
      status,
      videoUrl: data.url || data.video_url || data.output?.url,
      error: data.error,
    });
  } catch (error) {
    console.error('Video status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check video status' },
      { status: 500 }
    );
  }
}
