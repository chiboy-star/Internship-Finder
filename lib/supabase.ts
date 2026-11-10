import { getAllApplications, saveApplication } from './db';
import { Application } from '../types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  enabled: boolean;
}

const STORAGE_KEY = 'supabase_sync_config';

export function getSupabaseConfig(): SupabaseConfig {
  if (typeof window === 'undefined') {
    return { url: '', anonKey: '', enabled: false };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to parse Supabase config:', e);
  }
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    enabled: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * Pushes local IndexedDB applications up to user's personal Supabase database table
 */
export async function syncToSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
  const config = getSupabaseConfig();
  if (!config.enabled || !config.url || !config.anonKey) {
    return { success: false, count: 0, error: 'Supabase sync is not configured or disabled' };
  }

  try {
    const apps = await getAllApplications();
    const records = Object.values(apps);
    if (records.length === 0) {
      return { success: true, count: 0 };
    }

    const cleanUrl = config.url.replace(/\/$/, '');
    const endpoint = `${cleanUrl}/rest/v1/applications`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.anonKey,
        'Authorization': `Bearer ${config.anonKey}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(
        records.map((r) => ({
          listing_or_company_id: r.listing_or_company_id,
          type: r.type,
          status: r.status,
          dates: r.dates,
          notes: r.notes,
          updated_at: r.updated_at,
        }))
      ),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, count: 0, error: `Supabase returned ${res.status}: ${errText}` };
    }

    return { success: true, count: records.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || 'Network error syncing to Supabase' };
  }
}

/**
 * Pulls applications from Supabase into local IndexedDB
 */
export async function pullFromSupabase(): Promise<{ success: boolean; count: number; error?: string }> {
  const config = getSupabaseConfig();
  if (!config.enabled || !config.url || !config.anonKey) {
    return { success: false, count: 0, error: 'Supabase sync is not configured or disabled' };
  }

  try {
    const cleanUrl = config.url.replace(/\/$/, '');
    const endpoint = `${cleanUrl}/rest/v1/applications?select=*`;

    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${config.anonKey}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, count: 0, error: `Supabase returned ${res.status}: ${errText}` };
    }

    const data: Application[] = await res.json();
    if (Array.isArray(data)) {
      for (const app of data) {
        if (app.listing_or_company_id) {
          await saveApplication(app);
        }
      }
      return { success: true, count: data.length };
    }

    return { success: true, count: 0 };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || 'Network error pulling from Supabase' };
  }
}

