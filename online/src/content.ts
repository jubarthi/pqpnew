import { createClient } from '@supabase/supabase-js';
import type { Configuracoes } from './types';

const url = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

const isConfigured = url && anonKey && !url.includes('placeholder') && !url.includes('SEU-PROJETO');

export const supabase = isConfigured ? createClient(url, anonKey) : null;

export async function carregarSons(): Promise<Record<string, string>> {
  if (!supabase) return {};
  try {
    const { data, error } = await supabase.from('sons').select('evento, arquivo_url');
    const mapa: Record<string, string> = {};
    if (!error && data) {
      for (const s of data as { evento: string; arquivo_url: string | null }[]) {
        if (s.arquivo_url) mapa[s.evento] = s.arquivo_url;
      }
    }
    return mapa;
  } catch {
    return {};
  }
}

export async function carregarConfiguracoes(): Promise<Configuracoes | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('logo_intro_url, logo_intro_tipo, logo_intro_duracao_seg')
      .eq('id', 1)
      .single();
    if (error || !data) return null;
    return data as Configuracoes;
  } catch {
    return null;
  }
}
