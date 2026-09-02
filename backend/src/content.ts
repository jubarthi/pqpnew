import { createClient } from '@supabase/supabase-js';
import type { Configuracoes } from './types.js';
import { FALLBACK_PERGUNTAS, FALLBACK_RESPOSTAS } from './fallbackContent.js';

const url = process.env.SUPABASE_URL || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';

const isConfigured = url && anonKey && !url.includes('placeholder') && !url.includes('SEU-PROJETO');

if (!isConfigured) {
  console.log('[PQP Backend] Modo Local/Offline ativado (usando banco integrado de 500+ perguntas e 190+ respostas).');
}

export const supabase = isConfigured
  ? createClient(url, anonKey)
  : null;

const DEFAULT_CONFIG: Configuracoes = {
  coringa_ativo: true,
  coringa_segundos: 5,
  mao_tamanho: 5,
  logo_intro_url: null,
  logo_intro_tipo: null,
  logo_intro_duracao_seg: 3,
};

export async function getConfiguracoes(): Promise<Configuracoes> {
  if (!supabase) return DEFAULT_CONFIG;
  try {
    const { data, error } = await supabase.from('configuracoes').select('*').eq('id', 1).single();
    if (error || !data) return DEFAULT_CONFIG;
    return data as Configuracoes;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function drawRandomPergunta(usados: string[]): Promise<{ texto: string; espacos: number }> {
  let banco = FALLBACK_PERGUNTAS;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('perguntas')
        .select('texto, espacos')
        .eq('status', 'publicado');

      if (!error && data && data.length > 0) {
        banco = data.map((p) => ({ texto: p.texto as string, espacos: p.espacos as number }));
      }
    } catch {
      banco = FALLBACK_PERGUNTAS;
    }
  }

  let disponiveis = banco.filter((p) => !usados.includes(p.texto));
  if (disponiveis.length === 0) disponiveis = banco;
  return disponiveis[Math.floor(Math.random() * disponiveis.length)];
}

export async function drawRespostas(quantidade: number, excluir: string[]): Promise<string[]> {
  let banco = FALLBACK_RESPOSTAS;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('respostas')
        .select('texto')
        .eq('status', 'publicado');

      if (!error && data && data.length > 0) {
        banco = data.map((r) => r.texto as string);
      }
    } catch {
      banco = FALLBACK_RESPOSTAS;
    }
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
