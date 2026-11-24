import { AppDatabase, WeekData } from '../types/control';
import {
  createInitialServices,
  DEFAULT_TEMPLATES,
  getMondayOfDate,
} from '../data/initialServices';

const STORAGE_KEY = 'controlterm_db_v1';
const IDB_NAME = 'ControlTermOfflineDB';
const IDB_STORE = 'appdata';
const IDB_RECORD_KEY = 'database';

export function createDefaultDatabase(): AppDatabase {
  const currentMonday = getMondayOfDate(new Date());
  const emptyWeek: WeekData = {
    weekKey: currentMonday,
    updatedAt: new Date().toISOString(),
    records: {},
  };
  return {
    version: 1,
    regionTitle: 'Control de Temperatura — Red de Servicios',
    coordinatorName: 'Coordinación PAI / Cadena de Frío',
    services: createInitialServices(),
    weeks: {
      [currentMonday]: emptyWeek,
    },
    templates: DEFAULT_TEMPLATES,
  };
}

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

declare global {
  interface Window {
    __CONTROLTERM_SEED_DB__?: AppDatabase;
  }
}

export async function loadDatabase(): Promise<AppDatabase> {
  // 1. Try IndexedDB first (larger quota, more resilient offline)
  try {
    const idb = await openIDB();
    const data = await new Promise<AppDatabase | undefined>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_RECORD_KEY);
      req.onsuccess = () => resolve(req.result as AppDatabase | undefined);
      req.onerror = () => reject(req.error);
    });
    if (data && Array.isArray(data.services) && data.services.length > 0) {
      return mergeWithDefaults(data);
    }
  } catch {
    // Fallback to localStorage below
  }

  // 2. Fallback to localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppDatabase;
      if (parsed && Array.isArray(parsed.services)) {
        return mergeWithDefaults(parsed);
      }
    }
  } catch {
    // Ignore parse errors
  }

  // 3. If running from a downloaded standalone HTML file with embedded seed DB
  if (
    typeof window !== 'undefined' &&
    window.__CONTROLTERM_SEED_DB__ &&
    Array.isArray(window.__CONTROLTERM_SEED_DB__.services)
  ) {
    const seeded = mergeWithDefaults(window.__CONTROLTERM_SEED_DB__);
    await saveDatabase(seeded);
    return seeded;
  }

  const initial = createDefaultDatabase();
  await saveDatabase(initial);
  return initial;
}

function mergeWithDefaults(db: AppDatabase): AppDatabase {
  const defaults = createDefaultDatabase();
  const rawServices =
    db.services && db.services.length > 0 ? db.services : defaults.services;
  const services = rawServices.map((s) =>
    s.name === 'PROVADO PARATODO' ? { ...s, name: 'PRIVADO PARATODO' } : s
  );
  return {
    version: db.version || 1,
    regionTitle: db.regionTitle || defaults.regionTitle,
    coordinatorName: db.coordinatorName || defaults.coordinatorName,
    services,
    weeks: db.weeks || defaults.weeks,
    templates: {
      whatsappTemplate: db.templates?.whatsappTemplate || DEFAULT_TEMPLATES.whatsappTemplate,
      emailSubjectTemplate:
        db.templates?.emailSubjectTemplate || DEFAULT_TEMPLATES.emailSubjectTemplate,
      emailBodyTemplate: db.templates?.emailBodyTemplate || DEFAULT_TEMPLATES.emailBodyTemplate,
    },
  };
}

export async function saveDatabase(db: AppDatabase): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignore localStorage quota errors if IDB succeeds
  }

  try {
    const idb = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const req = store.put(db, IDB_RECORD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // IndexedDB unavailable, localStorage already written
  }
}

// --- Encrypted Portable Backup (AES-GCM via Web Crypto API) ---

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 120000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export interface EncryptedEnvelope {
  format: 'controlterm-encrypted-v1';
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
}

export async function encryptDatabaseBackup(
  db: AppDatabase,
  passphrase: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(db));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const envelope: EncryptedEnvelope = {
    format: 'controlterm-encrypted-v1',
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
    createdAt: new Date().toISOString(),
  };
  return JSON.stringify(envelope, null, 2);
}

export async function decryptDatabaseBackup(
  rawText: string,
  passphrase?: string
): Promise<AppDatabase> {
  const parsed = JSON.parse(rawText);
  if (parsed && parsed.format === 'controlterm-encrypted-v1') {
    if (!passphrase) {
      throw new Error('PASSWORD_REQUIRED');
    }
    const salt = fromBase64(parsed.salt);
    const iv = fromBase64(parsed.iv);
    const ciphertext = fromBase64(parsed.ciphertext);
    const key = await deriveAesKey(passphrase, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      ciphertext as unknown as BufferSource
    );
    const dec = new TextDecoder();
    const db = JSON.parse(dec.decode(decrypted)) as AppDatabase;
    return mergeWithDefaults(db);
  }
  if (parsed && Array.isArray(parsed.services) && parsed.weeks) {
    return mergeWithDefaults(parsed as AppDatabase);
  }
  throw new Error('INVALID_BACKUP_FORMAT');
}
