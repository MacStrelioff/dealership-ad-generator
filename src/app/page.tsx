'use client';

import { useState } from 'react';
import { Vehicle, ScrapedInventory, AdScript, AdType } from '@/types';

const AD_TYPE_OPTIONS: { value: AdType; label: string; icon: string }[] = [
  { value: 'video_youtube', label: 'YouTube Video', icon: '📺' },
  { value: 'video_tiktok', label: 'TikTok/Reels', icon: '📱' },
  { value: 'radio_30sec', label: 'Radio (30s)', icon: '📻' },
  { value: 'radio_60sec', label: 'Radio (60s)', icon: '🎙️' },
  { value: 'facebook', label: 'Facebook', icon: '👍' },
  { value: 'instagram', label: 'Instagram', icon: '📸' },
  { value: 'email', label: 'Sales Email', icon: '✉️' },
];

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inventory, setInventory] = useState<ScrapedInventory | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedAdTypes, setSelectedAdTypes] = useState<AdType[]>(['video_youtube', 'facebook', 'radio_30sec']);
  const [scripts, setScripts] = useState<AdScript[]>([]);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleScrape = async () => {
    if (!url) return;
    
    setLoading(true);
    setError('');
    setInventory(null);
    setSelectedVehicle(null);
    setScripts([]);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape inventory');
      }

      setInventory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedVehicle || !inventory || selectedAdTypes.length === 0) return;

    setGenerating(true);
    setScripts([]);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle: selectedVehicle,
          dealershipName: inventory.dealershipName,
          adTypes: selectedAdTypes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate scripts');
      }

      setScripts(data.scripts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setGenerating(false);
    }
  };

  const toggleAdType = (type: AdType) => {
    setSelectedAdTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const filteredVehicles = inventory?.vehicles.filter(v => {
    const search = searchTerm.toLowerCase();
    return (
      v.year.toLowerCase().includes(search) ||
      v.make.toLowerCase().includes(search) ||
      v.model.toLowerCase().includes(search) ||
      (v.trim?.toLowerCase().includes(search))
    );
  }) || [];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-white">
            🚗 Dealership Ad Generator
          </h1>
          <p className="text-slate-400 mt-1">
            Scrape inventory → Select vehicle → Generate personalized ad scripts
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* URL Input Section */}
        <section className="bg-slate-800/50 rounded-2xl p-6 mb-8 border border-slate-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            Step 1: Enter Dealership Website
          </h2>
          <div className="flex gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.dealership.com/inventory"
              className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleScrape}
              disabled={loading || !url}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Scraping...
                </span>
              ) : (
                'Scrape Inventory'
              )}
            </button>
          </div>
          {error && (
            <p className="mt-4 text-red-400 bg-red-900/20 px-4 py-2 rounded-lg">
              {error}
            </p>
          )}
        </section>

        {/* Inventory Section */}
        {inventory && (
          <section className="bg-slate-800/50 rounded-2xl p-6 mb-8 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Step 2: Select a Vehicle from {inventory.dealershipName}
                </h2>
                <p className="text-slate-400">
                  Found {inventory.vehicles.length} vehicles
                </p>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search vehicles..."
                className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {filteredVehicles.length === 0 ? (
              <p className="text-slate-400 text-center py-8">
                No vehicles found. Try a different URL or the website may not be scrapeable.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto pr-2">
                {filteredVehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    onClick={() => setSelectedVehicle(vehicle)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedVehicle?.id === vehicle.id
                        ? 'bg-blue-600/20 border-blue-500 ring-2 ring-blue-500'
                        : 'bg-slate-900/50 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    {vehicle.imageUrl && (
                      <img
                        src={vehicle.imageUrl}
                        alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                        className="w-full h-32 object-cover rounded-lg mb-3"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <h3 className="font-semibold text-white">
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </h3>
                    {vehicle.trim && (
                      <p className="text-slate-400 text-sm">{vehicle.trim}</p>
                    )}
                    <div className="flex gap-4 mt-2 text-sm">
                      {vehicle.price && (
                        <span className="text-green-400 font-semibold">{vehicle.price}</span>
                      )}
                      {vehicle.mileage && (
                        <span className="text-slate-400">{vehicle.mileage}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Ad Type Selection & Generate */}
        {selectedVehicle && (
          <section className="bg-slate-800/50 rounded-2xl p-6 mb-8 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-4">
              Step 3: Choose Ad Types & Generate
            </h2>
            <p className="text-slate-400 mb-4">
              Selected: <span className="text-white font-semibold">{selectedVehicle.year} {selectedVehicle.make} {selectedVehicle.model}</span>
              {selectedVehicle.trim && <span className="text-slate-400"> {selectedVehicle.trim}</span>}
            </p>

            <div className="flex flex-wrap gap-3 mb-6">
              {AD_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => toggleAdType(option.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedAdTypes.includes(option.value)
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {option.icon} {option.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || selectedAdTypes.length === 0}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all"
            >
              {generating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating 5 Personalized Scripts...
                </span>
              ) : (
                `🚀 Generate 5 Ad Scripts`
              )}
            </button>
          </section>
        )}

        {/* Generated Scripts */}
        {scripts.length > 0 && (
          <section className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-6">
              ✨ Generated Ad Scripts
            </h2>

            <div className="space-y-6">
              {scripts.map((script, index) => (
                <div
                  key={index}
                  className="bg-slate-900/50 rounded-xl p-6 border border-slate-600"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        {script.title}
                      </h3>
                      <div className="flex gap-4 mt-1">
                        <span className="text-sm text-blue-400">
                          🎯 {script.targetAudience}
                        </span>
                        <span className="text-sm text-purple-400">
                          🎨 {script.tone}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(script.script)}
                      className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                    >
                      📋 Copy
                    </button>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4 whitespace-pre-wrap text-slate-200 font-mono text-sm leading-relaxed">
                    {script.script}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-slate-500">
          Powered by Venice AI • Built for automotive marketing professionals
        </div>
      </footer>
    </div>
  );
}
