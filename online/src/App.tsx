import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { RoomState, PublicPlayer } from './types';
import { useSom } from './useSom';
import { carregarConfiguracoes } from './content';
import { translations, Language } from './i18n';
import { themes, ThemeType } from './theme';
import { soundEngine } from './soundEngine';
import { AdminPanel } from './AdminPanel';
import { Tutorial } from './Tutorial';

function resolverServerUrl(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('vercel.app') || host.includes('pqp')) {
      return 'https://pqpnew.onrender.com';
    }
  }
  const envUrl = (import.meta.env.VITE_SERVER_URL as string) || '';
  if (envUrl && !envUrl.includes('pqp-backend')) {
    return envUrl;
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
}

const SERVER_URL = resolverServerUrl();
const SESSION_KEY = 'pqp_online_session';

interface RevealPayload {
  role: 'winner' | 'host' | 'loser';
  mensagem: string;
  subtexto: string;
  frase: { texto: string; respostas: string[] };
  vencedorNome?: string;
  avaliacaoLeitura?: { leuBem: boolean; votosSim: number; votosNao: number };
  placar?: PublicPlayer[];
  winningScore?: number;
}

interface ChampionPayload {
  ranking: RoomState['players'];
  campeao: string;
}

function montarFrase(texto: string, respostas: string[]) {
  let f = texto;
  respostas.forEach((r) => {
    f = f.replace(
      /_{3,}/,
      `<strong class="inline-block text-black bg-amber-300 border-2 border-black px-2.5 py-0.5 rounded-xl uppercase font-black shadow-[0_2px_0_#000] mx-1">${r}</strong>`
    );
  });
  return f;
}

export const Botao: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  className?: string;
  theme?: ThemeType;
}> = ({ children, onClick, variant = 'primary', disabled, className = '', theme = 'cassino' }) => {
  const isPop = theme === 'popart';
  if (isPop) {
    const cores = {
      primary: 'bg-white text-[#003388] border-3 border-[#003388] shadow-[0_6px_16px_rgba(0,0,0,0.25)] hover:bg-sky-50',
      secondary: 'bg-[#003388] text-white border-3 border-white/50 shadow-[0_6px_16px_rgba(0,0,0,0.25)] hover:bg-[#002266]',
      danger: 'bg-rose-500 text-white border-3 border-black shadow-[0_6px_0_#000]',
      success: 'bg-emerald-400 text-black border-3 border-black shadow-[0_6px_0_#000]',
    }[variant];
    return (
      <div className="relative flex items-center justify-center my-1 w-full">
        <div className="absolute left-0 right-0 h-0.5 bg-white/40 pointer-events-none" />
        <button
          onClick={onClick}
          disabled={disabled}
          className={`relative z-10 btn-comic-pill w-full max-w-xs py-3.5 px-8 rounded-full font-black text-xl uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed select-none transition-all ${cores} ${className}`}
        >
          {children}
        </button>
      </div>
    );
  }

  const cores = {
    primary: 'bg-gradient-to-b from-amber-300 to-amber-400 text-black border-4 border-black shadow-[0_6px_0_#000]',
    secondary: 'bg-gradient-to-b from-blue-500 to-blue-600 text-white border-4 border-black shadow-[0_6px_0_#000]',
    danger: 'bg-gradient-to-b from-rose-500 to-red-600 text-white border-4 border-black shadow-[0_6px_0_#000]',
    success: 'bg-gradient-to-b from-emerald-400 to-emerald-500 text-black border-4 border-black shadow-[0_6px_0_#000]',
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn-3d w-full py-4 px-6 rounded-2xl font-black text-xl uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed select-none ${cores} ${className}`}
    >
      {children}
    </button>
  );
};

const App: React.FC = () => {
  const socketRef = useRef<Socket | null>(null);
  const { tocar } = useSom();

  const [showAdmin, setShowAdmin] = useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/admin') || window.location.search.includes('admin'))
    );
  });

  const [booted, setBooted] = useState(false);
  const [introUrl, setIntroUrl] = useState<string | null>(null);
  const [introTipo, setIntroTipo] = useState<'video' | 'gif' | 'imagem' | null>(null);

  const [connected, setConnected] = useState(false);
  const [localScreen, setLocalScreen] = useState<'welcome' | 'tutorial' | 'home' | 'create' | 'join'>('welcome');
  const [hostNameInput, setHostNameInput] = useState('');
  const [playerNameInput, setPlayerNameInput] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [erro, setErro] = useState('');

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  const [coringaRush, setCoringaRush] = useState<{ segundos: number; mensagem: string; subtexto: string } | null>(null);
  const [coringaClaimFeedback, setCoringaClaimFeedback] = useState<string | null>(null);
  const [handSelection, setHandSelection] = useState<number[]>([]);
  const [freeTexts, setFreeTexts] = useState<string[]>(['', '']);
  const [aguardandoEnvio, setAguardandoEnvio] = useState(false);
  const [minhaRespostaEnviada, setMinhaRespostaEnviada] = useState(false);
  const btnSubmitRef = useRef<HTMLDivElement | null>(null);

  const [pickingSubmissions, setPickingSubmissions] = useState<{ submissionId: string; texts: string[] }[] | null>(null);
  const [revealPayload, setRevealPayload] = useState<RevealPayload | null>(null);
  const [championPayload, setChampionPayload] = useState<ChampionPayload | null>(null);
  const [mostrarPlacarModal, setMostrarPlacarModal] = useState(false);
  const [meuVotoLeituraEnviado, setMeuVotoLeituraEnviado] = useState(false);

  const [isMuted, setIsMuted] = useState(false);

  const meuNome = roomState?.players.find((p) => p.id === myPlayerId)?.name;
  const souAnfitriao = !!myPlayerId && roomState?.hostId === myPlayerId;
  const currentHostPlayer = roomState?.players.find((p) => p.id === roomState.hostId);

  const [entrando, setEntrando] = useState(false);
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('pqp_lang') as Language) || 'pt';
  });
  const [theme, setTheme] = useState<ThemeType>(() => {
    return (localStorage.getItem('pqp_theme') as ThemeType) || 'cassino';
  });

  const t = translations[lang];
  const curTheme = themes[theme];

  const toggleMute = () => {
    const novo = !isMuted;
    setIsMuted(novo);
    soundEngine.setMuted(novo);
    if (roomState?.roomId) {
      socketRef.current?.emit('room:toggle_mute', { roomId: roomState.roomId });
    }
  };

  const mudarIdioma = (novo: Language) => {
    setLang(novo);
    localStorage.setItem('pqp_lang', novo);
    if (roomState?.roomId) {
      socketRef.current?.emit('room:set_lang', { roomId: roomState.roomId, lang: novo });
    }
  };

  const mudarTema = (novo: ThemeType) => {
    setTheme(novo);
    localStorage.setItem('pqp_theme', novo);
  };

  // Intro (logo de abertura, se configurado)
  useEffect(() => {
    carregarConfiguracoes()
      .then((cfg) => {
        if (cfg?.logo_intro_url) {
          setIntroUrl(cfg.logo_intro_url);
          setIntroTipo(cfg.logo_intro_tipo);
          setTimeout(() => setBooted(true), (cfg.logo_intro_duracao_seg || 3) * 1000);
        } else {
          setBooted(true);
        }
      })
      .catch(() => setBooted(true));
  }, []);

  // Rota /entrar/:roomId pré-preenche o formulário de entrada ou rota /admin
  useEffect(() => {
    const partes = window.location.pathname.split('/').filter(Boolean);
    if (partes.includes('admin')) {
      setShowAdmin(true);
      return;
    }
    const entrarIdx = partes.indexOf('entrar');
    if (entrarIdx !== -1 && partes[entrarIdx + 1]) {
      const code = partes[entrarIdx + 1].toUpperCase().replace(/[^A-Z0-9]/g, '');
      setRoomIdInput(code);
      setLocalScreen('join');
    }
    const params = new URLSearchParams(window.location.search);
    const qSala = params.get('sala') || params.get('room') || params.get('r');
    if (qSala) {
      const code = qSala.toUpperCase().replace(/[^A-Z0-9]/g, '');
      setRoomIdInput(code);
      setLocalScreen('join');
    }
  }, []);

  // Conexão com o servidor
  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setErro('');
      const salvo = sessionStorage.getItem(SESSION_KEY);
      if (salvo) {
        try {
          const { roomId, playerId } = JSON.parse(salvo);
          socket.emit('room:rejoin', { roomId, playerId }, (res: { ok?: boolean }) => {
            if (res?.ok) setMyPlayerId(playerId);
          });
        } catch {
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
    });

    socket.on('connect_error', () => {
      setConnected(false);
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('room:state_update', (payload: RoomState & { lang?: Language; isMuted?: boolean }) => {
      setRoomState(payload);
      if (payload.phase !== 'SUBMIT_ANSWERS') {
        setMinhaRespostaEnviada(false);
      }
      if (payload.phase !== 'READING_EVALUATION') {
        setMeuVotoLeituraEnviado(false);
      }
      if (payload.lang && (payload.lang === 'pt' || payload.lang === 'en')) {
        setLang(payload.lang);
      }
      if (typeof payload.isMuted === 'boolean') {
        setIsMuted(payload.isMuted);
        soundEngine.setMuted(payload.isMuted);
      }
    });

    socket.on('coringa:rush_offer', (payload: { segundos: number; mensagem: string; subtexto: string }) => {
      setCoringaRush(payload);
      setCoringaClaimFeedback(null);
      soundEngine.playCoringa();
      tocar('coringa_apareceu');
    });

    socket.on('coringa:claimed', (payload: { mensagem?: string }) => {
      setCoringaClaimFeedback((prev) => prev || payload?.mensagem || '👀 Alguém na mesa pegou o Coringa em segredo!');
      setTimeout(() => {
        setCoringaRush(null);
        setCoringaClaimFeedback(null);
      }, 1200);
    });

    socket.on('round:submission_status', (payload: { evento?: string; submissions?: { submissionId: string; texts: string[] }[] }) => {
      if (payload.evento === 'jogador_entrou') tocar('jogador_entrou');
      if (payload.submissions) setPickingSubmissions(payload.submissions);
    });

    socket.on('round:reveal_result', (payload: RevealPayload) => {
      setRevealPayload(payload);
      setPickingSubmissions(null);
      setMinhaRespostaEnviada(false);
      const souVencedor = payload.role === 'winner';
      soundEngine.playChampion(souVencedor);
      if (souVencedor) {
        tocar('vitoria_final');
      } else {
        tocar('rodada_vencida');
      }
    });

    socket.on('game:champion_declared', (payload: ChampionPayload) => {
      setChampionPayload(payload);
      const souVencedor = meuNome === payload.campeao;
      soundEngine.playChampion(souVencedor);
      tocar('vitoria_final');
    });

    socket.on('game:reset_to_lobby', () => {
      sessionStorage.removeItem(SESSION_KEY);
      setRoomState(null);
      setMyPlayerId(null);
      setChampionPayload(null);
      setRevealPayload(null);
      setLocalScreen('home');
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuNome]);

  // Contagem local da oferta de coringa relampago
  useEffect(() => {
    if (!coringaRush || coringaRush.segundos <= 0) return;
    const t = setTimeout(() => {
      setCoringaRush((prev) => (prev ? { ...prev, segundos: prev.segundos - 1 } : null));
    }, 1000);
    return () => clearTimeout(t);
  }, [coringaRush]);

  // Avança a rodada automaticamente
  useEffect(() => {
    if (revealPayload?.role === 'host') {
      const t = setTimeout(() => {
        socketRef.current?.emit('game:next_round', { roomId: roomState?.roomId });
        setRevealPayload(null);
        setHandSelection([]);
        setFreeTexts(['', '']);
      }, 5000);
      return () => clearTimeout(t);
    }
    if (revealPayload) {
      const t = setTimeout(() => {
        setRevealPayload(null);
        setHandSelection([]);
        setFreeTexts(['', '']);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [revealPayload, roomState?.roomId]);

  const criarSala = useCallback(() => {
    if (!hostNameInput.trim()) return;
    setErro('');
    socketRef.current?.emit(
      'room:create',
      { hostName: hostNameInput.trim() },
      (res: { roomId?: string; hostPlayerId?: string; joinUrl?: string; qrCodeDataUrl?: string; erro?: string }) => {
        if (res.erro) return setErro(res.erro);
        if (res.roomId && res.hostPlayerId) {
          setMyPlayerId(res.hostPlayerId);
          setJoinUrl(res.joinUrl || null);
          setQrCodeDataUrl(res.qrCodeDataUrl || null);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomId: res.roomId, playerId: res.hostPlayerId }));
          soundEngine.playRoomOpen();
          tocar('sala_aberta');
        }
      }
    );
  }, [hostNameInput, tocar]);

  const entrarSala = useCallback(() => {
    if (!playerNameInput.trim() || !roomIdInput.trim()) return;
    setErro('');
    setEntrando(true);

    const doEmit = () => {
      socketRef.current?.emit(
        'room:join',
        { roomId: roomIdInput.trim().toUpperCase(), playerName: playerNameInput.trim() },
        (res: { playerId?: string; roomId?: string; erro?: string }) => {
          setEntrando(false);
          if (res.erro) return setErro(res.erro);
          if (res.playerId && res.roomId) {
            setMyPlayerId(res.playerId);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomId: res.roomId, playerId: res.playerId }));
            tocar('jogador_entrou');
          }
        }
      );
    };

    if (!socketRef.current?.connected) {
      socketRef.current?.connect();
      setTimeout(() => {
        if (socketRef.current?.connected) {
          doEmit();
        } else {
          setEntrando(false);
          setErro('Não foi possível conectar ao servidor do jogo. Verifique sua conexão e tente novamente.');
        }
      }, 8000);
    } else {
      doEmit();
    }
  }, [playerNameInput, roomIdInput, tocar]);

  const iniciarPartida = useCallback(() => {
    socketRef.current?.emit('game:start', { roomId: roomState?.roomId, playerId: myPlayerId }, () => tocar('inicio_jogo'));
  }, [roomState?.roomId, myPlayerId, tocar]);

  const confirmarPergunta = useCallback(() => {
    socketRef.current?.emit('prompt:confirm', {
      roomId: roomState?.roomId,
      playerId: myPlayerId,
    });
  }, [roomState?.roomId, myPlayerId]);

  const sortearPergunta = useCallback(() => {
    socketRef.current?.emit('prompt:draw_random', { roomId: roomState?.roomId, playerId: myPlayerId });
  }, [roomState?.roomId, myPlayerId]);

  const pegarCoringa = useCallback(() => {
    socketRef.current?.emit('coringa:claim', { roomId: roomState?.roomId, playerId: myPlayerId }, (res: { ganhou?: boolean; erro?: string }) => {
      if (res?.ganhou) {
        setCoringaClaimFeedback('👑 VOCÊ PEGOU O CORINGA! (É segredo)');
        tocar('coringa_aceito');
      } else if (res?.erro) {
        tocar('coringa_recusado');
      }
    });
  }, [roomState?.roomId, myPlayerId, tocar]);

  const enviarResposta = useCallback(() => {
    if (!roomState?.currentPrompt) return;
    setAguardandoEnvio(true);
    const payload = roomState.isWildcardHolder
      ? { roomId: roomState.roomId, playerId: myPlayerId, textoLivre: freeTexts.slice(0, roomState.currentPrompt.slots) }
      : { roomId: roomState.roomId, playerId: myPlayerId, handIndexes: handSelection };
    socketRef.current?.emit('answer:submit', payload, (res: { erro?: string }) => {
      setAguardandoEnvio(false);
      if (res?.erro) return setErro(res.erro);
      setMinhaRespostaEnviada(true);
      tocar('jogador_entrou');
    });
  }, [roomState, myPlayerId, handSelection, freeTexts, tocar]);

  const escolherVencedora = useCallback(
    (submissionId: string) => {
      socketRef.current?.emit('winner:pick', { roomId: roomState?.roomId, playerId: myPlayerId, submissionId });
    },
    [roomState?.roomId, myPlayerId]
  );

  const jogarNovamente = useCallback(
    (keepPlayers: boolean) => {
      socketRef.current?.emit('game:restart', { roomId: roomState?.roomId, playerId: myPlayerId, keepPlayers });
      setChampionPayload(null);
    },
    [roomState?.roomId, myPlayerId]
  );

  // Barra de configuracao rapida (Design, Idioma e Mudo)
  const renderSettingsBar = () => (
    <div className="flex items-center justify-between gap-2 p-2 bg-black/40 backdrop-blur-md rounded-2xl border-2 border-white/20 mb-3 shadow-lg select-none">
      <div className="flex items-center gap-2">
        {/* Switch de Tema Visual */}
        <button
          type="button"
          onClick={() => mudarTema(theme === 'cassino' ? 'popart' : 'cassino')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs uppercase transition-all duration-150 active:scale-95 border-2 border-black ${
            theme === 'popart'
              ? 'bg-amber-300 text-black shadow-[0_3px_0_#000]'
              : 'bg-emerald-500 text-white shadow-[0_3px_0_#000]'
          }`}
          title="Alternar estilo visual do jogo"
        >
          <span>{theme === 'cassino' ? '🎰 CASSINO' : '⚡ POP ART'}</span>
        </button>

        {/* Switch de Idioma */}
        <button
          type="button"
          onClick={() => mudarIdioma(lang === 'pt' ? 'en' : 'pt')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs uppercase bg-white text-black border-2 border-black shadow-[0_3px_0_#000] transition-all duration-150 active:scale-95"
          title="Mudar idioma / Switch language"
        >
          <span className="text-base">{lang === 'pt' ? '🇧🇷' : '🇺🇸'}</span>
          <span>{lang === 'pt' ? 'PT' : 'EN'}</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Botao de Placar Geral */}
        {roomState && (
          <button
            type="button"
            onClick={() => setMostrarPlacarModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-xs uppercase bg-amber-400 hover:bg-amber-300 text-black border-2 border-black shadow-[0_3px_0_#000] active:scale-95 transition-all"
            title="Ver placar completo da mesa"
          >
            <span>🏆</span>
            <span className="hidden sm:inline">{t.scoreboardBtn}</span>
          </button>
        )}

        {/* Botao de Mudo / Som */}
        <button
          type="button"
          onClick={toggleMute}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs uppercase border-2 border-black shadow-[0_3px_0_#000] active:scale-95 transition-all ${
            isMuted ? 'bg-red-500 text-white' : 'bg-amber-400 text-black'
          }`}
          title={isMuted ? 'Desmutar som do jogo' : 'Mutar som do jogo'}
        >
          <span>{isMuted ? '🔇 MUDO' : '🔊 SOM'}</span>
        </button>
      </div>
    </div>
  );

  // Modal com o Placar Completo e Quanto Falta para a Vitória
  const renderPlacarModal = () => {
    if (!mostrarPlacarModal || !roomState) return null;
    const meta = roomState.winningScore || 4.0;
    const ranking = [...roomState.players].sort((a, b) => b.score - a.score);

    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white border-4 border-black rounded-3xl p-6 w-full max-w-sm card-shadow-lg space-y-4 max-h-[85vh] flex flex-col">
          <div className="flex justify-between items-center border-b-2 border-black/20 pb-3">
            <div>
              <h3 className="text-xl font-black uppercase text-black">{t.scoreboardTitle}</h3>
              <p className="text-[11px] font-bold text-amber-600 uppercase">
                {t.scoreboardGoal.replace('{goal}', meta.toFixed(1))}
              </p>
            </div>
            <button
              onClick={() => setMostrarPlacarModal(false)}
              className="bg-rose-500 text-white border-2 border-black rounded-full w-8 h-8 font-black text-sm flex items-center justify-center shadow-[0_2px_0_#000]"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {ranking.map((p, idx) => {
              const faltamPts = Math.max(0, meta - p.score);
              const pct = Math.min(100, (p.score / meta) * 100);
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-2xl border-2 border-black ${
                    p.id === myPlayerId ? 'bg-amber-100 border-amber-500' : 'bg-zinc-50'
                  } text-black card-shadow space-y-1.5`}
                >
                  <div className="flex justify-between items-center text-xs font-black">
                    <div className="flex items-center gap-1.5">
                      <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}</span>
                      <span className="truncate max-w-[130px] font-black">{p.name}</span>
                      {p.id === roomState.hostId && (
                        <span className="bg-amber-400 text-black text-[9px] px-1.5 py-0.2 rounded font-black">👑</span>
                      )}
                      {p.id === myPlayerId && (
                        <span className="bg-sky-200 text-sky-900 text-[9px] px-1 rounded font-bold">VOCÊ</span>
                      )}
                    </div>
                    <span className="text-sm font-black">{p.score.toFixed(1)} pts</span>
                  </div>

                  <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden border border-black/30">
                    <div
                      className="bg-gradient-to-r from-amber-400 to-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] font-bold text-zinc-500 uppercase">
                    <span>{pct.toFixed(0)}% da meta</span>
                    <span className="text-amber-700 font-black">{t.ptsRemaining.replace('{pts}', faltamPts.toFixed(1))}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <Botao theme={theme} onClick={() => setMostrarPlacarModal(false)}>
            {lang === 'pt' ? 'FECHAR PLACAR' : 'CLOSE SCOREBOARD'}
          </Botao>
        </div>
      </div>
    );
  };

  // Barra de status superior padrão no jogo
  const renderTopBar = () => {
    if (!roomState) return null;
    return (
      <header className="flex flex-col gap-2 pb-2 select-none">
        <div className="flex items-center justify-between gap-2 text-xs font-black">
          <div className="flex items-center gap-2">
            <span className="bg-black/50 backdrop-blur-sm border-2 border-white/30 px-3 py-1.5 rounded-xl text-white tracking-widest uppercase">
              {lang === 'pt' ? 'SALA' : 'ROOM'}: <strong className="text-amber-300">{roomState.roomId}</strong>
            </span>
            {currentHostPlayer && (
              <span className="bg-amber-400 text-black border-2 border-black px-2.5 py-1.5 rounded-xl uppercase flex items-center gap-1">
                👑 {currentHostPlayer.name}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border-2 border-white/30 px-2.5 py-1.5 rounded-xl text-[11px] text-white/90 uppercase">
            <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            {roomState.players.length} {roomState.players.length === 1 ? (lang === 'pt' ? 'jogador' : 'player') : (lang === 'pt' ? 'jogadores' : 'players')}
          </div>
        </div>
        {renderSettingsBar()}
        {renderPlacarModal()}
      </header>
    );
  };

  // ---------- Telas ----------

  if (showAdmin) {
    return (
      <AdminPanel
        serverUrl={SERVER_URL}
        onBackToGame={() => {
          setShowAdmin(false);
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  if (!booted) {
    return (
      <div
        className="h-screen w-screen max-w-lg mx-auto flex items-center justify-center overflow-hidden"
        style={curTheme.bgInlineStyle}
      >
        {introUrl && introTipo === 'video' && <video src={introUrl} autoPlay muted playsInline className="max-w-full max-h-full" />}
        {introUrl && (introTipo === 'gif' || introTipo === 'imagem') && <img src={introUrl} className="max-w-full max-h-full" alt="P.Q.P." />}
        {!introUrl && <h1 className="text-7xl font-black text-white title-crisp tracking-tight">P.Q.P.</h1>}
      </div>
    );
  }

  if (!roomState) {
    if (localScreen === 'tutorial') {
      return (
        <Tutorial
          theme={theme}
          lang={lang}
          onFinish={() => setLocalScreen('home')}
          onBackToWelcome={() => setLocalScreen('welcome')}
        />
      );
    }

    return (
      <div
        className="h-screen w-screen max-w-lg mx-auto flex flex-col relative overflow-hidden px-6 py-6"
        style={curTheme.bgInlineStyle}
      >
        {renderSettingsBar()}

        {!connected && (
          <div className="bg-black/50 border-2 border-amber-400/80 rounded-2xl p-2.5 text-center text-amber-300 font-black text-xs uppercase mb-4 animate-pulse">
            {t.connectingStatus}
          </div>
        )}

        {/* TELA DE BOAS-VINDAS (PRIMEIRA VEZ vs SÓ ENTRAR) */}
        {localScreen === 'welcome' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-7 text-center select-none">
            {theme === 'popart' ? (
              <div className="relative w-full max-w-[280px] mx-auto p-8 bg-white rounded-[2rem] shadow-[0_12px_28px_rgba(0,30,80,0.3)] rotate-[-1deg] border-4 border-[#003388] text-center my-2 select-none">
                <span className="absolute -top-4 -left-3 text-2xl rotate-[-15deg]">⚡</span>
                <span className="absolute -top-3 right-4 text-2xl font-black text-[#003388]">?</span>
                <span className="absolute -bottom-3 -left-2 text-xl rotate-12">⚙️</span>
                <span className="absolute -bottom-4 right-6 text-xl">💦</span>
                <h1 className="text-6xl font-black text-[#003388] tracking-tight">{t.gameTitle}</h1>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-600 mt-1">{t.gameSubtitle}</p>
              </div>
            ) : (
              <div className="space-y-2 transform -rotate-1 text-center my-2 select-none">
                <h1 className="text-7xl font-black text-white title-crisp tracking-tight">{t.gameTitle}</h1>
                <p className="text-lg font-black uppercase tracking-[0.25em] text-amber-300 drop-shadow-sm">{t.gameSubtitle}</p>
              </div>
            )}

            <div className="w-full max-w-sm space-y-3">
              {/* Opção 1: Primeira Vez */}
              <div className="space-y-1">
                <Botao theme={theme} onClick={() => setLocalScreen('tutorial')}>
                  {t.firstTimeBtn}
                </Botao>
                <p className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                  {t.firstTimeSubtitle}
                </p>
              </div>

              {/* Opção 2: Só Entrar */}
              <div className="space-y-1 pt-1.5">
                <Botao theme={theme} variant="secondary" onClick={() => setLocalScreen('home')}>
                  {t.justEnterBtn}
                </Botao>
                <p className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
                  {t.justEnterSubtitle}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 w-full max-w-sm pt-2">
              <div className="bg-black/30 border border-white/20 rounded-xl px-3 py-1.5 text-[10px] font-bold text-white/90 uppercase tracking-wider">
                🎮 {t.gameTagline}
              </div>
              <button
                onClick={() => {
                  setShowAdmin(true);
                  window.history.pushState({}, '', '/admin');
                }}
                className="bg-black/40 hover:bg-black/60 border border-white/30 text-amber-300 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all"
              >
                🔐 Painel Admin
              </button>
            </div>
          </div>
        )}

        {/* TELA DE ESCOLHA (ABRIR OU ENTRAR EM SALA) */}
        {localScreen === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-7 text-center">
            {theme === 'popart' ? (
              <div className="relative w-full max-w-[280px] mx-auto p-8 bg-white rounded-[2rem] shadow-[0_12px_28px_rgba(0,30,80,0.3)] rotate-[-1deg] border-4 border-[#003388] text-center my-2 select-none">
                <span className="absolute -top-4 -left-3 text-2xl rotate-[-15deg]">⚡</span>
                <span className="absolute -top-3 right-4 text-2xl font-black text-[#003388]">?</span>
                <span className="absolute -bottom-3 -left-2 text-xl rotate-12">⚙️</span>
                <span className="absolute -bottom-4 right-6 text-xl">💦</span>
                <h1 className="text-6xl font-black text-[#003388] tracking-tight">{t.gameTitle}</h1>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-sky-600 mt-1">{t.gameSubtitle}</p>
              </div>
            ) : (
              <div className="space-y-2 transform -rotate-1 text-center my-2 select-none">
                <h1 className="text-7xl font-black text-white title-crisp tracking-tight">{t.gameTitle}</h1>
                <p className="text-lg font-black uppercase tracking-[0.25em] text-amber-300 drop-shadow-sm">{t.gameSubtitle}</p>
              </div>
            )}

            <div className="w-full max-w-sm space-y-3">
              <Botao theme={theme} onClick={() => setLocalScreen('create')}>{t.hostRoom}</Botao>
              <Botao theme={theme} variant="secondary" onClick={() => setLocalScreen('join')}>{t.joinRoom}</Botao>
            </div>

            <div className="flex items-center justify-between gap-2 w-full max-w-sm pt-2">
              <button
                onClick={() => setLocalScreen('tutorial')}
                className="bg-amber-400 hover:bg-amber-300 text-black border-2 border-black rounded-xl px-3 py-1.5 text-[10px] font-black uppercase shadow-[0_2px_0_#000] transition-all"
              >
                {t.seeTutorialBtn}
              </button>

              <button
                onClick={() => {
                  setShowAdmin(true);
                  window.history.pushState({}, '', '/admin');
                }}
                className="bg-black/40 hover:bg-black/60 border border-white/30 text-amber-300 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all"
              >
                🔐 Painel Admin
              </button>
            </div>
          </div>
        )}

        {localScreen === 'create' && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-4xl font-black text-white title-crisp uppercase">{t.hostRoomTitle}</h2>
              <p className={curTheme.subtitleClass}>{t.hostRoomSubtitle}</p>
            </div>
            <div className="space-y-4">
              <input
                value={hostNameInput}
                onChange={(e) => setHostNameInput(e.target.value)}
                placeholder={t.yourNamePlaceholder}
                className={`w-full bg-white border-4 border-black p-4 ${curTheme.id === 'popart' ? 'rounded-full text-center' : 'rounded-2xl'} text-2xl font-black text-black placeholder-zinc-400 shadow-[0_4px_0_#000] focus:shadow-[0_6px_0_#2563eb] outline-none`}
              />
              {erro && <p className="text-red-300 font-black text-sm text-center bg-black/40 p-2 rounded-xl border border-red-500">{erro}</p>}
              <Botao theme={theme} onClick={criarSala}>{t.createRoomBtn}</Botao>
              <button
                onClick={() => setLocalScreen('home')}
                className="w-full text-center text-white/80 hover:text-white font-black uppercase text-xs pt-2"
              >
                {t.backBtn}
              </button>
            </div>
          </div>
        )}

        {localScreen === 'join' && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-4xl font-black text-white title-crisp uppercase">{t.joinRoomTitle}</h2>
              <p className={curTheme.subtitleClass}>{t.joinRoomSubtitle}</p>
            </div>
            <div className="space-y-4">
              <input
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                placeholder={t.roomCodePlaceholder}
                maxLength={5}
                className={`w-full bg-white border-4 border-black p-4 ${curTheme.id === 'popart' ? 'rounded-full' : 'rounded-2xl'} text-2xl font-black text-black outline-none uppercase text-center tracking-[0.3em] placeholder:tracking-normal placeholder-zinc-400 shadow-[0_4px_0_#000] focus:shadow-[0_6px_0_#2563eb]`}
              />
              <input
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value)}
                placeholder={t.yourNamePlaceholder}
                className={`w-full bg-white border-4 border-black p-4 ${curTheme.id === 'popart' ? 'rounded-full text-center' : 'rounded-2xl'} text-2xl font-black text-black placeholder-zinc-400 shadow-[0_4px_0_#000] focus:shadow-[0_6px_0_#2563eb] outline-none`}
              />
              {erro && <p className="text-red-300 font-black text-sm text-center bg-black/40 p-2 rounded-xl border border-red-500">{erro}</p>}
              <Botao theme={theme} onClick={entrarSala} disabled={entrando || !playerNameInput.trim() || !roomIdInput.trim()}>
                {entrando ? t.sendingAnswer : t.enterRoomBtn}
              </Botao>
              <button
                onClick={() => setLocalScreen('home')}
                className="w-full text-center text-white/80 hover:text-white font-black uppercase text-xs pt-2"
              >
                {t.backBtn}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sala de espera (LOBBY)
  if (roomState.phase === 'LOBBY') {
    return (
      <div
        className="h-screen w-screen max-w-lg mx-auto flex flex-col overflow-hidden px-6 py-6 space-y-4"
        style={curTheme.bgInlineStyle}
      >
        {renderTopBar()}

        <div className="text-center space-y-1">
          <p className="text-xs font-black text-amber-300 uppercase tracking-widest">{t.roomCodeLabel}</p>
          <div className="inline-block bg-black/60 border-4 border-amber-400 px-6 py-2 rounded-3xl shadow-xl">
            <h1 className="text-6xl font-black text-white title-crisp tracking-[0.25em]">{roomState.roomId}</h1>
          </div>
        </div>

        {souAnfitriao && qrCodeDataUrl && (
          <div className="bg-white p-4 rounded-3xl border-4 border-black mx-auto card-shadow-lg text-center space-y-2 max-w-[240px]">
            <img src={qrCodeDataUrl} alt="QR Code" className="w-44 h-44 mx-auto rounded-xl" />
            <p className="text-[11px] font-black text-black uppercase tracking-wider">
              {t.scanQrCode}
            </p>
            {joinUrl && (
              <p className="text-[10px] font-bold text-zinc-600 break-all select-all">
                {joinUrl}
              </p>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <p className="text-xs font-black text-white/90 uppercase tracking-wider mb-1">
            {t.playersInRoom} ({roomState.players.length})
          </p>
          {roomState.players.map((p) => (
            <div
              key={p.id}
              className="bg-white border-3 border-black rounded-2xl p-3.5 flex justify-between items-center card-shadow"
            >
              <div className="flex items-center gap-2">
                <span className="font-black text-xl text-black">{p.name}</span>
                {p.isHost && (
                  <span className="bg-amber-300 text-black border-2 border-black text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                    {t.hostBadge}
                  </span>
                )}
                {p.isBot && (
                  <span className="bg-purple-100 text-purple-900 border-2 border-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                    🤖 Bot
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-lg border-2 ${
                  p.connected
                    ? 'bg-emerald-100 border-emerald-600 text-emerald-800'
                    : 'bg-zinc-100 border-zinc-400 text-zinc-600'
                }`}
              >
                {p.connected ? '● online' : '○ offline'}
              </span>
            </div>
          ))}
        </div>

        {souAnfitriao ? (
          <div className="space-y-2 pt-2">
            <Botao theme={theme} onClick={iniciarPartida} disabled={roomState.players.length < 3}>
              {roomState.players.length < 3 ? t.waitingPlayersMsg : t.startGameBtn}
            </Botao>
            {roomState.players.length < 3 && (
              <p className="text-[11px] text-center text-amber-200 font-bold uppercase">
                {lang === 'pt'
                  ? `Adicione mais ${3 - roomState.players.length} pessoa(s) para começar`
                  : `Add ${3 - roomState.players.length} more player(s) to start`}
              </p>
            )}
          </div>
        ) : (
          <div className="bg-black/30 border-2 border-white/20 p-4 rounded-2xl text-center">
            <p className="text-white font-black uppercase text-sm animate-pulse">
              {t.waitingHostStart}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Oportunidade Coringa Relâmpago (quem clicar primeiro ganha!)
  if (roomState.phase === 'WILDCARD_OFFER' && coringaRush && !souAnfitriao) {
    return (
      <div
        className="h-screen w-screen max-w-lg mx-auto flex flex-col items-center justify-center overflow-hidden px-6 space-y-6 text-center animate-urgent"
        style={curTheme.bgInlineStyle}
      >
        {renderTopBar()}
        <div className="space-y-2">
          <span className="bg-amber-400 text-black border-2 border-black font-black text-xs px-3 py-1 rounded-full uppercase tracking-widest animate-bounce">
            ⚡ {lang === 'pt' ? 'RELÂMPAGO' : 'FLASH JOKER'}
          </span>
          <p className="text-4xl font-black text-white title-crisp uppercase leading-tight">
            {t.wildcardTitle}
          </p>
          <p className="text-amber-300 font-bold text-xs uppercase tracking-wider">
            {t.wildcardSubtext}
          </p>
        </div>

        <div className="bg-black/60 border-4 border-white px-8 py-2 rounded-3xl">
          <div className={`text-5xl font-black ${coringaRush.segundos <= 2 ? 'text-red-500 animate-urgent' : 'text-amber-300'}`}>
            {coringaRush.segundos}s
          </div>
        </div>

        {coringaClaimFeedback ? (
          <div className="bg-white border-4 border-black p-6 rounded-3xl card-shadow-lg max-w-sm text-black font-black text-xl animate-bounce">
            {coringaClaimFeedback}
          </div>
        ) : (
          <div className="w-full max-w-sm space-y-4">
            <button
              onClick={pegarCoringa}
              className={`btn-3d w-full py-6 px-4 ${curTheme.id === 'popart' ? 'rounded-full' : 'rounded-3xl'} font-black text-2xl uppercase tracking-wider bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 border-4 border-black text-black shadow-2xl animate-pulse`}
            >
              {t.wildcardIWantBtn}
            </button>
            <p className="text-white/80 font-bold uppercase text-xs tracking-widest">
              {lang === 'pt' ? 'Corre que qualquer um na mesa pode pegar!' : 'Hurry, anyone at the table can grab it!'}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Avaliação da Leitura do Anfitrião pela Mesa
  if (roomState.phase === 'READING_EVALUATION') {
    return (
      <div
        className="h-screen w-screen max-w-lg mx-auto flex flex-col overflow-hidden px-6 py-6 space-y-4"
        style={curTheme.bgInlineStyle}
      >
        {renderTopBar()}

        {/* 1. PERGUNTA FIXA NO TOPO */}
        {roomState.currentPrompt && (
          <div className={`${curTheme.cardPromptClass} text-center shadow-lg border-3 border-black select-none`}>
            <span className="inline-block bg-amber-400 text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-1 tracking-widest border border-black shadow-[0_2px_0_#000]">
              {t.roundQuestionFixed}
            </span>
            <p className="text-lg md:text-xl font-black leading-snug">
              {roomState.currentPrompt.text}
            </p>
          </div>
        )}

        {!souAnfitriao && !meuVotoLeituraEnviado ? (
          <div className="flex-1 flex flex-col justify-center items-center space-y-5 text-center px-2">
            <div className="bg-white border-4 border-black rounded-3xl p-6 max-w-sm shadow-[0_8px_0_#000] space-y-2">
              <span className="text-4xl inline-block animate-bounce">🗣️</span>
              <h3 className="text-xl font-black uppercase text-black">
                {t.tableEvaluationTitle}
              </h3>
              <p className="text-sm font-bold text-zinc-600 uppercase leading-relaxed">
                {t.tableEvaluationQuestion.replace('{name}', currentHostPlayer?.name || 'o Anfitrião')}
              </p>
            </div>

            <div className="w-full max-w-sm grid grid-cols-2 gap-3 pt-2">
              <Botao
                theme={theme}
                variant="danger"
                onClick={() => {
                  socketRef.current?.emit('reading:evaluate', { roomId: roomState.roomId, playerId: myPlayerId, leuBem: false });
                  setMeuVotoLeituraEnviado(true);
                  tocar('penalidade');
                }}
              >
                {t.evalVoteNo}
              </Botao>
              <Botao
                theme={theme}
                variant="success"
                onClick={() => {
                  socketRef.current?.emit('reading:evaluate', { roomId: roomState.roomId, playerId: myPlayerId, leuBem: true });
                  setMeuVotoLeituraEnviado(true);
                  tocar('jogador_entrou');
                }}
              >
                {t.evalVoteYes}
              </Botao>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center px-4">
            <div className="bg-white border-4 border-black rounded-3xl p-6 max-w-sm card-shadow-lg space-y-3">
              <span className="text-4xl animate-spin inline-block">⚖️</span>
              <h3 className="text-lg font-black uppercase text-black">
                {t.evalWaitingHost}
              </h3>
              <p className="text-xs font-bold text-zinc-500 uppercase">
                {t.voteSentMsg}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Revelação da Rodada com Frase Vencedora e Placar Completo
  if (roomState.phase === 'REVEAL_ROUND' && revealPayload) {
    const meta = revealPayload.winningScore || roomState.winningScore || 4.0;
    const ranking = [...(revealPayload.placar || roomState.players)].sort((a, b) => b.score - a.score);

    return (
      <div
        className="h-screen w-screen max-w-lg mx-auto flex flex-col overflow-y-auto px-6 py-6 space-y-4 text-center"
        style={curTheme.bgInlineStyle}
      >
        {renderTopBar()}

        {/* 1. Mensagem de resultado */}
        <div className="space-y-0.5">
          <p className="text-3xl md:text-4xl font-black text-white title-crisp uppercase leading-tight">
            {revealPayload.mensagem}
          </p>
          <p className="text-amber-300 font-bold uppercase text-xs tracking-wider">
            {revealPayload.subtexto}
          </p>
        </div>

        {/* 2. Feedback da Avaliação de Leitura */}
        {revealPayload.avaliacaoLeitura && (
          <div
            className={`p-2.5 rounded-2xl border-3 border-black font-black text-xs uppercase ${
              revealPayload.avaliacaoLeitura.leuBem
                ? 'bg-emerald-400 text-black shadow-[0_3px_0_#000]'
                : 'bg-rose-500 text-white shadow-[0_3px_0_#000] animate-urgent'
            }`}
          >
            {revealPayload.avaliacaoLeitura.leuBem ? t.evalApproved : t.evalPenalty}
          </div>
        )}

        {/* 3. Frase Vencedora Completa */}
        <div className="bg-white border-4 border-black rounded-3xl p-4 card-shadow-lg rotate-0.5 max-w-sm w-full mx-auto">
          <span className="inline-block bg-black text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-1 tracking-widest">
            {t.winningPhraseLabel}
          </span>
          <p
            className="text-base md:text-lg leading-snug text-black font-black"
            dangerouslySetInnerHTML={{ __html: montarFrase(revealPayload.frase.texto, revealPayload.frase.respostas) }}
          />
        </div>

        {/* 4. Placar Geral da Mesa */}
        <div className="bg-black/40 backdrop-blur-md rounded-3xl p-4 w-full max-w-sm mx-auto text-left space-y-2 border-2 border-white/20">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-black uppercase tracking-wider text-amber-300">
              {t.scoreboardTitle}
            </span>
            <span className="text-[10px] font-black uppercase text-white/90 bg-white/20 px-2 py-0.5 rounded-lg">
              {t.scoreboardGoal.replace('{goal}', meta.toFixed(1))}
            </span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
            {ranking.map((p, idx) => {
              const faltamPts = Math.max(0, meta - p.score);
              const pct = Math.min(100, (p.score / meta) * 100);
              return (
                <div
                  key={p.id}
                  className={`p-2.5 rounded-2xl border-2 border-black ${
                    p.id === myPlayerId ? 'bg-amber-100 border-amber-500' : 'bg-white'
                  } text-black card-shadow space-y-1`}
                >
                  <div className="flex justify-between items-center text-xs font-black">
                    <div className="flex items-center gap-1.5">
                      <span>{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}º`}</span>
                      <span className="truncate max-w-[120px] font-black">{p.name}</span>
                      {p.id === roomState.hostId && (
                        <span className="bg-amber-400 text-black text-[9px] px-1.5 py-0.2 rounded font-black">👑</span>
                      )}
                      {p.id === myPlayerId && (
                        <span className="bg-sky-200 text-sky-900 text-[9px] px-1 rounded font-bold">VOCÊ</span>
                      )}
                    </div>
                    <span className="text-sm font-black">{p.score.toFixed(1)} pts</span>
                  </div>

                  {/* Barra de Progresso visual */}
                  <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden border border-black/30">
                    <div
                      className="bg-gradient-to-r from-amber-400 to-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-zinc-500 uppercase">
                    <span>{pct.toFixed(0)}% da meta</span>
                    <span className="text-amber-700 font-black">{t.ptsRemaining.replace('{pts}', faltamPts.toFixed(1))}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Ação do Anfitrião para avançar */}
        {souAnfitriao ? (
          <div className="w-full max-w-sm mx-auto pt-1">
            <Botao
              theme={theme}
              onClick={() => socketRef.current?.emit('game:next_round', { roomId: roomState.roomId })}
            >
              {lang === 'pt' ? 'PRÓXIMA RODADA ➡️' : 'NEXT ROUND ➡️'}
            </Botao>
          </div>
        ) : (
          <p className="text-white/80 font-bold uppercase text-[11px] tracking-widest">
            {t.nextRoundSoon}
          </p>
        )}
      </div>
    );
  }

  // Fim de jogo
  if (roomState.phase === 'GAME_OVER' && championPayload) {
    return (
      <div
        className="h-screen w-screen max-w-lg mx-auto flex flex-col overflow-y-auto px-6 py-8 space-y-6 text-center"
        style={curTheme.bgInlineStyle}
      >
        <div className="space-y-1">
          <h2 className="text-6xl font-black uppercase tracking-tight title-crisp text-white">{t.gameOverTitle}</h2>
          <p className="text-xl font-black uppercase tracking-widest text-amber-300">{t.gameOverSubtitle}</p>
        </div>

        <div className="bg-black text-white p-6 rounded-3xl w-full max-w-sm mx-auto rotate-1 shadow-2xl border-4 border-white space-y-1">
          <span className="text-3xl">👑</span>
          <h3 className="text-4xl font-black uppercase tracking-tight">{championPayload.campeao}</h3>
          <p className="text-amber-300 font-bold text-xs uppercase tracking-widest">{t.championBadge}</p>
        </div>

        <div className="bg-black/30 backdrop-blur-md rounded-3xl p-5 w-full max-w-sm mx-auto text-left space-y-3 border-2 border-white/20">
          <p className="text-xs font-black uppercase tracking-widest text-white">{t.finalScoreLabel}</p>
          {championPayload.ranking.map((p, i) => (
            <div key={p.id} className="flex justify-between items-center text-sm font-black bg-white p-2.5 rounded-xl border-2 border-black text-black card-shadow">
              <span>{i + 1}. {p.name} {p.name === championPayload.campeao ? '👑' : ''}</span>
              <span>{p.score.toFixed(1)} pts</span>
            </div>
          ))}
        </div>

        <div className="space-y-3 w-full max-w-sm mx-auto">
          <Botao theme={theme} variant="primary" onClick={() => jogarNovamente(true)}>{t.playAgainBtn}</Botao>
          <Botao theme={theme} variant="secondary" onClick={() => jogarNovamente(false)}>{t.exitRoomBtn}</Botao>
        </div>
      </div>
    );
  }

  // Anfitrião confirma ou sorteia outra pergunta
  if (roomState.phase === 'PROMPT_SELECTION') {
    return (
      <div
        className="h-screen w-screen max-w-lg mx-auto flex flex-col overflow-hidden px-6 py-6 space-y-5"
        style={curTheme.bgInlineStyle}
      >
        {renderTopBar()}

        {souAnfitriao ? (
          <div className="flex-1 flex flex-col justify-between py-2 space-y-4">
            <div className="space-y-1 text-center">
              <h2 className="text-3xl font-black text-white title-crisp uppercase">
                {t.yourTurn.replace('{name}', meuNome || '')}
              </h2>
              <p className={curTheme.subtitleClass}>
                {t.promptDrawnSubtitle}
              </p>
            </div>

            <div className={`${curTheme.cardPromptClass} space-y-3 text-center my-auto`}>
              <span className="inline-block bg-[#003388] text-white text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-widest">
                {t.roundCardLabel} ({roomState.currentPrompt?.slots || 1} {t.spacesLabel})
              </span>
              <p className="text-2xl font-black leading-snug">
                {roomState.currentPrompt?.text || '...'}
              </p>
            </div>

            <div className="space-y-3">
              <Botao theme={theme} onClick={confirmarPergunta} disabled={!roomState.currentPrompt}>
                {t.useThisQuestionBtn}
              </Botao>
              <div className="text-center space-y-1">
                <Botao
                  theme={theme}
                  variant="secondary"
                  onClick={sortearPergunta}
                  disabled={(roomState.promptDrawsLeft ?? 3) <= 0}
                >
                  {(roomState.promptDrawsLeft ?? 3) <= 0
                    ? t.drawLimitReached
                    : `${t.drawAnotherBtn} (${roomState.promptDrawsLeft ?? 3}/${roomState.maxPromptDraws ?? 3})`}
                </Botao>
                <p className="text-[11px] font-bold text-amber-300 uppercase">
                  {t.drawsLeftLabel
                    .replace('{left}', String(roomState.promptDrawsLeft ?? 3))
                    .replace('{max}', String(roomState.maxPromptDraws ?? 3))}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center px-4">
            <span className="text-5xl animate-bounce">⏳</span>
            <div className="bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg max-w-sm">
              <p className="text-xl font-black text-black uppercase leading-relaxed">
                {t.waitingHostPrompt.replace('{name}', currentHostPlayer?.name || '')}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Responder (mão de cartas ou texto livre se coringa)
  if (roomState.phase === 'SUBMIT_ANSWERS' || roomState.phase === 'WILDCARD_OFFER') {
    if (souAnfitriao) {
      return (
        <div
          className="h-screen w-screen max-w-lg mx-auto flex flex-col overflow-hidden px-6 py-6 space-y-6"
          style={curTheme.bgInlineStyle}
        >
          {renderTopBar()}
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
            <span className="text-5xl">✍️</span>
            <div className="bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg max-w-sm rotate-[-0.5deg]">
              <span className="inline-block bg-black text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-3 tracking-widest">
                {t.yourQuestion}
              </span>
              <p className="text-2xl text-black font-black leading-relaxed">{roomState.currentPrompt?.text}</p>
            </div>
            <div className="bg-black/40 border-2 border-white/30 px-6 py-3 rounded-2xl">
              <p className="text-amber-300 font-black uppercase text-sm animate-pulse">
                {t.waitingAnswers}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (minhaRespostaEnviada) {
      return (
        <div
          className="h-screen w-screen max-w-lg mx-auto flex flex-col overflow-hidden px-6 py-6 space-y-4"
          style={curTheme.bgInlineStyle}
        >
          {renderTopBar()}

          {/* 1. PERGUNTA FIXA NO TOPO */}
          {roomState.currentPrompt && (
            <div className={`${curTheme.cardPromptClass} text-center shadow-lg border-3 border-black select-none`}>
              <span className="inline-block bg-amber-400 text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-1 tracking-widest border border-black shadow-[0_2px_0_#000]">
                {t.roundQuestionFixed}
              </span>
              <p className="text-lg md:text-xl font-black leading-snug">
                {roomState.currentPrompt.text}
              </p>
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center px-4">
            <div className="bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg max-w-sm space-y-3">
              <span className="text-4xl inline-block animate-bounce">✅</span>
              <h3 className="text-xl font-black uppercase text-black">
                {lang === 'pt' ? 'RESPOSTA ENVIADA!' : 'ANSWER SUBMITTED!'}
              </h3>
              <p className="text-sm font-bold text-zinc-600 uppercase leading-relaxed">
                {lang === 'pt'
                  ? `Aguardando anfitrião ${currentHostPlayer?.name || ''}...`
                  : `Waiting for host ${currentHostPlayer?.name || ''}...`}
              </p>
            </div>
          </div>
        </div>
      );
    }

    const slots = roomState.currentPrompt?.slots || 1;

    return (
      <div
        className="h-screen w-screen max-w-lg mx-auto flex flex-col overflow-hidden px-6 py-6 space-y-4"
        style={curTheme.bgInlineStyle}
      >
        {renderTopBar()}

        <div className="bg-white border-4 border-black rounded-3xl p-5 card-shadow rotate-[-0.5deg]">
          <span className="inline-block bg-black text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full mb-2 tracking-widest">
            {t.completePhrase}
          </span>
          <p className="text-xl text-black font-black leading-snug">{roomState.currentPrompt?.text}</p>
        </div>

        {roomState.isWildcardHolder ? (
          <div className="flex-1 space-y-3 overflow-y-auto">
            <div className="bg-amber-400 border-3 border-black rounded-2xl p-2 text-center text-black font-black text-xs uppercase tracking-wider">
              {t.wildcardTypingNotice}
            </div>
            {Array.from({ length: slots }).map((_, idx) => (
              <div key={idx} className="space-y-1">
                <label className="text-[11px] font-black text-white/80 uppercase">
                  {t.spaceNumber.replace('{num}', String(idx + 1))}
                </label>
                <input
                  value={freeTexts[idx] || ''}
                  onChange={(e) =>
                    setFreeTexts((prev) => {
                      const cp = [...prev];
                      cp[idx] = e.target.value;
                      return cp;
                    })
                  }
                  placeholder={t.typeYourAnswer.replace('{num}', String(idx + 1))}
                  className="w-full bg-white border-4 border-black p-4 rounded-2xl text-xl font-black text-black outline-none card-shadow focus:border-blue-600"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
            <p className="text-white/90 font-black uppercase text-xs text-center">
              {t.chooseFromHand.replace('{slots}', String(slots))}
            </p>
            {roomState.yourHand.map((carta, idx) => {
              const selectedIndex = handSelection.indexOf(idx);
              const selecionada = selectedIndex !== -1;
              const isPop = curTheme.id === 'popart';
              return (
                <div key={idx} className="relative flex items-center justify-center my-1 w-full">
                  {isPop && <div className="absolute left-0 right-0 h-0.5 bg-white/30 pointer-events-none" />}
                  <button
                    onClick={() =>
                      setHandSelection((prev) => {
                        const next = prev.includes(idx)
                          ? prev.filter((i) => i !== idx)
                          : prev.length >= slots
                          ? prev
                          : [...prev, idx];
                        if (next.length === slots) {
                          setTimeout(() => {
                            btnSubmitRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                          }, 60);
                        }
                        return next;
                      })
                    }
                    className={curTheme.cardOptionClass(selecionada)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {isPop && (
                          <span className="font-black text-[#003388] bg-sky-100 px-2.5 py-0.5 rounded-full text-sm">
                            {String.fromCharCode(65 + idx)}:
                          </span>
                        )}
                        <span className={isPop ? 'text-[#003388] font-black' : 'text-black font-black'}>{carta}</span>
                      </div>
                      {selecionada && (
                        <span className="bg-amber-400 text-black border-2 border-black text-[10px] font-black px-2 py-0.5 rounded-lg uppercase flex-shrink-0">
                          {slots > 1 ? `${selectedIndex + 1}º` : '✔'}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div ref={btnSubmitRef} className="pt-1">
          <Botao
            theme={theme}
            onClick={enviarResposta}
            disabled={
              aguardandoEnvio ||
              (roomState.isWildcardHolder
                ? freeTexts.slice(0, slots).some((t) => !t.trim())
                : handSelection.length !== slots)
            }
          >
            {aguardandoEnvio ? t.sendingAnswer : t.confirmAnswerBtn}
          </Botao>
        </div>
      </div>
    );
  }

  // Anfitrião escolhe a vencedora
  if (roomState.phase === 'JUDGMENT_PICKING') {
    const candidateSubmissions = (pickingSubmissions && pickingSubmissions.length > 0
      ? pickingSubmissions
      : roomState.pickingSubmissions) || [];

    if (!souAnfitriao) {
      return (
        <div
          className="h-screen w-screen max-w-lg mx-auto flex flex-col overflow-hidden px-6 py-6 space-y-4"
          style={curTheme.bgInlineStyle}
        >
          {renderTopBar()}

          {/* 1. PERGUNTA FIXA NO TOPO */}
          {roomState.currentPrompt && (
            <div className={`${curTheme.cardPromptClass} text-center shadow-lg border-3 border-black select-none`}>
              <span className="inline-block bg-amber-400 text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-1 tracking-widest border border-black shadow-[0_2px_0_#000]">
                {t.roundQuestionFixed}
              </span>
              <p className="text-lg md:text-xl font-black leading-snug">
                {roomState.currentPrompt.text}
              </p>
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center px-4">
            <span className="text-5xl animate-bounce">👑</span>
            <div className="bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg max-w-sm space-y-2">
              <h3 className="text-xl font-black uppercase text-black">
                {lang === 'pt' ? 'ANFITRIÃO VAI ESCOLHER' : 'THE HOST WILL CHOOSE'}
              </h3>
              <p className="text-sm font-bold text-zinc-600 uppercase leading-relaxed">
                {lang === 'pt'
                  ? `O anfitrião ${currentHostPlayer?.name || ''} vai ler as respostas em voz alta e escolher a melhor!`
                  : `Host ${currentHostPlayer?.name || ''} will read the answers aloud and choose the best!`}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="h-screen w-screen max-w-lg mx-auto flex flex-col overflow-hidden px-6 py-6 space-y-3"
        style={curTheme.bgInlineStyle}
      >
        {renderTopBar()}

        {/* 1. PERGUNTA FIXA NO TOPO */}
        {roomState.currentPrompt && (
          <div className={`${curTheme.cardPromptClass} text-center shadow-lg border-3 border-black select-none`}>
            <span className="inline-block bg-amber-400 text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-1 tracking-widest border border-black shadow-[0_2px_0_#000]">
              {t.roundQuestionFixed}
            </span>
            <p className="text-lg md:text-xl font-black leading-snug">
              {roomState.currentPrompt.text}
            </p>
          </div>
        )}

        <div className="text-center">
          <h2 className="text-2xl font-black text-white title-crisp uppercase">
            {lang === 'pt' ? '🗣️ LEIA EM VOZ ALTA E ESCOLHA A MELHOR!' : '🗣️ READ ALOUD AND PICK THE BEST!'}
          </h2>
          <p className="text-amber-300 font-bold uppercase text-xs mt-0.5">
            {lang === 'pt' ? 'A frase mais engraçada leva +0.8 ponto' : 'Funniest response takes +0.8 points'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {candidateSubmissions.map((s, i) => (
            <div
              key={s.submissionId}
              className={`bg-white border-4 border-black ${curTheme.id === 'popart' ? 'rounded-[2rem]' : 'rounded-3xl'} p-4 card-shadow transition-transform ${
                i % 2 === 0 ? '-rotate-0.5' : 'rotate-0.5'
              }`}
            >
              {roomState.currentPrompt && roomState.currentPrompt.text.includes('___') ? (
                <p
                  className="text-lg text-black font-black mb-3 leading-snug"
                  dangerouslySetInnerHTML={{
                    __html: montarFrase(roomState.currentPrompt.text, s.texts),
                  }}
                />
              ) : (
                <p className="text-lg text-black font-black mb-3 leading-snug">
                  {s.texts.join('  •  ')}
                </p>
              )}
              <Botao theme={theme} onClick={() => escolherVencedora(s.submissionId)}>
                {lang === 'pt' ? '👑 ESCOLHER ESTA VENCEDORA' : '👑 PICK THIS WINNER'}
              </Botao>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen max-w-lg mx-auto flex items-center justify-center overflow-hidden"
      style={curTheme.bgInlineStyle}
    >
      <p className="text-white font-black uppercase tracking-widest text-sm animate-pulse">Carregando...</p>
    </div>
  );
};

export default App;
