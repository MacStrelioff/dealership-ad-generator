import { NextRequest, NextResponse } from 'next/server';
import { Vehicle, AdScript, AdType } from '@/types';

const AD_TYPE_PROMPTS: Record<AdType, { name: string; instructions: string }> = {
  video_youtube: {
    name: 'YouTube Video Ad',
    instructions: 'Write a 30-second YouTube pre-roll video ad script. Include visual directions in [brackets]. Hook viewers in the first 5 seconds.',
  },
  video_tiktok: {
    name: 'TikTok/Reels Video',
    instructions: 'Write a 15-second TikTok/Instagram Reels script. Make it trendy, fast-paced, and engaging. Include visual/action cues.',
  },
  radio_30sec: {
    name: '30-Second Radio Spot',
    instructions: 'Write a 30-second radio ad (approximately 75 words). Focus on audio-only appeal. Include clear call to action.',
  },
  radio_60sec: {
    name: '60-Second Radio Spot',
    instructions: 'Write a 60-second radio ad (approximately 150 words). Tell a story, build desire, include testimonial-style language.',
  },
  facebook: {
    name: 'Facebook Ad',
    instructions: 'Write Facebook ad copy with: attention-grabbing headline, 2-3 sentence body, and clear CTA. Optimize for engagement.',
  },
  instagram: {
    name: 'Instagram Post',
    instructions: 'Write Instagram caption with emojis, hashtags, and engaging hook. Keep it visual-focused and lifestyle-oriented.',
  },
  email: {
    name: 'Sales Email',
    instructions: 'Write a sales email with compelling subject line, personalized greeting, 3 key selling points, and soft CTA.',
  },
};

const AUDIENCES = [
  { name: 'First-Time Buyers', description: 'Young adults buying their first car, value-conscious, need guidance' },
  { name: 'Families', description: 'Parents with kids, prioritize safety, space, and reliability' },
  { name: 'Truck Enthusiasts', description: 'People who need capability, towing, and rugged features' },
  { name: 'Luxury Seekers', description: 'Buyers wanting premium features, status, and comfort' },
  { name: 'Budget Conscious', description: 'Shoppers focused on value, low payments, and fuel efficiency' },
];

function buildVehicleDescription(vehicle: Vehicle): string {
  const parts = [
    `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
    vehicle.trim && `${vehicle.trim} trim`,
    vehicle.price && `priced at ${vehicle.price}`,
    vehicle.mileage && `with ${vehicle.mileage}`,
    vehicle.exteriorColor && `in ${vehicle.exteriorColor}`,
    vehicle.engine && `featuring a ${vehicle.engine} engine`,
    vehicle.transmission && `${vehicle.transmission} transmission`,
    vehicle.drivetrain && `${vehicle.drivetrain}`,
    vehicle.features?.length && `Key features: ${vehicle.features.join(', ')}`,
    vehicle.description && `Additional details: ${vehicle.description}`,
  ].filter(Boolean);

  return parts.join('. ');
}

async function generateWithVenice(prompt: string): Promise<string> {
  const apiKey = process.env.VENICE_API_KEY;
  
  if (!apiKey) {
    throw new Error('VENICE_API_KEY is not configured');
  }

  const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b',
      messages: [
        {
          role: 'system',
          content: `You are an expert automotive advertising copywriter with 20 years of experience writing compelling car dealership ads. You understand what makes people want to buy cars and how to create urgency without being pushy. Your scripts are creative, memorable, and drive action.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.8,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Venice API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function POST(request: NextRequest) {
  try {
    const { vehicle, dealershipName, adTypes } = await request.json();

    if (!vehicle || !dealershipName || !adTypes?.length) {
      return NextResponse.json(
        { error: 'Vehicle, dealership name, and ad types are required' },
        { status: 400 }
      );
    }

    const vehicleDescription = buildVehicleDescription(vehicle);
    const scripts: AdScript[] = [];

    // Generate 5 scripts with different audience/type combinations
    const scriptsToGenerate = Math.min(5, adTypes.length * AUDIENCES.length);
    const combinations: { adType: AdType; audience: typeof AUDIENCES[0] }[] = [];

    // Create combinations of ad types and audiences
    for (const adType of adTypes) {
      for (const audience of AUDIENCES) {
        combinations.push({ adType, audience });
      }
    }

    // Shuffle and take first 5
    const shuffled = combinations.sort(() => Math.random() - 0.5).slice(0, scriptsToGenerate);

    // Generate scripts in parallel (but limit concurrency)
    const generateScript = async (combo: typeof shuffled[0]): Promise<AdScript> => {
      const { adType, audience } = combo;
      const adTypeInfo = AD_TYPE_PROMPTS[adType];

      const prompt = `
Create a ${adTypeInfo.name} for the following vehicle:

VEHICLE: ${vehicleDescription}

DEALERSHIP: ${dealershipName}

TARGET AUDIENCE: ${audience.name} - ${audience.description}

INSTRUCTIONS: ${adTypeInfo.instructions}

Write a compelling, unique ad that speaks directly to this audience. Make it memorable and action-oriented.

Respond with ONLY the ad script, no additional commentary or explanations.
`;

      const script = await generateWithVenice(prompt);

      return {
        type: adType,
        title: `${adTypeInfo.name} for ${audience.name}`,
        script: script.trim(),
        targetAudience: audience.name,
        tone: audience.name === 'Luxury Seekers' ? 'Premium & Sophisticated' : 
              audience.name === 'Truck Enthusiasts' ? 'Bold & Capable' :
              audience.name === 'Families' ? 'Warm & Trustworthy' :
              audience.name === 'First-Time Buyers' ? 'Friendly & Helpful' : 'Value-Focused',
        callToAction: `Visit ${dealershipName} today!`,
      };
    };

    // Generate all scripts (with some concurrency control)
    const results = await Promise.all(shuffled.map(generateScript));
    scripts.push(...results);

    return NextResponse.json({
      scripts,
      vehicle,
    });
  } catch (error) {
    console.error('Generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate scripts' },
      { status: 500 }
    );
  }
}
