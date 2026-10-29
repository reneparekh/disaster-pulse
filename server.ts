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

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use(compression({ level: 6, threshold: 1024 }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '30mb' }));

let genAIClient: GoogleGenAI | null = null;
function getGenAIClient(): GoogleGenAI {
  if (genAIClient) return genAIClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  genAIClient = new GoogleGenAI({ apiKey });
  return genAIClient;
}

interface FeedCache { timestamp: number; data: any; }
let cachedUSGSFeed: FeedCache | null = null;
const CACHE_TTL = 60000;

app.get('/api/hazards/feed', async (req, res) => {
  const now = Date.now();
  if (cachedUSGSFeed && (now - cachedUSGSFeed.timestamp) < CACHE_TTL) {
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({ success: true, cached: true, cacheAgeSeconds: Math.round((now - cachedUSGSFeed.timestamp)/1000), isStale: false, data: cachedUSGSFeed.data, source: 'USGS (Cached)' });
  }
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 4000);
    const r = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', { signal: controller.signal, headers: {'User-Agent':'DisasterPulse/1.0'} });
    clearTimeout(t);
    if (!r.ok) throw new Error('bad');
    const json = await r.json();
    cachedUSGSFeed = { timestamp: now, data: json };
    res.set('Cache-Control', 'public, max-age=60');
    return res.json({ success: true, cached: false, isStale: false, data: json, source: 'USGS (Fresh)' });
  } catch {
    if (cachedUSGSFeed) {
      res.set('Cache-Control', 'public, max-age=0');
      return res.json({ success: true, cached: true, isStale: true, data: cachedUSGSFeed.data, source: 'USGS (Stale)' });
    }
    return res.status(502).json({ success: false });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [], model = 'gemini-3.5-flash', role = 'commander', useSearch = false, useMaps = false, userLocation } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });
    const ai = getGenAIClient();
    let systemInstruction = 'You are the Global Disaster Command Emergency Intelligence Core. Provide authoritative, concise, actionable disaster information.';
    if (role === 'medic') systemInstruction = 'You are the Chief Emergency Triage Medical Officer. Emphasize professional emergency response.';
    else if (role === 'evacuation') systemInstruction = 'You are the Civil Defense Evacuation Specialist. Guide to safe zones.';
    const config: any = { systemInstruction };
    if (useMaps) {
      config.tools = [{ googleMaps: {} }];
      if (userLocation?.latitude && userLocation?.longitude) config.toolConfig = { retrievalConfig: { latLng: userLocation } };
    } else if (useSearch) config.tools = [{ googleSearch: {} }];
    const contents: any[] = [];
    for (const item of (history || []).slice(-12)) if (item.text && item.role) contents.push({ role: item.role === 'model' ? 'model' : 'user', parts: [{ text: item.text }] });
    contents.push({ role: 'user', parts: [{ text: message }] });
    const targetModel = model === 'gemini-3.1-pro-preview' ? 'gemini-3.1-pro-preview' : model === 'gemini-3.1-flash-lite' ? 'gemini-3.1-flash-lite' : 'gemini-3.5-flash';
    const response = await ai.models.generateContent({ model: targetModel, contents, config });
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const groundingSources = chunks.map((c: any) => c.web?.uri ? { title: c.web.title||'Web', uri: c.web.uri, type:'web' } : c.maps?.uri ? { title: c.maps.title||'Maps', uri: c.maps.uri, type:'map' } : null).filter(Boolean);
    return res.json({ text: response.text || '', groundingSources, modelUsed: targetModel });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) return res.status(400).json({ error: 'required' });
    const ai = getGenAIClient();
    const response = await ai.models.generateContent({ model: 'gemini-3.5-transcribe', contents: { parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: 'Transcribe accurately.' }] } });
    return res.json({ text: response.text?.trim() || '' });
  } catch (e: any) { return res.status(500).json({ error: e.message }); }
});

app.get('/api/news/disasters', async (req, res) => {
  try {
    const c = new AbortController(); const t = setTimeout(()=>c.abort(),4000);
    const r = await fetch('https://api.gdeltproject.org/api/v2/doc/doc?query=disaster%20OR%20earthquake%20OR%20flood%20OR%20cyclone&mode=ArtList&maxrecords=30&format=json', { signal: c.signal, headers:{'User-Agent':'DisasterPulse'} });
    clearTimeout(t);
    const txt = await r.text();
    try { const d = JSON.parse(txt); return res.json({ success:true, count:d.articles?.length||0, articles:d.articles||[] }); }
    catch { return res.json({ success:true, count:0, articles:[] }); }
  } catch { return res.json({ success:true, count:0, articles:[] }); }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa', optimizeDeps: { include: ['react','react-dom','recharts','leaflet','lucide-react'] } });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist'), { maxAge: '1y', etag: true, immutable: true }));
    // Serve index.html for non-API routes only
    app.get('*', (req,res,next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.resolve('dist/index.html'));
    });
  }
  app.listen(PORT, '0.0.0.0', ()=>console.log(`DisasterPulse:${PORT}`));
}
startServer();

// Fallback for unmatched routes
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found', path: req.path });
  }
  if (process.env.NODE_ENV === 'production') {
    return res.sendFile(path.resolve('dist/index.html'));
  }
  res.status(404).send('Not found');
});
