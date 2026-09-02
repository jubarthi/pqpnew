import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey || url.includes('SEU-PROJETO')) {
  // eslint-disable-next-line no-console
  console.warn('[PQP Admin] Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local (veja o README).');
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder');
