export interface Vehicle {
  id: string;
  year: string;
  make: string;
  model: string;
  trim?: string;
  price?: string;
  mileage?: string;
  exteriorColor?: string;
  interiorColor?: string;
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  fuelType?: string;
  vin?: string;
  stockNumber?: string;
  imageUrl?: string;
  detailUrl?: string;
  features?: string[];
  description?: string;
}

export interface ScrapedInventory {
  dealershipName: string;
  dealershipUrl: string;
  vehicles: Vehicle[];
  scrapedAt: string;
}

export type AdType = 
  | 'video_youtube'
  | 'video_tiktok'
  | 'radio_30sec'
  | 'radio_60sec'
  | 'facebook'
  | 'instagram'
  | 'email';

export interface AdScript {
  type: AdType;
  title: string;
  script: string;
  targetAudience: string;
  tone: string;
  callToAction: string;
}

export interface GenerateScriptsRequest {
  vehicle: Vehicle;
  dealershipName: string;
  adTypes: AdType[];
  targetAudiences?: string[];
  brandVoice?: string;
}

export interface GenerateScriptsResponse {
  scripts: AdScript[];
  vehicle: Vehicle;
}

// Video Generation Types
export type VideoModel = 
  | 'wan-21-t2v-13b'
  | 'kling-2.1-pro'
  | 'veo-2'
  | 'minimax-video-01';

export interface VideoModelInfo {
  id: VideoModel;
  name: string;
  description: string;
  duration: string;
  isPrivate: boolean;
}

export interface VideoGenerateRequest {
  prompt: string;
  model: VideoModel;
  duration?: number;
}

export interface VideoGenerateResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

export interface VideoStatusResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}
