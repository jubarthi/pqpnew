import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { FALLBACK_PERGUNTAS, FALLBACK_RESPOSTAS } from './fallbackContent.js';
import { ENGLISH_QUESTIONS, ENGLISH_ANSWERS } from './englishDeck.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const STORE_PATH = path.join(DATA_DIR, 'customStore.json');

const JWT_SECRET = process.env.JWT_SECRET || 'PQP_SECRET_HASH_KEY_2026_!@#*';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
}

export interface PerguntaItem {
  id: string;
  texto: string;
  espacos: number;
  lang: 'pt' | 'en';
  createdAt: number;
}

export interface RespostaItem {
  id: string;
  texto: string;
  lang: 'pt' | 'en';
  createdAt: number;
}

export interface SoundConfig {
  intro: { active: boolean; label: string; soundType: string };
  coringa: { active: boolean; label: string; soundType: string };
  roundEnd: { active: boolean; label: string; soundType: string };
  champion: { active: boolean; label: string; soundType: string };
}

export interface CustomStore {
  users: AdminUser[];
  perguntas: PerguntaItem[];
  respostas: RespostaItem[];
  sounds: SoundConfig;
  configs: {
    winningScore: number;
    answerSeconds: number;
    readAloudSeconds: number;
    coringaActive: boolean;
  };
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256').toString('hex');
}

function createSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Inicializar armazenamento padrão
let storeCache: CustomStore | null = null;

function initializeDefaultStore(): CustomStore {
  const salt1 = createSalt();
  const salt2 = createSalt();

  const defaultUsers: AdminUser[] = [
    {
      id: 'usr_1',
      username: 'realdreamfilme',
      email: 'realdreamfilme@hotmail.com',
      passwordHash: hashPassword('@#PQPtds2026*', salt1),
      salt: salt1,
    },
    {
      id: 'usr_2',
      username: 'brunogalati',
      email: 'brunogalati@pqp.com',
      passwordHash: hashPassword('@#BG2026*', salt2),
      salt: salt2,
    },
  ];

  const perguntasPt: PerguntaItem[] = FALLBACK_PERGUNTAS.map((p, i) => ({
    id: `p_pt_${i + 1}`,
    texto: p.texto,
    espacos: p.espacos,
    lang: 'pt',
    createdAt: Date.now() - i * 1000,
  }));

  const perguntasEn: PerguntaItem[] = ENGLISH_QUESTIONS.map((texto, i) => ({
    id: `p_en_${i + 1}`,
    texto,
    espacos: (texto.match(/_{3,}/g) || []).length || 1,
    lang: 'en',
    createdAt: Date.now() - i * 1000,
  }));

  const respostasPt: RespostaItem[] = FALLBACK_RESPOSTAS.map((r, i) => ({
    id: `r_pt_${i + 1}`,
    texto: r,
    lang: 'pt',
    createdAt: Date.now() - i * 1000,
  }));

  const respostasEn: RespostaItem[] = ENGLISH_ANSWERS.map((texto, i) => ({
    id: `r_en_${i + 1}`,
    texto,
    lang: 'en',
    createdAt: Date.now() - i * 1000,
  }));

  return {
    users: defaultUsers,
    perguntas: [...perguntasPt, ...perguntasEn],
    respostas: [...respostasPt, ...respostasEn],
    sounds: {
      intro: { active: true, label: 'Vinheta de Abertura (Arcade)', soundType: 'synth_arcade' },
      coringa: { active: true, label: 'Alerta do Coringa (Buzina Cômica)', soundType: 'synth_clown' },
      roundEnd: { active: true, label: 'Fim de Rodada (Gongo da Mesa)', soundType: 'synth_gong' },
      champion: { active: true, label: 'Fanfarra do Campeão (Trompetes VIP)', soundType: 'synth_fanfare' },
    },
    configs: {
      winningScore: 3,
      answerSeconds: 30,
      readAloudSeconds: 15,
      coringaActive: true,
    },
  };
}

export function resetToDefaults(): CustomStore {
  const def = initializeDefaultStore();
  if (storeCache) {
    // mantem os usuarios configurados
    def.users = storeCache.users;
    def.sounds = storeCache.sounds;
    def.configs = storeCache.configs;
  }
  storeCache = def;
  saveStore();
  return storeCache;
}

export function loadStore(): CustomStore {
  if (storeCache) return storeCache;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const parsed: CustomStore = JSON.parse(raw);
      
      // Se continha itens de teste de script automatizado, limpa e restaura o deck original
      const temTeste = parsed.perguntas?.some((p) => p.texto.includes('Estoque renovado pergunta #') || p.texto.includes('Pergunta de teste em lote'));
      if (temTeste) {
        storeCache = initializeDefaultStore();
        if (parsed.users) storeCache.users = parsed.users;
        saveStore();
        return storeCache;
      }

      storeCache = parsed;
      return storeCache!;
    }
  } catch (err) {
    console.warn('[AdminStore] Erro lendo store, criando padrão...', err);
  }

  storeCache = initializeDefaultStore();
  saveStore();
  return storeCache;
}

export function saveStore() {
  if (!storeCache) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(storeCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[AdminStore] Erro gravando store:', err);
  }
}

// Autenticação
export function authenticateAdmin(identifier: string, password: string): { ok: boolean; token?: string; user?: { username: string; email: string }; erro?: string } {
  const store = loadStore();
  const cleanId = identifier.trim().toLowerCase();

  const user = store.users.find(
    (u) => u.email.toLowerCase() === cleanId || u.username.toLowerCase() === cleanId
  );

  if (!user) {
    return { ok: false, erro: 'Usuário ou e-mail não encontrado.' };
  }

  const computedHash = hashPassword(password, user.salt);
  if (computedHash !== user.passwordHash) {
    return { ok: false, erro: 'Senha incorreta.' };
  }

  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30, // 30 dias
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
  const token = `${payloadB64}.${signature}`;

  return {
    ok: true,
    token,
    user: { username: user.username, email: user.email },
  };
}

export function verifyAdminToken(token: string): { ok: boolean; user?: { userId: string; username: string; email: string } } {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return { ok: false };
    const [payloadB64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(payloadB64).digest('base64url');
    if (signature !== expectedSig) return { ok: false };

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return { ok: false };

    return { ok: true, user: { userId: payload.userId, username: payload.username, email: payload.email } };
  } catch {
    return { ok: false };
  }
}
