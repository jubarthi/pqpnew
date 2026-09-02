import React, { useState, useEffect } from 'react';
import { soundEngine } from './soundEngine';

interface AdminUser {
  userId: string;
  username: string;
  email: string;
}

interface Pergunta {
  id: string;
  texto: string;
  espacos: number;
  lang: 'pt' | 'en';
  createdAt: number;
}

interface Resposta {
  id: string;
  texto: string;
  lang: 'pt' | 'en';
  createdAt: number;
}

interface SoundItem {
  active: boolean;
  label: string;
  soundType: string;
}

interface SoundConfigs {
  intro: SoundItem;
  coringa: SoundItem;
  roundEnd: SoundItem;
  champion: SoundItem;
}

interface GameConfigs {
  winningScore: number;
  answerSeconds: number;
  readAloudSeconds: number;
  coringaActive: boolean;
}

export const AdminPanel: React.FC<{ onBackToGame: () => void; serverUrl: string }> = ({
  onBackToGame,
  serverUrl,
}) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pqp_admin_token'));
  const [user, setUser] = useState<AdminUser | null>(null);

  // Login form
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'perguntas' | 'respostas' | 'audios' | 'configs'>('perguntas');
  const [langFilter, setLangFilter] = useState<'pt' | 'en'>('pt');
  const [searchQuery, setSearchQuery] = useState('');

  // Data
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [sounds, setSounds] = useState<SoundConfigs | null>(null);
  const [configs, setConfigs] = useState<GameConfigs | null>(null);
  const [statusMsg, setStatusMsg] = useState('');

  // Modal State
  const [modalType, setModalType] = useState<'add_p' | 'edit_p' | 'add_r' | 'edit_r' | null>(null);
  const [editingItem, setEditingItem] = useState<{ id?: string; texto: string; lang: 'pt' | 'en' }>({
    texto: '',
    lang: 'pt',
  });

  const apiUrl = `${serverUrl}/api/admin`;

  // Check auth
  useEffect(() => {
    if (token) {
      fetch(`${apiUrl}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((res) => {
          if (res.ok && res.user) {
            setUser(res.user);
            carregarDados(token);
          } else {
            deslogar();
          }
        })
        .catch(() => deslogar());
    }
  }, [token]);

  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setLoginError(data.erro || 'Erro ao fazer login.');
        setLoading(false);
        return;
      }

      if (rememberMe) {
        localStorage.setItem('pqp_admin_token', data.token);
      }
      setToken(data.token);
      setUser(data.user);
      carregarDados(data.token);
    } catch {
      setLoginError('Não foi possível conectar ao servidor backend.');
    } finally {
      setLoading(false);
    }
  };

  const deslogar = () => {
    localStorage.removeItem('pqp_admin_token');
    setToken(null);
    setUser(null);
  };

  const carregarDados = async (tok: string) => {
    try {
      const headers = { Authorization: `Bearer ${tok}` };
      const [pRes, rRes, sRes, cRes] = await Promise.all([
        fetch(`${apiUrl}/perguntas?lang=${langFilter}`, { headers }).then((r) => r.json()),
        fetch(`${apiUrl}/respostas?lang=${langFilter}`, { headers }).then((r) => r.json()),
        fetch(`${apiUrl}/audios`, { headers }).then((r) => r.json()),
        fetch(`${apiUrl}/configs`, { headers }).then((r) => r.json()),
      ]);

      if (Array.isArray(pRes)) setPerguntas(pRes);
      if (Array.isArray(rRes)) setRespostas(rRes);
      if (sRes && typeof sRes === 'object') setSounds(sRes);
      if (cRes && typeof cRes === 'object') setConfigs(cRes);
    } catch (err) {
      console.error('Erro carregando dados admin:', err);
    }
  };

  useEffect(() => {
    if (token) {
      carregarDados(token);
    }
  }, [langFilter]);

  // CRUD Perguntas
  const salvarPergunta = async () => {
    if (!editingItem.texto.trim()) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      if (modalType === 'add_p') {
        const res = await fetch(`${apiUrl}/perguntas`, {
          method: 'POST',
          headers,
          body: JSON.stringify(editingItem),
        });
        const novo = await res.json();
        setPerguntas((prev) => [novo, ...prev]);
        mostrarStatus('✅ Pergunta adicionada com sucesso!');
      } else if (modalType === 'edit_p' && editingItem.id) {
        const res = await fetch(`${apiUrl}/perguntas/${editingItem.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(editingItem),
        });
        const atualizado = await res.json();
        setPerguntas((prev) => prev.map((p) => (p.id === atualizado.id ? atualizado : p)));
        mostrarStatus('✅ Pergunta atualizada com sucesso!');
      }
      setModalType(null);
    } catch {
      mostrarStatus('❌ Erro ao salvar pergunta.');
    }
  };

  const excluirPergunta = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta pergunta?')) return;
    try {
      await fetch(`${apiUrl}/perguntas/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setPerguntas((prev) => prev.filter((p) => p.id !== id));
      mostrarStatus('🗑️ Pergunta removida.');
    } catch {
      mostrarStatus('❌ Erro ao excluir.');
    }
  };

  // CRUD Respostas
  const salvarResposta = async () => {
    if (!editingItem.texto.trim()) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      if (modalType === 'add_r') {
        const res = await fetch(`${apiUrl}/respostas`, {
          method: 'POST',
          headers,
          body: JSON.stringify(editingItem),
        });
        const novo = await res.json();
        setRespostas((prev) => [novo, ...prev]);
        mostrarStatus('✅ Resposta adicionada com sucesso!');
      } else if (modalType === 'edit_r' && editingItem.id) {
        const res = await fetch(`${apiUrl}/respostas/${editingItem.id}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(editingItem),
        });
        const atualizado = await res.json();
        setRespostas((prev) => prev.map((r) => (r.id === atualizado.id ? atualizado : r)));
        mostrarStatus('✅ Resposta atualizada com sucesso!');
      }
      setModalType(null);
    } catch {
      mostrarStatus('❌ Erro ao salvar resposta.');
    }
  };

  const excluirResposta = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta carta de resposta?')) return;
    try {
      await fetch(`${apiUrl}/respostas/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setRespostas((prev) => prev.filter((r) => r.id !== id));
      mostrarStatus('🗑️ Resposta removida.');
    } catch {
      mostrarStatus('❌ Erro ao excluir.');
    }
  };

  // Áudios
  const toggleSound = async (key: string, active: boolean) => {
    try {
      const res = await fetch(`${apiUrl}/audios/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key, active }),
      });
      const data = await res.json();
      setSounds(data);
      mostrarStatus(`🔊 Som ${active ? 'ativado' : 'desativado'}.`);
    } catch {
      mostrarStatus('❌ Erro ao atualizar som.');
    }
  };

  const testarSom = (tipo: string) => {
    if (tipo === 'intro') soundEngine.playIntro();
    if (tipo === 'coringa') soundEngine.playCoringa();
    if (tipo === 'roundEnd') soundEngine.playRoundEnd();
    if (tipo === 'champion') soundEngine.playChampion(true);
  };

  // Configs
  const salvarConfigs = async () => {
    if (!configs) return;
    try {
      const res = await fetch(`${apiUrl}/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(configs),
      });
      const data = await res.json();
      setConfigs(data);
      mostrarStatus('✅ Configurações salvas!');
    } catch {
      mostrarStatus('❌ Erro ao salvar configs.');
    }
  };

  const mostrarStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3500);
  };

  // ----------------------------------------------------
  // Tela de Login Admin
  // ----------------------------------------------------
  if (!user || !token) {
    return (
      <div className="min-h-screen w-full bg-[#082d13] flex flex-col items-center justify-center p-6 text-white select-none">
        <div className="w-full max-w-md bg-white text-black p-8 rounded-[2rem] border-4 border-black shadow-[0_12px_0_#000] space-y-6">
          <div className="text-center space-y-1">
            <span className="text-4xl">🔐</span>
            <h1 className="text-3xl font-black uppercase tracking-tight">Painel de Controle</h1>
            <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">P.Q.P. — Administração Oficial</p>
          </div>

          <form onSubmit={fazerLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-700">E-mail ou Usuário</label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="realdreamfilme@hotmail.com"
                className="w-full bg-zinc-100 border-3 border-black p-3.5 rounded-2xl text-base font-bold outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-700">Senha</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-100 border-3 border-black p-3.5 rounded-2xl text-base font-bold outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <label htmlFor="remember" className="text-xs font-bold text-zinc-700 cursor-pointer">
                Lembrar minha sessão neste dispositivo
              </label>
            </div>

            {loginError && (
              <div className="bg-red-100 border-2 border-red-500 text-red-700 p-3 rounded-xl text-xs font-bold text-center">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-3d w-full py-4 px-6 rounded-2xl bg-amber-400 border-3 border-black font-black text-xl uppercase tracking-wider shadow-[0_4px_0_#000] hover:bg-amber-300 active:translate-y-1"
            >
              {loading ? 'ACESSANDO...' : 'ENTRAR NO PAINEL'}
            </button>
          </form>

          <button
            onClick={onBackToGame}
            className="w-full text-center text-xs font-black uppercase text-zinc-500 hover:text-black pt-2"
          >
            ← Voltar para o Jogo
          </button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Dashboard Principal
  // ----------------------------------------------------
  const filteredPerguntas = perguntas.filter((p) =>
    p.texto.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredRespostas = respostas.filter((r) =>
    r.texto.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white flex flex-col">
      {/* Topo do Admin */}
      <header className="bg-black/90 border-b-2 border-zinc-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              P.Q.P. <span className="text-amber-400 text-xs px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40">ADMIN</span>
            </h1>
            <p className="text-[11px] font-bold text-zinc-400">
              Logado como: <strong className="text-amber-300">{user.username}</strong> ({user.email})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBackToGame}
            className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-black uppercase px-4 py-2 rounded-xl border border-zinc-600 transition-all"
          >
            🎮 Ir para o Jogo
          </button>
          <button
            onClick={deslogar}
            className="bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-black uppercase px-4 py-2 rounded-xl border border-red-500/40 transition-all"
          >
            🚪 Sair
          </button>
        </div>
      </header>

      {/* Notificação flutuante de status */}
      {statusMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-black border-2 border-amber-400 text-amber-300 font-black px-6 py-3 rounded-2xl shadow-2xl animate-bounce">
          {statusMsg}
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-6 space-y-6">
        {/* Abas de Navegação */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800">
          <button
            onClick={() => setActiveTab('perguntas')}
            className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'perguntas'
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>📝</span> Perguntas ({perguntas.length})
          </button>
          <button
            onClick={() => setActiveTab('respostas')}
            className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'respostas'
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>🃏</span> Respostas ({respostas.length})
          </button>
          <button
            onClick={() => setActiveTab('audios')}
            className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'audios'
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>🔊</span> Efeitos Sonoros
          </button>
          <button
            onClick={() => setActiveTab('configs')}
            className={`py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'configs'
                ? 'bg-amber-400 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <span>⚙️</span> Configurações
          </button>
        </div>

        {/* ------------------------------------------------ */}
        {/* TAB: PERGUNTAS */}
        {/* ------------------------------------------------ */}
        {activeTab === 'perguntas' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLangFilter('pt')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    langFilter === 'pt'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  🇧🇷 Português
                </button>
                <button
                  onClick={() => setLangFilter('en')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    langFilter === 'en'
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  🇺🇸 English
                </button>
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder="Buscar pergunta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 p-2.5 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <button
                onClick={() => {
                  setEditingItem({ texto: '', lang: langFilter });
                  setModalType('add_p');
                }}
                className="btn-3d bg-amber-400 hover:bg-amber-300 text-black border-2 border-black px-4 py-2 rounded-xl font-black text-xs uppercase"
              >
                ➕ Nova Pergunta
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {filteredPerguntas.map((p) => (
                <div
                  key={p.id}
                  className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between gap-3 hover:border-zinc-700"
                >
                  <div>
                    <span className="inline-block bg-zinc-800 text-zinc-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-md mb-2">
                      {p.espacos} {p.espacos === 1 ? 'Espaço' : 'Espaços'} ({p.lang.toUpperCase()})
                    </span>
                    <p className="text-base font-bold text-white leading-relaxed">{p.texto}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
                    <button
                      onClick={() => {
                        setEditingItem({ id: p.id, texto: p.texto, lang: p.lang });
                        setModalType('edit_p');
                      }}
                      className="text-xs font-black uppercase text-amber-400 hover:text-amber-300 px-2 py-1"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      onClick={() => excluirPergunta(p.id)}
                      className="text-xs font-black uppercase text-red-400 hover:text-red-300 px-2 py-1"
                    >
                      🗑️ Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------ */}
        {/* TAB: RESPOSTAS */}
        {/* ------------------------------------------------ */}
        {activeTab === 'respostas' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLangFilter('pt')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    langFilter === 'pt'
                      ? 'bg-emerald-500 text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  🇧🇷 Português
                </button>
                <button
                  onClick={() => setLangFilter('en')}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                    langFilter === 'en'
                      ? 'bg-blue-500 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  🇺🇸 English
                </button>
              </div>

              <div className="flex items-center gap-2 flex-1 max-w-sm">
                <input
                  type="text"
                  placeholder="Buscar resposta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 p-2.5 rounded-xl text-xs text-white outline-none focus:border-amber-400"
                />
              </div>

              <button
                onClick={() => {
                  setEditingItem({ texto: '', lang: langFilter });
                  setModalType('add_r');
                }}
                className="btn-3d bg-amber-400 hover:bg-amber-300 text-black border-2 border-black px-4 py-2 rounded-xl font-black text-xs uppercase"
              >
                ➕ Nova Resposta
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {filteredRespostas.map((r) => (
                <div
                  key={r.id}
                  className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col justify-between gap-3 hover:border-zinc-700"
                >
                  <p className="text-base font-black text-amber-200">{r.texto}</p>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                    <span className="text-[10px] font-black uppercase text-zinc-500">{r.lang.toUpperCase()}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingItem({ id: r.id, texto: r.texto, lang: r.lang });
                          setModalType('edit_r');
                        }}
                        className="text-xs font-black uppercase text-amber-400 hover:text-amber-300"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => excluirResposta(r.id)}
                        className="text-xs font-black uppercase text-red-400 hover:text-red-300"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ------------------------------------------------ */}
        {/* TAB: ÁUDIOS */}
        {/* ------------------------------------------------ */}
        {activeTab === 'audios' && sounds && (
          <div className="space-y-4">
            <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 space-y-4">
              <div>
                <h2 className="text-xl font-black uppercase text-white">Central de Efeitos Sonoros</h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Efeitos sonoros sintetizados em tempo real de alta definição (Web Audio API com zero latência).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Intro */}
                <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-base text-white">🎵 Abertura do Jogo</span>
                    <input
                      type="checkbox"
                      checked={sounds.intro.active}
                      onChange={(e) => toggleSound('intro', e.target.checked)}
                      className="w-5 h-5 accent-amber-400 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-zinc-400">Toca na inicialização ou no primeiro clique de abertura.</p>
                  <button
                    onClick={() => testarSom('intro')}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-amber-300 py-2.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-zinc-700"
                  >
                    <span>▶</span> Testar Som de Abertura
                  </button>
                </div>

                {/* 2. Coringa */}
                <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-base text-white">🤡 Alerta do Coringa</span>
                    <input
                      type="checkbox"
                      checked={sounds.coringa.active}
                      onChange={(e) => toggleSound('coringa', e.target.checked)}
                      className="w-5 h-5 accent-amber-400 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-zinc-400">Buzina cômica e urgente para quem quiser pegar o Coringa.</p>
                  <button
                    onClick={() => testarSom('coringa')}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-amber-300 py-2.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-zinc-700"
                  >
                    <span>▶</span> Testar Alerta do Coringa
                  </button>
                </div>

                {/* 3. Fim de Rodada */}
                <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-base text-white">🏁 Fim de Rodada</span>
                    <input
                      type="checkbox"
                      checked={sounds.roundEnd.active}
                      onChange={(e) => toggleSound('roundEnd', e.target.checked)}
                      className="w-5 h-5 accent-amber-400 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-zinc-400">Gongo clássico de encerramento da fase da mesa.</p>
                  <button
                    onClick={() => testarSom('roundEnd')}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-amber-300 py-2.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-zinc-700"
                  >
                    <span>▶</span> Testar Gongo de Fim
                  </button>
                </div>

                {/* 4. Campeão */}
                <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-base text-white">👑 Fanfarra do Campeão</span>
                    <input
                      type="checkbox"
                      checked={sounds.champion.active}
                      onChange={(e) => toggleSound('champion', e.target.checked)}
                      className="w-5 h-5 accent-amber-400 cursor-pointer"
                    />
                  </div>
                  <p className="text-xs text-zinc-400">Trompetes VIP disparados EXCLUSIVAMENTE no celular do vencedor!</p>
                  <button
                    onClick={() => testarSom('champion')}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-amber-300 py-2.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 border border-zinc-700"
                  >
                    <span>▶</span> Testar Fanfarra VIP
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------ */}
        {/* TAB: CONFIGURAÇÕES */}
        {/* ------------------------------------------------ */}
        {activeTab === 'configs' && configs && (
          <div className="bg-zinc-900 p-6 rounded-3xl border border-zinc-800 space-y-6 max-w-xl">
            <h2 className="text-xl font-black uppercase text-white">Regras e Parâmetros</h2>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-400">
                  Pontuação para Vencer (Pontos)
                </label>
                <input
                  type="number"
                  value={configs.winningScore}
                  onChange={(e) => setConfigs({ ...configs, winningScore: Number(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl text-white font-bold outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-400">
                  Tempo Limite para Responder (segundos)
                </label>
                <input
                  type="number"
                  value={configs.answerSeconds}
                  onChange={(e) => setConfigs({ ...configs, answerSeconds: Number(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl text-white font-bold outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-zinc-400">
                  Tempo Limite para Leitura em Voz Alta (segundos)
                </label>
                <input
                  type="number"
                  value={configs.readAloudSeconds}
                  onChange={(e) => setConfigs({ ...configs, readAloudSeconds: Number(e.target.value) })}
                  className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl text-white font-bold outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="coringa_active"
                  checked={configs.coringaActive}
                  onChange={(e) => setConfigs({ ...configs, coringaActive: e.target.checked })}
                  className="w-5 h-5 accent-amber-400 cursor-pointer"
                />
                <label htmlFor="coringa_active" className="text-sm font-bold text-white cursor-pointer">
                  Habilitar Mecânica do Coringa Relâmpago
                </label>
              </div>

              <button
                onClick={salvarConfigs}
                className="btn-3d w-full bg-amber-400 hover:bg-amber-300 text-black border-2 border-black py-3.5 rounded-2xl font-black text-base uppercase tracking-wider"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------ */}
      {/* MODAL ADICIONAR / EDITAR */}
      {/* ------------------------------------------------ */}
      {modalType && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border-2 border-zinc-700 w-full max-w-lg p-6 rounded-3xl space-y-4 shadow-2xl">
            <h3 className="text-xl font-black uppercase text-white">
              {modalType.startsWith('add') ? '➕ Adicionar' : '✏️ Editar'}{' '}
              {modalType.endsWith('p') ? 'Pergunta' : 'Resposta'}
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-zinc-400">Texto</label>
              <textarea
                rows={3}
                value={editingItem.texto}
                onChange={(e) => setEditingItem({ ...editingItem, texto: e.target.value })}
                placeholder={
                  modalType.endsWith('p')
                    ? 'Ex: Na minha festa de aniversário, o maior vexame foi ___.'
                    : 'Ex: um boleto vencido há 3 meses'
                }
                className="w-full bg-zinc-800 border border-zinc-700 p-3.5 rounded-2xl text-white font-bold outline-none focus:border-amber-400 text-base"
              />
              {modalType.endsWith('p') && (
                <p className="text-[11px] text-zinc-400">
                  💡 Dica: Use <strong className="text-amber-300">___</strong> (3 sublinhados) para indicar o espaço a ser preenchido pelos jogadores.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-zinc-400">Idioma</label>
              <select
                value={editingItem.lang}
                onChange={(e) => setEditingItem({ ...editingItem, lang: e.target.value as 'pt' | 'en' })}
                className="w-full bg-zinc-800 border border-zinc-700 p-3 rounded-xl text-white font-bold outline-none"
              >
                <option value="pt">🇧🇷 Português</option>
                <option value="en">🇺🇸 English</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setModalType(null)}
                className="px-4 py-2.5 rounded-xl font-black text-xs uppercase text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={modalType.endsWith('p') ? salvarPergunta : salvarResposta}
                className="bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase px-6 py-2.5 rounded-xl border border-black shadow-md"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
