import React, { useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import type { Pergunta, Resposta, Configuracoes, Som } from './types';

type Tab = 'perguntas' | 'respostas' | 'config' | 'sons';

const CATEGORIAS = ['geral', 'hospital', 'parquinho', 'escola', 'faculdade', 'casa', 'igreja', 'terreiro', 'praia', 'metro', 'feira', 'rua', 'futebol'];

function contarEspacos(texto: string) {
  return (texto.match(/_{3,}/g) || []).length || 1;
}

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [tab, setTab] = useState<Tab>('perguntas');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loadingSession) {
    return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="border-b border-slate-700 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black uppercase">P.Q.P. — Painel Admin</h1>
          <p className="text-xs text-slate-400">{session.user.email}</p>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-bold text-sm uppercase"
        >
          Sair
        </button>
      </header>

      <nav className="flex gap-2 px-6 py-4 flex-wrap">
        {([
          ['perguntas', 'Perguntas'],
          ['respostas', 'Respostas'],
          ['config', 'Configurações'],
          ['sons', 'Sons'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-xl font-bold uppercase text-sm border-2 ${
              tab === key ? 'bg-amber-400 border-amber-600 text-black' : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="px-6 pb-16">
        {tab === 'perguntas' && <PerguntasTab />}
        {tab === 'respostas' && <RespostasTab />}
        {tab === 'config' && <ConfiguracoesTab />}
        {tab === 'sons' && <SonsTab />}
      </main>
    </div>
  );
};

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  const entrar = async () => {
    setLoading(true);
    setErro('');
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) setErro(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
      <div className="bg-slate-800 border-2 border-slate-700 rounded-2xl p-8 w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-black text-white uppercase text-center">P.Q.P. Admin</h1>
        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 text-white outline-none focus:border-amber-400"
        />
        <input
          type="password"
          placeholder="Senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && entrar()}
          className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 text-white outline-none focus:border-amber-400"
        />
        {erro && <p className="text-red-400 text-sm font-bold">{erro}</p>}
        <button
          onClick={entrar}
          disabled={loading}
          className="w-full bg-amber-400 hover:bg-amber-500 text-black font-black uppercase py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <p className="text-slate-500 text-xs text-center">
          Seu login é criado direto no painel do Supabase (Authentication → Users → Add user), não tem cadastro público aqui.
        </p>
      </div>
    </div>
  );
};

const PerguntasTab: React.FC = () => {
  const [lista, setLista] = useState<Pergunta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState('geral');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase.from('perguntas').select('*').order('criado_em', { ascending: false });
    setLista((data as Pergunta[]) || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const adicionar = async () => {
    if (!texto.trim()) return;
    setSalvando(true);
    await supabase.from('perguntas').insert({
      texto: texto.trim(),
      categoria,
      espacos: contarEspacos(texto),
      status: 'publicado',
    });
    setTexto('');
    setSalvando(false);
    carregar();
  };

  const alternarStatus = async (p: Pergunta) => {
    await supabase.from('perguntas').update({ status: p.status === 'publicado' ? 'rascunho' : 'publicado' }).eq('id', p.id);
    carregar();
  };

  const excluir = async (id: string) => {
    if (!confirm('Excluir esta pergunta?')) return;
    await supabase.from('perguntas').delete().eq('id', id);
    carregar();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 space-y-3">
        <h2 className="font-black uppercase text-white">Nova pergunta</h2>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Ex: Eu não quero ______ porque ______"
          className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 text-white outline-none focus:border-amber-400 h-24"
        />
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            className="bg-slate-900 border-2 border-slate-700 rounded-xl p-2 text-white"
          >
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-slate-400 text-sm">Espaços detectados: {contarEspacos(texto)}</span>
          <button
            onClick={adicionar}
            disabled={salvando || !texto.trim()}
            className="ml-auto bg-amber-400 hover:bg-amber-500 text-black font-black uppercase px-5 py-2 rounded-xl disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {carregando && <p className="text-slate-400">Carregando...</p>}
        {!carregando && lista.length === 0 && <p className="text-slate-400">Nenhuma pergunta cadastrada ainda.</p>}
        {lista.map((p) => (
          <div key={p.id} className="bg-slate-800 border-2 border-slate-700 rounded-xl p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-white font-bold">{p.texto}</p>
              <p className="text-xs text-slate-400 uppercase mt-1">{p.categoria} · {p.espacos} espaço(s)</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => alternarStatus(p)}
                className={`text-xs font-black uppercase px-3 py-2 rounded-lg ${p.status === 'publicado' ? 'bg-emerald-600' : 'bg-slate-600'}`}
              >
                {p.status === 'publicado' ? 'Publicado' : 'Rascunho'}
              </button>
              <button onClick={() => excluir(p.id)} className="text-xs font-black uppercase px-3 py-2 rounded-lg bg-red-600">
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RespostasTab: React.FC = () => {
  const [lista, setLista] = useState<Resposta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase.from('respostas').select('*').order('criado_em', { ascending: false });
    setLista((data as Resposta[]) || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const adicionar = async () => {
    if (!texto.trim()) return;
    setSalvando(true);
    await supabase.from('respostas').insert({ texto: texto.trim(), status: 'publicado' });
    setTexto('');
    setSalvando(false);
    carregar();
  };

  const alternarStatus = async (r: Resposta) => {
    await supabase.from('respostas').update({ status: r.status === 'publicado' ? 'rascunho' : 'publicado' }).eq('id', r.id);
    carregar();
  };

  const excluir = async (id: string) => {
    if (!confirm('Excluir esta resposta?')) return;
    await supabase.from('respostas').delete().eq('id', id);
    carregar();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 space-y-3">
        <h2 className="font-black uppercase text-white">Nova resposta</h2>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && adicionar()}
          placeholder="Ex: um motoboy com fé em Deus"
          className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 text-white outline-none focus:border-amber-400"
        />
        <button
          onClick={adicionar}
          disabled={salvando || !texto.trim()}
          className="bg-amber-400 hover:bg-amber-500 text-black font-black uppercase px-5 py-2 rounded-xl disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>

      <div className="space-y-2">
        {carregando && <p className="text-slate-400">Carregando...</p>}
        {!carregando && lista.length === 0 && <p className="text-slate-400">Nenhuma resposta cadastrada ainda.</p>}
        {lista.map((r) => (
          <div key={r.id} className="bg-slate-800 border-2 border-slate-700 rounded-xl p-4 flex items-center justify-between gap-4">
            <p className="text-white font-bold">{r.texto}</p>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => alternarStatus(r)}
                className={`text-xs font-black uppercase px-3 py-2 rounded-lg ${r.status === 'publicado' ? 'bg-emerald-600' : 'bg-slate-600'}`}
              >
                {r.status === 'publicado' ? 'Publicado' : 'Rascunho'}
              </button>
              <button onClick={() => excluir(r.id)} className="text-xs font-black uppercase px-3 py-2 rounded-lg bg-red-600">
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ConfiguracoesTab: React.FC = () => {
  const [cfg, setCfg] = useState<Configuracoes | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [arquivoIntro, setArquivoIntro] = useState<File | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase.from('configuracoes').select('*').eq('id', 1).single();
    setCfg(data as Configuracoes);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const salvar = async () => {
    if (!cfg) return;
    setSalvando(true);

    let logoUrl = cfg.logo_intro_url;
    let logoTipo = cfg.logo_intro_tipo;

    if (arquivoIntro) {
      const ext = arquivoIntro.name.split('.').pop();
      const path = `logo-intro-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('midia').upload(path, arquivoIntro, { upsert: true });
      if (!upErr) {
        const { data } = supabase.storage.from('midia').getPublicUrl(path);
        logoUrl = data.publicUrl;
        logoTipo = arquivoIntro.type.startsWith('video') ? 'video' : arquivoIntro.type === 'image/gif' ? 'gif' : 'imagem';
      }
    }

    await supabase.from('configuracoes').update({
      coringa_ativo: cfg.coringa_ativo,
      coringa_segundos: cfg.coringa_segundos,
      mao_tamanho: cfg.mao_tamanho,
      logo_intro_url: logoUrl,
      logo_intro_tipo: logoTipo,
      logo_intro_duracao_seg: cfg.logo_intro_duracao_seg,
      atualizado_em: new Date().toISOString(),
    }).eq('id', 1);

    setArquivoIntro(null);
    setSalvando(false);
    carregar();
  };

  if (carregando || !cfg) return <p className="text-slate-400">Carregando...</p>;

  return (
    <div className="max-w-xl space-y-6">
      <div className="bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-black uppercase text-white">Carta Coringa</h2>
        <label className="flex items-center gap-3 text-white font-bold">
          <input
            type="checkbox"
            checked={cfg.coringa_ativo}
            onChange={(e) => setCfg({ ...cfg, coringa_ativo: e.target.checked })}
            className="w-5 h-5"
          />
          Coringa ativado
        </label>
        <div>
          <label className="text-xs text-slate-400 uppercase font-bold">Segundos pra aceitar o coringa</label>
          <input
            type="number"
            min={1}
            max={30}
            value={cfg.coringa_segundos}
            onChange={(e) => setCfg({ ...cfg, coringa_segundos: Number(e.target.value) })}
            className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 text-white mt-1"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 uppercase font-bold">Tamanho da mão de respostas</label>
          <input
            type="number"
            min={1}
            max={10}
            value={cfg.mao_tamanho}
            onChange={(e) => setCfg({ ...cfg, mao_tamanho: Number(e.target.value) })}
            className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 text-white mt-1"
          />
        </div>
      </div>

      <div className="bg-slate-800 border-2 border-slate-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-black uppercase text-white">Abertura com o logo</h2>
        <p className="text-xs text-slate-400">Vídeo, GIF ou imagem estática que abre o jogo antes da tela inicial.</p>
        {cfg.logo_intro_url && (
          <p className="text-xs text-emerald-400 font-bold break-all">Atual: {cfg.logo_intro_url}</p>
        )}
        <input
          type="file"
          accept="video/*,image/*"
          onChange={(e) => setArquivoIntro(e.target.files?.[0] || null)}
          className="text-white text-sm"
        />
        <div>
          <label className="text-xs text-slate-400 uppercase font-bold">Duração (segundos)</label>
          <input
            type="number"
            min={1}
            max={10}
            value={cfg.logo_intro_duracao_seg}
            onChange={(e) => setCfg({ ...cfg, logo_intro_duracao_seg: Number(e.target.value) })}
            className="w-full bg-slate-900 border-2 border-slate-700 rounded-xl p-3 text-white mt-1"
          />
        </div>
      </div>

      <button
        onClick={salvar}
        disabled={salvando}
        className="bg-amber-400 hover:bg-amber-500 text-black font-black uppercase px-6 py-3 rounded-xl disabled:opacity-50"
      >
        {salvando ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </div>
  );
};

const SonsTab: React.FC = () => {
  const [lista, setLista] = useState<Som[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase.from('sons').select('*').order('evento');
    setLista((data as Som[]) || []);
    setCarregando(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const enviarSom = async (evento: string, file: File) => {
    setEnviando(evento);
    const ext = file.name.split('.').pop();
    const path = `${evento}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('sons').upload(path, file, { upsert: true });
    if (!upErr) {
      const { data } = supabase.storage.from('sons').getPublicUrl(path);
      await supabase.from('sons').update({ arquivo_url: data.publicUrl, atualizado_em: new Date().toISOString() }).eq('evento', evento);
    }
    setEnviando(null);
    carregar();
  };

  const removerSom = async (evento: string) => {
    await supabase.from('sons').update({ arquivo_url: null }).eq('evento', evento);
    carregar();
  };

  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-slate-400 text-sm mb-4">
        Sem som cadastrado, o jogo simplesmente não toca nada nesse momento — não dá erro. Com som cadastrado, ele toca na hora certa.
      </p>
      {carregando && <p className="text-slate-400">Carregando...</p>}
      {lista.map((s) => (
        <div key={s.evento} className="bg-slate-800 border-2 border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-white font-bold">{s.rotulo}</p>
            {s.arquivo_url ? (
              <audio controls src={s.arquivo_url} className="mt-2 h-8" />
            ) : (
              <p className="text-xs text-slate-500 uppercase font-bold mt-1">Sem som</p>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <label className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase px-3 py-2 rounded-lg cursor-pointer">
              {enviando === s.evento ? 'Enviando...' : 'Trocar'}
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) enviarSom(s.evento, file);
                }}
              />
            </label>
            {s.arquivo_url && (
              <button onClick={() => removerSom(s.evento)} className="bg-red-600 hover:bg-red-700 text-xs font-black uppercase px-3 py-2 rounded-lg">
                Remover
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default App;
