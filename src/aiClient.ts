// AI Client abstraction for Campaign Copilot
// Calls backend API which uses OpenAI if available, otherwise falls back to rule-based engine
import type { SessionContext, NextOption } from './types';
import { generateNextOptions } from './logic/nextOptionsEngine';

/** Public static builds must not send campaign context to localhost on a visitor's device. */
export function resolveApiUrl(configured: string | undefined, isDevelopment: boolean): string | null {
  const value = configured?.trim();
  return value ? value.replace(/[/]+$/, '') : (isDevelopment ? 'http://localhost:3001' : null);
}

const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL, import.meta.env.DEV);

/**
 * Generates 3 next options based on session context.
 * Tries to call backend API first (which uses OpenAI if configured), 
 * otherwise falls back to rule-based engine.
 * 
 * @param ctx - Session context including text, hub, location, quests, leads, NPCs, and character profile
 * @returns Promise resolving to 3 next options
 */
export async function getNextOptions(ctx: SessionContext): Promise<NextOption[]> {
  if (!API_URL) {
    return generateNextOptions(ctx).map(opt => ({ ...opt, source: 'rules-fallback' }));
  }

  try {
    const response = await fetch(`${API_URL}/api/next-options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ctx),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.options && Array.isArray(data.options) && data.options.length > 0) {
        return data.options;
      }
    }
  } catch (error) {
    console.warn('Backend API unavailable, using rule-based fallback:', error);
  }

  // Fallback to rule-based engine
  return generateNextOptions(ctx).map(opt => ({ ...opt, source: 'rules-fallback' }));
}
