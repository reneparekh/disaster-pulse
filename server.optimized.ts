import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import compression from 'compression';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// Performance optimizations
app.use(compression({ level: 6, threshold: 1024 }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Add response time header
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
  });
  next();
});

// Singleton Gemini client
let genAIClient: GoogleGenAI | null = null;
function getGenAIClient(): GoogleGenAI {
  if (genAIClient) return genAIClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  genAIClient = new GoogleGenAI({ apiKey });
  return genAIClient;
}

// Aggressive caching for hazards feed
interface FeedCache {
  timestamp: number;
  data: any;
  isStale: boolean;
}

let cachedUSGSFeed: FeedCache | null = null;
const CACHE_TTL = 60 * 1000;
const STALE_TTL = 10 * 60 * 1000;

app.get('/api/hazards/feed', async (req, res) => {
  const now = Date.now();
  
  if (cachedUSGSFeed && (now - cachedUSGSFeed.timestamp) < CACHE_TTL) {
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({
      success: true,
      cached: true,
      cacheAgeSeconds: Math.round((now - cachedUSGSFeed.timestamp) / 1000),
      isStale: false,
      data: cachedUSGSFeed.data,
      source: 'USGS (Cached)',
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    
    const response = await fetch(
      'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson',
      { 
        signal: controller.signal,
        headers: { 'User-Agent': 'DisasterPulse/1.0', 'Accept': 'application/json' }
      }
    );
    clearTimeout(timeout);
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    
    cachedUSGSFeed = { timestamp: now, data: json, isStale: false };
    
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.json({
      success: true,
      cached: false,
      cacheAgeSeconds: 0,
      isStale: false,
      data: json,
      source: 'USGS (Fresh)',
    });
  } catch (error: any) {
    if (cachedUSGSFeed && (now - cachedUSGSFeed.timestamp) < STALE_TTL) {
      const ageSec = Math.round((now - cachedUSGSFeed.timestamp) / 1000);
      res.set('Cache-Control', 'public, max-age=0, stale-while-revalidate=600');
      return res.json({
        success: true,
        cached: true,
        cacheAgeSeconds: ageSec,
        isStale: true,
        staleReason: `Fallback to cache`,
        data: cachedUSGSFeed.data,
        source: 'USGS (Stale Cache)',
      });
    }
    return res.status(502).json({ success: false, error: 'Feed unavailable' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], model = 'gemini-3.5-flash', role = 'commander', useSearch = false, useMaps = false, userLocation } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    
    const ai = getGenAIClient();
    let systemInstruction = `You are the Global Disaster Command Emergency Intelligence Core. Provide authoritative, concise, and structured disaster information.`;
    if (role === 'medic') systemInstruction = `You are the Chief Emergency Triage Medical Officer. Provide emergency medical advice emphasizing professional emergency response.`;
    else if (role === 'evacuation') systemInstruction = `You are the Civil Defense Evacuation Specialist. Guide to safe zones and evacuation routes.`;
    
    const config: any = { systemInstruction };
    if (useMaps) {
      config.tools = [{ googleMaps: {} }];
      if (userLocation?.latitude && userLocation?.longitude) {
        config.toolConfig = { retrievalConfig: { latLng: { latitude: userLocation.latitude, longitude: userLocation.longitude } } };
      }
    } else if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }
    
    const contents: any[] = [];
    if (Array.isArray(history)) {
      for (const item of history.slice(-15)) {
        if (item.text && item.role) {
          contents.push({ role: item.role === 'model' ? 'model' : 'user', parts: [{ text: item.text }] });
        }
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });
    
    const targetModel = model === 'gemini-3.1-pro-preview' ? 'gemini-3.1-pro-preview' : model === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';
    
    const response = await ai.models.generateContent({ model: targetModel, contents, config });
    const responseText = response.text || '';
    
    const groundingSources: any[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (Array.isArray(chunks)) {
      for (const chunk of chunks) {
        if (chunk.web?.uri) groundingSources.push({ title: chunk.web.title || 'Web', uri: chunk.web.uri, type: 'web' });
        if (chunk.maps?.uri) groundingSources.push({ title: chunk.maps.title || 'Maps', uri: chunk.maps.uri, type: 'map' });
      }
    }
    
    return res.json({ text: responseText, groundingSources, modelUsed: targetModel });
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: error?.message || 'Failed' });
  }
});

app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) return res.status(400).json({ error: 'audioBase64 required' });
    
    const ai = getGenAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: { parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: 'Transcribe accurately.' }] },
    });
    
    return res.json({ text: response.text?.trim() || '' });
  } catch (error: any) {
    console.error('Transcribe error:', error);
    return res.status(500).json({ error: error?.message || 'Failed' });
  }
});

app.get('/api/news/disasters', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=disaster%20OR%20earthquake%20OR%20flood%20OR%20cyclone&mode=ArtList&maxrecords=30&format=json`;
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'DisasterPulse' } });
    clearTimeout(timeout);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return res.json({ success: true, source: 'GDELT', count: data.articles?.length || 0, articles: data.articles || [] });
    } catch {
      return res.json({ success: true, source: 'GDELT', count: 0, articles: [] });
    }
  } catch {
    return res.json({ success: true, source: 'GDELT', count: 0, articles: [] });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      optimizeDeps: { include: ['react', 'react-dom', 'recharts', 'leaflet', 'lucide-react'] }
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist'), { maxAge: '1y', etag: true, lastModified: true, immutable: true }));
    app.get('*', (req, res) => res.sendFile(path.resolve('dist/index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`⚡ DisasterPulse on :${PORT}`));
}

startServer();
