import { createClient } from '@supabase/supabase-js';
import type { Configuracoes } from './types.js';
import { loadStore } from './adminStore.js';

const url = process.env.SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';

const isConfigured = url && anonKey && !url.includes('placeholder') && !url.includes('SEU-PROJETO');

export const supabase = isConfigured
  ? createClient(url, anonKey)
  : null;

export async function getConfiguracoes(): Promise<Configuracoes> {
  const store = loadStore();
  return {
    coringa_ativo: store.configs.coringaActive,
    coringa_segundos: 5,
    mao_tamanho: 5,
    logo_intro_url: null,
    logo_intro_tipo: null,
    logo_intro_duracao_seg: 3,
  };
}

export async function drawRandomPergunta(usados: string[], lang: 'pt' | 'en' = 'pt'): Promise<{ texto: string; espacos: number }> {
  const store = loadStore();
  let banco = store.perguntas
    .filter((p) => p.lang === lang)
    .map((p) => ({ texto: p.texto, espacos: p.espacos }));

  if (banco.length === 0) {
    banco = store.perguntas.map((p) => ({ texto: p.texto, espacos: p.espacos }));
  }

  let disponiveis = banco.filter((p) => !usados.includes(p.texto));
  if (disponiveis.length === 0) disponiveis = banco;
  return disponiveis[Math.floor(Math.random() * disponiveis.length)];
}

export async function drawRespostas(quantidade: number, excluir: string[], lang: 'pt' | 'en' = 'pt'): Promise<string[]> {
  const store = loadStore();
  let banco = store.respostas
    .filter((r) => r.lang === lang)
    .map((r) => r.texto);

  if (banco.length === 0) {
    banco = store.respostas.map((r) => r.texto);
  }

  const disponiveis = banco.filter((t) => !excluir.includes(t));
  const pool = disponiveis.length >= quantidade ? disponiveis : banco;

  const sorteadas: string[] = [];
  const usadosLocal = new Set(excluir);
  while (sorteadas.length < quantidade) {
    const candidatos = pool.filter((t) => !usadosLocal.has(t));
    const fonte = candidatos.length > 0 ? candidatos : pool;
    const escolhida = fonte[Math.floor(Math.random() * fonte.length)];
    sorteadas.push(escolhida);
    usadosLocal.add(escolhida);
    if (usadosLocal.size >= pool.length) usadosLocal.clear();
  }
  return sorteadas;
}
