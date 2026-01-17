# Dealership Ad Generator - Setup Guide

## What This Does

This app lets you:
1. Enter a dealership website URL
2. Scrape their vehicle inventory
3. Select a vehicle
4. Generate 5 personalized ad scripts using Venice AI

## Quick Start

### 1. Install Dependencies
```bash
cd dealership-ad-generator
npm install
```

### 2. Set Up Venice AI API Key

Create a `.env.local` file in the project root:

```bash
# .env.local
VENICE_API_KEY=your_venice_api_key_here
```

**To get your Venice AI API key:**
1. Go to https://venice.ai
2. Sign in or create an account
3. Go to Settings → API
4. Generate a new API key
5. Copy it into your `.env.local` file

### 3. Run Locally
```bash
npm run dev
```

Then open http://localhost:3000

## Deploy to Vercel

### Option 1: Via Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option 2: Via GitHub
1. Push this repo to GitHub
2. Go to https://vercel.com
3. Import your GitHub repo
4. Add the environment variable:
   - Name: `VENICE_API_KEY`
   - Value: Your Venice AI API key
5. Deploy!

## How to Use

1. **Enter a dealership URL** - Use their inventory page URL for best results
   - Example: `https://www.dealership.com/inventory` or `https://www.dealership.com/used-cars`

2. **Wait for scraping** - The app will extract vehicle listings from the page

3. **Select a vehicle** - Click on any vehicle card to select it

4. **Choose ad types** - Pick which types of ads you want:
   - YouTube Video
   - TikTok/Reels
   - Radio (30s or 60s)
   - Facebook
   - Instagram
   - Sales Email

5. **Generate!** - Click the button to generate 5 unique ad scripts

6. **Copy & Use** - Each script has a copy button for easy use

## Troubleshooting

### "No vehicles found"
- Some dealership websites block scraping or use JavaScript-heavy frameworks
- Try using the direct inventory page URL
- Some sites may require a different approach (let us know!)

### "VENICE_API_KEY is not configured"
- Make sure you created `.env.local` with your API key
- Restart the dev server after adding the key

### Scripts seem generic
- The more vehicle details the scraper finds, the better the scripts
- You can manually add vehicle details in a future version

## Tech Stack

- **Next.js 14** - React framework
- **Tailwind CSS** - Styling
- **Cheerio** - HTML parsing for scraping
- **Venice AI** - LLM for script generation
- **Vercel** - Hosting
