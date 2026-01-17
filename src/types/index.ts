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
