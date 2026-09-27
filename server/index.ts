// Backend server for Campaign Copilot
// Loads environment and handles AI API calls (OpenAI/Groq compatible)
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { aiRouter } from './routes/aiRouter';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', aiRouter);

// Start server
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`🚀 Campaign Copilot API server running on http://${HOST}:${PORT}`);
  console.log(`📡 Groq API: ${process.env.GROQ_API_KEY ? '✅ Configured' : '⚠️  Not configured'}`);
  console.log(`📡 OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '⚠️  Not configured (using rule-based fallback)'}`);
});

