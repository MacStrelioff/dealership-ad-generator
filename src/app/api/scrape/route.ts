import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { Vehicle, ScrapedInventory } from '@/types';

// Helper to extract vehicle data from common dealership website patterns
function extractVehicles($: cheerio.CheerioAPI, baseUrl: string): Vehicle[] {
  const vehicles: Vehicle[] = [];
  
  // Common selectors for vehicle listings across different dealership platforms
  const selectors = [
    // DealerCarSearch / Spotlight carousel (used by johnsautosales.com and similar)
    '.rspotlightItem',
    '.spotlightItem',
    // DealerSocket / common patterns
    '.vehicle-card',
    '.inventory-listing',
    '.srp-list-item',
    '[data-vehicle]',
    '.vehicle-item',
    '.inventory-item',
    '.vehicle-listing',
    // CarGurus dealer sites
    '.listing-row',
    // Dealer.com
    '.hproduct',
    // Generic patterns
    'article[class*="vehicle"]',
    'div[class*="vehicle-card"]',
    'li[class*="vehicle"]',
  ];

  let vehicleElements: ReturnType<typeof $> | null = null;
  
  for (const selector of selectors) {
    const found = $(selector);
    if (found.length > 0) {
      vehicleElements = found;
      break;
    }
  }

  // If no specific vehicle containers found, try to find links to vehicle detail pages
  if (!vehicleElements || vehicleElements.length === 0) {
    // Look for links that look like vehicle detail pages
    $('a[href*="/vehicle/"], a[href*="/inventory/"], a[href*="/used/"], a[href*="/new/"], a[href*="/car/"], a[href*="vin="], a[href*="stock"]').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const text = $el.text().trim();
      
      // Try to parse year make model from link text or nearby content
      const yearMatch = text.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        const vehicle = parseVehicleFromText(text, href, baseUrl);
        if (vehicle) {
          vehicles.push(vehicle);
        }
      }
    });
    
    // If still no vehicles, try to find headings with years (common pattern for car listings)
    if (vehicles.length === 0) {
      $('h2, h3, h4, h5, .vehicle-title, [class*="title"]').each((index, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        const yearMatch = text.match(/\b(19|20)\d{2}\b/);
        
        if (yearMatch) {
          // Look for price nearby
          const parent = $el.parent();
          const parentText = parent.text();
          const priceMatch = parentText.match(/\$[\d,]+/);
          
          // Look for a link
          const link = parent.find('a').first();
          let detailUrl = link.attr('href') || '';
          if (detailUrl && !detailUrl.startsWith('http')) {
            try {
              detailUrl = new URL(detailUrl, baseUrl).href;
            } catch {
              detailUrl = '';
            }
          }
          
          // Get sibling text for model info
          const nextEl = $el.next();
          const modelText = nextEl.length ? nextEl.text().trim() : '';
          const combinedText = `${text} ${modelText}`;
          
          const { make, model, trim } = parseMakeModel(combinedText, yearMatch[0]);
          
          vehicles.push({
            id: `vehicle-${index}`,
            year: yearMatch[0],
            make,
            model,
            trim,
            price: priceMatch ? priceMatch[0] : undefined,
            detailUrl: detailUrl || undefined,
          });
        }
      });
    }
    
    return deduplicateVehicles(vehicles);
  }

  vehicleElements.each((index, element) => {
    const $el = $(element);
    const vehicle = extractVehicleData($, $el, baseUrl, index);
    if (vehicle) {
      vehicles.push(vehicle);
    }
  });

  return deduplicateVehicles(vehicles);
}

function extractVehicleData(
  $: cheerio.CheerioAPI, 
  $el: ReturnType<typeof $>, 
  baseUrl: string,
  index: number
): Vehicle | null {
  // Try to get the full text content
  const fullText = $el.text().replace(/\s+/g, ' ').trim();
  
  // Check for DealerCarSearch spotlight format first (e.g., johnsautosales.com)
  const yearMakeEl = $el.find('.vehicle-year-make, h3.vehicle-year-make');
  const modelTrimEl = $el.find('.vehicle-model-trim, h5.vehicle-model-trim');
  const priceEl = $el.find('.vehiclePrice, h4.vehiclePrice');
  
  if (yearMakeEl.length > 0) {
    // DealerCarSearch format: "2019 Audi" in h3, "Q5" in h5
    const yearMakeText = yearMakeEl.text().trim();
    const modelTrimText = modelTrimEl.length ? modelTrimEl.text().trim() : '';
    const priceText = priceEl.length ? priceEl.text().trim() : '';
    
    const yearMatch = yearMakeText.match(/\b(19|20)\d{2}\b/);
    if (!yearMatch) return null;
    
    const year = yearMatch[0];
    const makeText = yearMakeText.replace(year, '').trim();
    
    // Get image - prioritize data-src for lazy-loaded images
    const img = $el.find('img').first();
    let imageUrl = img.attr('data-src') || img.attr('data-lazy-src') || img.attr('src');
    // Skip placeholder SVG data URLs
    if (imageUrl && imageUrl.startsWith('data:')) {
      imageUrl = img.attr('data-src') || img.attr('data-lazy-src') || undefined;
    }
    if (imageUrl && !imageUrl.startsWith('http')) {
      try {
        imageUrl = new URL(imageUrl, baseUrl).href;
      } catch {
        imageUrl = undefined;
      }
    }
    
    // Get detail URL from link
    const link = $el.find('a[href*="/vdp/"], a[href*="/vehicle/"], a[href*="/inventory/"]').first();
    let detailUrl = link.attr('href');
    if (detailUrl && !detailUrl.startsWith('http')) {
      try {
        detailUrl = new URL(detailUrl, baseUrl).href;
      } catch {
        detailUrl = undefined;
      }
    }
    
    // Extract VIN from URL if present
    const vinMatch = (detailUrl || '').match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    const vin = vinMatch ? vinMatch[0] : undefined;
    
    // Extract stock/vehicle ID from URL
    const stockMatch = (detailUrl || '').match(/\/vdp\/(\d+)/);
    const stockNumber = stockMatch ? stockMatch[1] : undefined;
    
    return {
      id: vin || stockNumber || `vehicle-${index}`,
      year,
      make: makeText || 'Unknown',
      model: modelTrimText.split(' ')[0] || 'Unknown',
      trim: modelTrimText.split(' ').slice(1).join(' ') || undefined,
      price: priceText.match(/\$[\d,]+/)?.[0] || undefined,
      imageUrl,
      detailUrl,
      vin,
      stockNumber,
    };
  }
  
  // Extract year
  const yearMatch = fullText.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : '';
  
  if (!year) return null;

  // Try to find make/model from title or heading elements
  const titleEl = $el.find('h2, h3, h4, .title, .vehicle-title, [class*="title"]').first();
  const titleText = titleEl.length ? titleEl.text().trim() : '';
  
  // Parse make and model from title or full text
  const makeModelText = titleText || fullText;
  const { make, model, trim } = parseMakeModel(makeModelText, year);

  // Extract price
  const priceMatch = fullText.match(/\$[\d,]+/);
  const price = priceMatch ? priceMatch[0] : undefined;

  // Extract mileage
  const mileageMatch = fullText.match(/([\d,]+)\s*(mi|miles|k\s*miles)/i);
  const mileage = mileageMatch ? mileageMatch[1] + ' miles' : undefined;

  // Get image
  const img = $el.find('img').first();
  let imageUrl = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src');
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = new URL(imageUrl, baseUrl).href;
  }

  // Get detail URL
  const link = $el.find('a').first();
  let detailUrl = link.attr('href');
  if (detailUrl && !detailUrl.startsWith('http')) {
    detailUrl = new URL(detailUrl, baseUrl).href;
  }

  // Extract VIN if present
  const vinMatch = fullText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  const vin = vinMatch ? vinMatch[0] : undefined;

  // Extract stock number
  const stockMatch = fullText.match(/(?:stock|stk)[#:\s]*([A-Z0-9-]+)/i);
  const stockNumber = stockMatch ? stockMatch[1] : undefined;

  return {
    id: vin || stockNumber || `vehicle-${index}`,
    year,
    make,
    model,
    trim,
    price,
    mileage,
    imageUrl,
    detailUrl,
    vin,
    stockNumber,
  };
}

function parseVehicleFromText(text: string, href: string, baseUrl: string): Vehicle | null {
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return null;
  
  const year = yearMatch[0];
  const { make, model, trim } = parseMakeModel(text, year);
  
  let detailUrl = href;
  if (!detailUrl.startsWith('http')) {
    detailUrl = new URL(detailUrl, baseUrl).href;
  }

  return {
    id: `vehicle-${Math.random().toString(36).substr(2, 9)}`,
    year,
    make,
    model,
    trim,
    detailUrl,
  };
}

function parseMakeModel(text: string, year: string): { make: string; model: string; trim?: string } {
  // Common makes to look for
  const makes = [
    'Acura', 'Alfa Romeo', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chevy',
    'Chrysler', 'Dodge', 'Ferrari', 'Fiat', 'Ford', 'Genesis', 'GMC', 'Honda',
    'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Lamborghini', 'Land Rover',
    'Lexus', 'Lincoln', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'Mercedes',
    'Mini', 'Mitsubishi', 'Nissan', 'Porsche', 'Ram', 'Rolls-Royce', 'Subaru',
    'Tesla', 'Toyota', 'Volkswagen', 'VW', 'Volvo'
  ];

  // Clean up text - remove year and extra spaces
  let cleanText = text.replace(year, '').replace(/\s+/g, ' ').trim();
  
  let make = '';
  let model = '';
  let trim = '';

  // Find make
  for (const m of makes) {
    const regex = new RegExp(`\\b${m}\\b`, 'i');
    if (regex.test(cleanText)) {
      make = m;
      cleanText = cleanText.replace(regex, '').trim();
      break;
    }
  }

  // The remaining text is likely model and trim
  const parts = cleanText.split(/\s+/).filter(p => p.length > 0);
  if (parts.length > 0) {
    model = parts[0];
    if (parts.length > 1) {
      trim = parts.slice(1).join(' ');
    }
  }

  return { make: make || 'Unknown', model: model || 'Unknown', trim };
}

function deduplicateVehicles(vehicles: Vehicle[]): Vehicle[] {
  const seen = new Set<string>();
  return vehicles.filter(v => {
    const key = `${v.year}-${v.make}-${v.model}-${v.vin || v.stockNumber || v.detailUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractDealershipName($: cheerio.CheerioAPI, url: string): string {
  // Try various methods to find dealership name
  const possibilities = [
    $('meta[property="og:site_name"]').attr('content'),
    $('meta[name="author"]').attr('content'),
    // Look for dealership name in meta description (often contains "John's Auto Sales" etc)
    (() => {
      const desc = $('meta[name="description"]').attr('content') || '';
      const match = desc.match(/([A-Z][a-z']+(?:\s+[A-Z][a-z']+)*(?:\s+Auto\s+Sales|\s+Motors|\s+Automotive|\s+Auto))/);
      return match ? match[1] : null;
    })(),
    // Look in keywords meta tag
    (() => {
      const keywords = $('meta[name="keywords"]').attr('content') || '';
      const match = keywords.match(/([A-Z][a-z']+(?:'s)?(?:\s+[A-Z][a-z']+)*\s+(?:Auto\s+Sales|Motors|Automotive))/);
      return match ? match[1] : null;
    })(),
    // Look for logo alt text or image title
    $('img[alt*="Auto"], img[alt*="Motors"], img[alt*="Dealer"]').first().attr('alt'),
    $('.dealer-name, .dealership-name, [class*="dealer-name"]').first().text().trim(),
    $('header h1, header .logo-text').first().text().trim(),
    // Title is often generic SEO text, try it last
    $('title').text().split('|')[0].split('-')[0].trim(),
  ];

  for (const name of possibilities) {
    if (name && name.length > 2 && name.length < 100) {
      // Filter out generic SEO titles
      const genericPatterns = [
        /large inventory/i,
        /used cars for sale/i,
        /reliable used cars/i,
        /buy here pay here/i,
      ];
      const isGeneric = genericPatterns.some(pattern => pattern.test(name));
      if (!isGeneric) {
        return name;
      }
    }
  }

  // Fall back to domain name, but try to make it readable
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    const baseName = domain.split('.')[0];
    // Convert "johnsautosales" to "Johns Auto Sales"
    const readable = baseName
      .replace(/autosales/i, ' Auto Sales')
      .replace(/motors/i, ' Motors')
      .replace(/auto$/i, ' Auto')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .trim();
    return readable.charAt(0).toUpperCase() + readable.slice(1);
  } catch {
    return 'Dealership';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let validUrl: URL;
    try {
      validUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL provided' }, { status: 400 });
    }

    // Fetch the page
    const response = await fetch(validUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${response.status}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const dealershipName = extractDealershipName($, url);
    const vehicles = extractVehicles($, validUrl.origin);

    const result: ScrapedInventory = {
      dealershipName,
      dealershipUrl: url,
      vehicles,
      scrapedAt: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape inventory. The website may be blocking automated access.' },
      { status: 500 }
    );
  }
}
