'use client';

import { useState, useEffect } from 'react';
import { Vehicle, ScrapedInventory, AdScript, AdType } from '@/types';

interface VideoModel {
  id: string;
  name: string;
  description: string;
}

interface VideoJob {
  scriptIndex: number;
  id: string;
  model: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

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
  
  // Video generation state
  const [videoModels, setVideoModels] = useState<VideoModel[]>([]);
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>('sora-2-text-to-video');
  const [videoJobs, setVideoJobs] = useState<VideoJob[]>([]);
  const [generatingVideo, setGeneratingVideo] = useState<number | null>(null);

  // Fetch video models on mount
  useEffect(() => {
    fetch('/api/video')
      .then(res => res.json())
      .then(data => {
        if (data.models) {
          setVideoModels(data.models);
        }
      })
      .catch(console.error);
  }, []);

  // Poll for video status
  useEffect(() => {
    const pendingJobs = videoJobs.filter(j => j.status === 'queued' || j.status === 'processing');
    if (pendingJobs.length === 0) return;

    const interval = setInterval(async () => {
      for (const job of pendingJobs) {
        try {
          const res = await fetch(`/api/video/status?id=${job.id}&model=${encodeURIComponent(job.model)}`);
          const data = await res.json();
          
          setVideoJobs(prev => prev.map(j => 
            j.id === job.id 
              ? { ...j, status: data.status, videoUrl: data.videoUrl, error: data.error }
              : j
          ));
        } catch (err) {
          console.error('Error polling video status:', err);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [videoJobs]);

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

  const handleGenerateVideo = async (scriptIndex: number, script: AdScript) => {
    setGeneratingVideo(scriptIndex);
    
    try {
      // Create a video-friendly prompt from the script
      const videoPrompt = `Create a professional car dealership advertisement video: ${script.script.substring(0, 500)}`;
      
      const response = await fetch('/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          model: selectedVideoModel,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start video generation');
      }

      // Add to video jobs
      setVideoJobs(prev => [...prev, {
        scriptIndex,
        id: data.id,
        model: selectedVideoModel,
        status: 'queued',
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate video');
    } finally {
      setGeneratingVideo(null);
    }
  };

  const getVideoJobForScript = (index: number) => {
    return videoJobs.find(j => j.scriptIndex === index);
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">
                ✨ Generated Ad Scripts
              </h2>
              
              {/* Video Model Selector */}
              {videoModels.length > 0 && (
                <div className="flex items-center gap-3">
                  <label className="text-slate-400 text-sm">Video Model:</label>
                  <select
                    value={selectedVideoModel}
                    onChange={(e) => setSelectedVideoModel(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {videoModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {scripts.map((script, index) => {
                const videoJob = getVideoJobForScript(index);
                
                return (
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
                      <div className="flex gap-2">
                        <button
                          onClick={() => copyToClipboard(script.script)}
                          className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                        >
                          📋 Copy
                        </button>
                      </div>
                    </div>
                    
                    <div className="bg-slate-800 rounded-lg p-4 whitespace-pre-wrap text-slate-200 font-mono text-sm leading-relaxed mb-4">
                      {script.script}
                    </div>

                    {/* Video Generation Section */}
                    <div className="border-t border-slate-700 pt-4">
                      {!videoJob ? (
                        <button
                          onClick={() => handleGenerateVideo(index, script)}
                          disabled={generatingVideo === index}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-slate-600 disabled:to-slate-600 text-white font-medium rounded-lg transition-all flex items-center gap-2"
                        >
                          {generatingVideo === index ? (
                            <>
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Starting...
                            </>
                          ) : (
                            <>🎬 Generate Video Ad</>
                          )}
                        </button>
                      ) : (
                        <div className="flex items-center gap-4">
                          {videoJob.status === 'queued' && (
                            <div className="flex items-center gap-2 text-yellow-400">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span>Queued...</span>
                            </div>
                          )}
                          {videoJob.status === 'processing' && (
                            <div className="flex items-center gap-2 text-blue-400">
                              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              <span>Generating video... This may take a few minutes.</span>
                            </div>
                          )}
                          {videoJob.status === 'completed' && videoJob.videoUrl && (
                            <div className="flex items-center gap-4">
                              <span className="text-green-400">✅ Video Ready!</span>
                              <a
                                href={videoJob.videoUrl}
                                download
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                              >
                                ⬇️ Download Video
                              </a>
                              <a
                                href={videoJob.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                              >
                                👁️ Preview
                              </a>
                            </div>
                          )}
                          {videoJob.status === 'failed' && (
                            <div className="flex items-center gap-4">
                              <span className="text-red-400">❌ Failed: {videoJob.error || 'Unknown error'}</span>
                              <button
                                onClick={() => {
                                  setVideoJobs(prev => prev.filter(j => j.id !== videoJob.id));
                                }}
                                className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                              >
                                Try Again
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
