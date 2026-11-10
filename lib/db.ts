import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Application, Company, ApplicationStatus } from '../types';

interface InternshipFinderDB extends DBSchema {
  applications: {
    key: string;
    value: Application;
    indexes: { 'by-status': ApplicationStatus };
  };
  custom_companies: {
    key: string;
    value: Company;
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'internship-finder-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<InternshipFinderDB>> | null = null;

function getDb(): Promise<IDBPDatabase<InternshipFinderDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available in SSR'));
  }
  if (!dbPromise) {
    dbPromise = openDB<InternshipFinderDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('applications')) {
          const appStore = db.createObjectStore('applications', { keyPath: 'listing_or_company_id' });
          appStore.createIndex('by-status', 'status');
        }
        if (!db.objectStoreNames.contains('custom_companies')) {
          db.createObjectStore('custom_companies', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllApplications(): Promise<Record<string, Application>> {
  try {
    const db = await getDb();
    const list = await db.getAll('applications');
    const map: Record<string, Application> = {};
    for (const app of list) {
      map[app.listing_or_company_id] = app;
    }
    return map;
  } catch (e) {
    console.error('Error fetching applications from DB:', e);
    return {};
  }
}

export async function getApplication(id: string): Promise<Application | undefined> {
  try {
    const db = await getDb();
    return await db.get('applications', id);
  } catch {
    return undefined;
  }
}

export async function saveApplication(app: Application): Promise<void> {
  const db = await getDb();
  await db.put('applications', app);
}

export async function removeApplication(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('applications', id);
}

export async function getCustomCompanies(): Promise<Company[]> {
  try {
    const db = await getDb();
    return await db.getAll('custom_companies');
  } catch {
    return [];
  }
}

export async function saveCustomCompany(company: Company): Promise<void> {
  const db = await getDb();
  await db.put('custom_companies', company);
}

export async function removeCustomCompany(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('custom_companies', id);
}

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const db = await getDb();
    const val = await db.get('settings', key);
    return val !== undefined ? val : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function saveSetting<T>(key: string, value: T): Promise<void> {
  try {
    const db = await getDb();
    await db.put('settings', value, key);
  } catch (e) {
    console.error('Error saving setting:', e);
  }
}

export async function exportAllData(): Promise<string> {
  const db = await getDb();
  const applications = await db.getAll('applications');
  const customCompanies = await db.getAll('custom_companies');
  const appGoal = await getSetting('application_goal', 15);
  const theme = await getSetting('theme', 'system');

  const exportPayload = {
    version: 1,
    exported_at: new Date().toISOString(),
    applications,
    custom_companies: customCompanies,
    settings: {
      application_goal: appGoal,
      theme,
    },
  };

  return JSON.stringify(exportPayload, null, 2);
}

export async function importAllData(jsonString: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      return { success: false, count: 0, error: 'Invalid JSON format' };
    }

    const db = await getDb();
    const tx = db.transaction(['applications', 'custom_companies', 'settings'], 'readwrite');

    let count = 0;
    if (Array.isArray(data.applications)) {
      for (const app of data.applications) {
        if (app.listing_or_company_id && app.status) {
          await tx.objectStore('applications').put(app);
          count++;
        }
      }
    }

    if (Array.isArray(data.custom_companies)) {
      for (const comp of data.custom_companies) {
        if (comp.id && comp.name) {
          await tx.objectStore('custom_companies').put(comp);
        }
      }
    }

    if (data.settings) {
      if (data.settings.application_goal) {
        await tx.objectStore('settings').put(data.settings.application_goal, 'application_goal');
      }
      if (data.settings.theme) {
        await tx.objectStore('settings').put(data.settings.theme, 'theme');
      }
    }

    await tx.done;
    return { success: true, count };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message || 'Import failed' };
  }
}

export async function clearAllLocalData(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['applications', 'custom_companies', 'settings'], 'readwrite');
  await tx.objectStore('applications').clear();
  await tx.objectStore('custom_companies').clear();
  await tx.objectStore('settings').clear();
  await tx.done;
}

