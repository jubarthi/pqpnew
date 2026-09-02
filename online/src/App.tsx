import React, { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { RoomState } from './types';
import { useSom } from './useSom';
import { carregarConfiguracoes } from './content';

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
}> = ({ children, onClick, variant = 'primary', disabled, className = '' }) => {
  const cores = {
    primary: 'bg-gradient-to-b from-amber-300 to-amber-400 border-2 border-black text-black',
    secondary: 'bg-gradient-to-b from-blue-500 to-blue-600 border-2 border-black text-white',
    danger: 'bg-gradient-to-b from-rose-500 to-red-600 border-2 border-black text-white',
    success: 'bg-gradient-to-b from-emerald-400 to-emerald-500 border-2 border-black text-black',
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

  const [booted, setBooted] = useState(false);
  const [introUrl, setIntroUrl] = useState<string | null>(null);
  const [introTipo, setIntroTipo] = useState<'video' | 'gif' | 'imagem' | null>(null);

  const [connected, setConnected] = useState(false);
  const [localScreen, setLocalScreen] = useState<'home' | 'create' | 'join'>('home');
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

  const [readingCard, setReadingCard] = useState<{ texts: string[]; seconds: number; total: number; index: number } | null>(null);
  const [readingSecondsLeft, setReadingSecondsLeft] = useState(0);
  const [askingVote, setAskingVote] = useState(false);
  const [meuVotoEnviado, setMeuVotoEnviado] = useState(false);

  const [pickingSubmissions, setPickingSubmissions] = useState<{ submissionId: string; texts: string[] }[] | null>(null);
  const [revealPayload, setRevealPayload] = useState<RevealPayload | null>(null);
  const [championPayload, setChampionPayload] = useState<ChampionPayload | null>(null);

  const meuNome = roomState?.players.find((p) => p.id === myPlayerId)?.name;
  const souAnfitriao = !!myPlayerId && roomState?.hostId === myPlayerId;
  const currentHostPlayer = roomState?.players.find((p) => p.id === roomState.hostId);

  const [entrando, setEntrando] = useState(false);

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

  // Rota /entrar/:roomId pré-preenche o formulário de entrada
  useEffect(() => {
    const partes = window.location.pathname.split('/').filter(Boolean);
    const entrarIdx = partes.indexOf('entrar');
    if (entrarIdx !== -1 && partes[entrarIdx + 1]) {
      setRoomIdInput(partes[entrarIdx + 1].toUpperCase().trim());
      setLocalScreen('join');
    }
    const params = new URLSearchParams(window.location.search);
    const qSala = params.get('sala') || params.get('room') || params.get('r');
    if (qSala) {
      setRoomIdInput(qSala.toUpperCase().trim());
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

    socket.on('room:state_update', (payload: RoomState) => setRoomState(payload));

    socket.on('coringa:rush_offer', (payload: { segundos: number; mensagem: string; subtexto: string }) => {
      setCoringaRush(payload);
      setCoringaClaimFeedback(null);
      tocar('coringa_apareceu');
    });

    socket.on('coringa:claimed', (payload: { mensagem?: string }) => {
      setCoringaClaimFeedback((prev) => prev || payload?.mensagem || '👀 Alguém na mesa pegou o Coringa em segredo!');
      setTimeout(() => {
        setCoringaRush(null);
        setCoringaClaimFeedback(null);
      }, 1200);
    });

    socket.on('round:reading_card', (payload: { texts: string[]; seconds: number; total: number; index: number }) => {
      setReadingCard(payload);
      setReadingSecondsLeft(payload.seconds);
      setAskingVote(false);
      setMeuVotoEnviado(false);
      tocar('contagem_regressiva');
    });

    socket.on('round:ask_vote', () => {
      setAskingVote(true);
      tocar('tempo_esgotado');
    });

    socket.on('round:read_result', ({ leuAlto }: { leuAlto: boolean }) => {
      if (!leuAlto) tocar('penalidade');
      setAskingVote(false);
    });

    socket.on('round:submission_status', (payload: { evento?: string; submissions?: { submissionId: string; texts: string[] }[] }) => {
      if (payload.evento === 'jogador_entrou') tocar('jogador_entrou');
      if (payload.submissions) setPickingSubmissions(payload.submissions);
    });

    socket.on('round:reveal_result', (payload: RevealPayload) => {
      setRevealPayload(payload);
      setPickingSubmissions(null);
      tocar('rodada_vencida');
      tocar('placar');
    });

    socket.on('game:champion_declared', (payload: ChampionPayload) => {
      setChampionPayload(payload);
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
  }, []);

  // Contagem local da leitura em voz alta
  useEffect(() => {
    if (!readingCard || askingVote) return;
    if (readingSecondsLeft <= 0) return;
    const t = setTimeout(() => setReadingSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [readingCard, readingSecondsLeft, askingVote]);

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
      if (res.erro) setErro(res.erro);
    });
  }, [roomState, myPlayerId, handSelection, freeTexts]);

  const pedirParaMesa = useCallback(() => {
    socketRef.current?.emit('reading:ask_table', { roomId: roomState?.roomId, playerId: myPlayerId });
  }, [roomState?.roomId, myPlayerId]);

  const votar = useCallback(
    (leuAlto: boolean) => {
      socketRef.current?.emit('reading:vote', { roomId: roomState?.roomId, playerId: myPlayerId, leuAlto });
      setMeuVotoEnviado(true);
    },
    [roomState?.roomId, myPlayerId]
  );

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

  // Barra de status superior padrão no jogo
  const renderTopBar = () => {
    if (!roomState) return null;
    return (
      <header className="flex items-center justify-between gap-2 px-1 pb-4 text-xs font-black select-none">
        <div className="flex items-center gap-2">
          <span className="bg-black/40 backdrop-blur-sm border-2 border-white/30 px-3 py-1.5 rounded-xl text-white tracking-widest uppercase">
            SALA: <strong className="text-amber-300">{roomState.roomId}</strong>
          </span>
          {currentHostPlayer && (
            <span className="bg-amber-400 text-black border-2 border-black px-2.5 py-1.5 rounded-xl uppercase flex items-center gap-1">
              👑 {currentHostPlayer.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm border-2 border-white/30 px-2.5 py-1.5 rounded-xl text-[11px] text-white/90 uppercase">
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
          {roomState.players.length} {roomState.players.length === 1 ? 'jogador' : 'jogadores'}
        </div>
      </header>
    );
  };

  // ---------- Telas ----------

  if (!booted) {
    return (
      <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex items-center justify-center overflow-hidden">
        {introUrl && introTipo === 'video' && <video src={introUrl} autoPlay muted playsInline className="max-w-full max-h-full" />}
        {introUrl && (introTipo === 'gif' || introTipo === 'imagem') && <img src={introUrl} className="max-w-full max-h-full" alt="P.Q.P." />}
        {!introUrl && <h1 className="text-8xl font-black text-white text-comic tracking-tight">P.Q.P.</h1>}
      </div>
    );
  }

  if (!roomState) {
    return (
      <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex flex-col relative overflow-hidden px-6 py-10">
        {!connected && (
          <div className="bg-black/50 border-2 border-amber-400/80 rounded-2xl p-2.5 text-center text-amber-300 font-black text-xs uppercase mb-4 animate-pulse">
            Conectando ao servidor...
          </div>
        )}

        {localScreen === 'home' && (
          <div className="flex-1 flex flex-col items-center justify-center space-y-12 text-center">
            <div className="space-y-3 transform -rotate-1">
              <h1 className="text-8xl font-black text-white text-comic tracking-tighter drop-shadow-xl">P.Q.P.</h1>
              <p className="text-xl font-black uppercase tracking-[0.25em] text-amber-300 text-comic-sm">Pra Quem Pode</p>
            </div>
            <div className="w-full max-w-sm space-y-4">
              <Botao onClick={() => setLocalScreen('create')}>ABRIR SALA</Botao>
              <Botao variant="secondary" onClick={() => setLocalScreen('join')}>ENTRAR EM SALA</Botao>
            </div>
            <div className="bg-black/30 border-2 border-white/20 rounded-2xl px-4 py-2 text-[11px] font-bold text-white/80 uppercase tracking-wider">
              🎮 Jogo cômico com alto risco de vício
            </div>
          </div>
        )}

        {localScreen === 'create' && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-black text-white uppercase text-comic">Você é o Anfitrião</h2>
              <p className="text-amber-300 font-bold text-sm uppercase">Crie a sala e chame os amigos</p>
            </div>
            <div className="space-y-4">
              <input
                value={hostNameInput}
                onChange={(e) => setHostNameInput(e.target.value)}
                placeholder="Seu nome (ex: Carlos)"
                className="w-full bg-white border-4 border-black p-4 rounded-2xl text-2xl font-black text-black placeholder-zinc-400 shadow-[0_4px_0_#000] focus:shadow-[0_6px_0_#2563eb] outline-none"
              />
              {erro && <p className="text-red-300 font-black text-sm text-center bg-black/40 p-2 rounded-xl border border-red-500">{erro}</p>}
              <Botao onClick={criarSala}>CRIAR SALA</Botao>
              <button
                onClick={() => setLocalScreen('home')}
                className="w-full text-center text-white/70 hover:text-white font-black uppercase text-xs pt-2"
              >
                ← Voltar
              </button>
            </div>
          </div>
        )}

        {localScreen === 'join' && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-4xl font-black text-white uppercase text-comic">Entrar na Sala</h2>
              <p className="text-amber-300 font-bold text-sm uppercase">Digite o código ou use a câmera</p>
            </div>
            <div className="space-y-4">
              <input
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                placeholder="CÓDIGO (5 LETRAS)"
                maxLength={5}
                className="w-full bg-white border-4 border-black p-4 rounded-2xl text-2xl font-black text-black outline-none uppercase text-center tracking-[0.3em] placeholder:tracking-normal placeholder-zinc-400 shadow-[0_4px_0_#000] focus:shadow-[0_6px_0_#2563eb]"
              />
              <input
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value)}
                placeholder="Seu nome"
                className="w-full bg-white border-4 border-black p-4 rounded-2xl text-2xl font-black text-black placeholder-zinc-400 shadow-[0_4px_0_#000] focus:shadow-[0_6px_0_#2563eb] outline-none"
              />
              {erro && <p className="text-red-300 font-black text-sm text-center bg-black/40 p-2 rounded-xl border border-red-500">{erro}</p>}
              <Botao onClick={entrarSala} disabled={entrando || !playerNameInput.trim() || !roomIdInput.trim()}>
                {entrando ? 'ENTRANDO NA SALA...' : 'ENTRAR'}
              </Botao>
              <button
                onClick={() => setLocalScreen('home')}
                className="w-full text-center text-white/70 hover:text-white font-black uppercase text-xs pt-2"
              >
                ← Voltar
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
      <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex flex-col overflow-hidden px-6 py-8 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-xs font-black text-amber-300 uppercase tracking-widest">Código da Sala</p>
          <div className="inline-block bg-black/60 border-4 border-amber-400 px-6 py-2 rounded-3xl shadow-xl">
            <h1 className="text-6xl font-black text-white text-comic tracking-[0.25em]">{roomState.roomId}</h1>
          </div>
        </div>

        {souAnfitriao && qrCodeDataUrl && (
          <div className="bg-white p-4 rounded-3xl border-4 border-black mx-auto card-shadow-lg text-center space-y-2 max-w-[240px]">
            <img src={qrCodeDataUrl} alt="QR Code da sala" className="w-44 h-44 mx-auto rounded-xl" />
            <p className="text-[11px] font-black text-black uppercase tracking-wider">
              Aponte a câmera do celular
            </p>
            {joinUrl && (
              <p className="text-[10px] font-bold text-zinc-600 break-all select-all">
                {joinUrl}
              </p>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          <p className="text-xs font-black text-white/80 uppercase tracking-wider mb-1">
            Jogadores na mesa ({roomState.players.length})
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
                    👑 Anfitrião
                  </span>
                )}
                {p.isBot && (
                  <span className="bg-purple-100 text-purple-900 border-2 border-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                    🤖 Robô
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
            <Botao onClick={iniciarPartida} disabled={roomState.players.length < 3}>
              {roomState.players.length < 3 ? 'PRECISA DE 3 JOGADORES' : 'INICIAR PARTIDA'}
            </Botao>
            {roomState.players.length < 3 && (
              <p className="text-[11px] text-center text-amber-200 font-bold uppercase">
                Adicione mais {3 - roomState.players.length} pessoa(s) para começar
              </p>
            )}
          </div>
        ) : (
          <div className="bg-black/30 border-2 border-white/20 p-4 rounded-2xl text-center">
            <p className="text-white font-black uppercase text-sm animate-pulse">
              Aguardando o anfitrião iniciar a partida...
            </p>
          </div>
        )}
      </div>
    );
  }

  // Oportunidade Coringa Relâmpago (quem clicar primeiro ganha!)
  if (roomState.phase === 'WILDCARD_OFFER' && coringaRush && !souAnfitriao) {
    return (
      <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex flex-col items-center justify-center overflow-hidden px-6 space-y-6 text-center animate-urgent">
        {renderTopBar()}
        <div className="space-y-2">
          <span className="bg-amber-400 text-black border-2 border-black font-black text-xs px-3 py-1 rounded-full uppercase tracking-widest animate-bounce">
            ⚡ RELÂMPAGO
          </span>
          <p className="text-4xl font-black text-white text-comic uppercase leading-tight">
            VOCÊ É O PALHAÇO DA VEZ? 🃏
          </p>
          <p className="text-amber-300 font-bold text-xs uppercase tracking-wider">
            O primeiro a clicar ganha o direito exclusivo de escrever a resposta que quiser!
          </p>
        </div>

        <div className="bg-black/60 border-4 border-white px-8 py-2 rounded-3xl">
          <div className={`text-5xl font-black text-comic ${coringaRush.segundos <= 2 ? 'text-red-500 animate-urgent' : 'text-amber-300'}`}>
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
              className="btn-3d w-full py-6 px-4 rounded-3xl font-black text-2xl uppercase tracking-wider bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 border-4 border-black text-black shadow-2xl animate-pulse"
            >
              🤡 EU QUERO SER O CORINGA!
            </button>
            <p className="text-white/60 font-bold uppercase text-xs tracking-widest">
              Corre que qualquer um na mesa pode pegar!
            </p>
          </div>
        )}
      </div>
    );
  }

  // Revelação (personalizada por papel)
  if (roomState.phase === 'REVEAL_ROUND' && revealPayload) {
    return (
      <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex flex-col items-center justify-center overflow-hidden px-6 space-y-6 text-center">
        {renderTopBar()}
        <div className="space-y-1">
          <p className="text-4xl font-black text-white text-comic uppercase leading-tight">
            {revealPayload.mensagem}
          </p>
          <p className="text-amber-300 font-black uppercase text-sm tracking-wider">
            {revealPayload.subtexto}
          </p>
        </div>
        <div className="bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg rotate-1 max-w-sm">
          <span className="inline-block bg-black text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-3 tracking-widest">
            A FRASE VENCEDORA
          </span>
          <p
            className="text-xl leading-relaxed text-black font-bold"
            dangerouslySetInnerHTML={{ __html: montarFrase(revealPayload.frase.texto, revealPayload.frase.respostas) }}
          />
        </div>
        <p className="text-white/60 font-bold uppercase text-xs tracking-widest">
          Próxima rodada iniciando em instantes...
        </p>
      </div>
    );
  }

  // Fim de jogo
  if (roomState.phase === 'GAME_OVER' && championPayload) {
    return (
      <div className="h-screen w-screen max-w-lg mx-auto flex flex-col overflow-y-auto px-6 py-10 space-y-6 text-center bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 text-black">
        <div className="space-y-1">
          <h2 className="text-7xl font-black uppercase tracking-tighter text-comic text-white">VENCEDOR!</h2>
          <p className="text-xl font-black uppercase tracking-widest text-black">P.Q.P. - O JOGO É DELE</p>
        </div>

        <div className="bg-black text-white p-6 rounded-3xl w-full max-w-sm mx-auto rotate-1 shadow-2xl border-4 border-white space-y-1">
          <span className="text-3xl">👑</span>
          <h3 className="text-4xl font-black uppercase tracking-tight">{championPayload.campeao}</h3>
          <p className="text-amber-300 font-bold text-xs uppercase tracking-widest">Campeão Supremo da Mesa</p>
        </div>

        <div className="bg-black/15 rounded-3xl p-5 w-full max-w-sm mx-auto text-left space-y-3 border-2 border-black/30">
          <p className="text-xs font-black uppercase tracking-widest text-black">Placar Final</p>
          {championPayload.ranking.map((p, i) => (
            <div key={p.id} className="flex justify-between items-center text-sm font-black bg-white/70 p-2.5 rounded-xl border border-black/20">
              <span>{i + 1}. {p.name} {p.name === championPayload.campeao ? '👑' : ''}</span>
              <span>{p.score.toFixed(1)} pts</span>
            </div>
          ))}
        </div>

        <div className="space-y-3 w-full max-w-sm mx-auto">
          <Botao variant="primary" onClick={() => jogarNovamente(true)}>JOGAR NOVAMENTE</Botao>
          <Botao variant="secondary" onClick={() => jogarNovamente(false)}>SAIR DA SALA</Botao>
        </div>
      </div>
    );
  }

  // Anfitrião confirma ou sorteia outra pergunta
  if (roomState.phase === 'PROMPT_SELECTION') {
    return (
      <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex flex-col overflow-hidden px-6 py-6 space-y-5">
        {renderTopBar()}

        {souAnfitriao ? (
          <div className="flex-1 flex flex-col justify-between py-2 space-y-4">
            <div className="space-y-1 text-center">
              <h2 className="text-3xl font-black text-white text-comic uppercase">Sua vez, {meuNome}!</h2>
              <p className="text-amber-300 font-bold uppercase text-xs tracking-wider">
                Pergunta sorteada pelo sistema
              </p>
            </div>

            <div className="bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg rotate-[-0.5deg] space-y-3 text-center my-auto">
              <span className="inline-block bg-black text-white text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-widest">
                CARTA DA RODADA ({roomState.currentPrompt?.slots || 1} ESPAÇO{roomState.currentPrompt?.slots && roomState.currentPrompt.slots > 1 ? 'S' : ''})
              </span>
              <p className="text-2xl text-black font-black leading-snug">
                {roomState.currentPrompt?.text || 'Sorteando pergunta...'}
              </p>
            </div>

            <div className="space-y-3">
              <Botao onClick={confirmarPergunta} disabled={!roomState.currentPrompt}>
                USAR ESTA PERGUNTA
              </Botao>
              <Botao variant="secondary" onClick={sortearPergunta}>
                🎲 SORTEAR OUTRA PERGUNTA
              </Botao>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center px-4">
            <span className="text-5xl animate-bounce">⏳</span>
            <div className="bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg max-w-sm">
              <p className="text-xl font-black text-black uppercase leading-relaxed">
                Aguardando {currentHostPlayer?.name || 'o anfitrião'} confirmar a pergunta da rodada...
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
        <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex flex-col overflow-hidden px-6 py-6 space-y-6">
          {renderTopBar()}
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
            <span className="text-5xl">✍️</span>
            <div className="bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg max-w-sm rotate-[-0.5deg]">
              <span className="inline-block bg-black text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-3 tracking-widest">
                SUA PERGUNTA
              </span>
              <p className="text-2xl text-black font-black leading-relaxed">{roomState.currentPrompt?.text}</p>
            </div>
            <div className="bg-black/40 border-2 border-white/30 px-6 py-3 rounded-2xl">
              <p className="text-amber-300 font-black uppercase text-sm animate-pulse">
                Aguardando as respostas dos participantes...
              </p>
            </div>
          </div>
        </div>
      );
    }

    const slots = roomState.currentPrompt?.slots || 1;

    return (
      <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex flex-col overflow-hidden px-6 py-6 space-y-4">
        {renderTopBar()}

        <div className="bg-white border-4 border-black rounded-3xl p-5 card-shadow rotate-[-0.5deg]">
          <span className="inline-block bg-black text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full mb-2 tracking-widest">
            COMPLETE A FRASE
          </span>
          <p className="text-xl text-black font-black leading-snug">{roomState.currentPrompt?.text}</p>
        </div>

        {roomState.isWildcardHolder ? (
          <div className="flex-1 space-y-3 overflow-y-auto">
            <div className="bg-amber-400 border-3 border-black rounded-2xl p-2 text-center text-black font-black text-xs uppercase tracking-wider">
              🃏 Você é o Palhaço da Vez — escreva o que quiser!
            </div>
            {Array.from({ length: slots }).map((_, idx) => (
              <div key={idx} className="space-y-1">
                <label className="text-[11px] font-black text-white/80 uppercase">Espaço {idx + 1}</label>
                <input
                  value={freeTexts[idx] || ''}
                  onChange={(e) =>
                    setFreeTexts((prev) => {
                      const cp = [...prev];
                      cp[idx] = e.target.value;
                      return cp;
                    })
                  }
                  placeholder={`Digite sua resposta ${idx + 1}...`}
                  className="w-full bg-white border-4 border-black p-4 rounded-2xl text-xl font-black text-black outline-none card-shadow focus:border-blue-600"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
            <p className="text-white/90 font-black uppercase text-xs text-center">
              Escolha <strong className="text-amber-300 underline">{slots} carta(s)</strong> da sua mão:
            </p>
            {roomState.yourHand.map((carta, idx) => {
              const selectedIndex = handSelection.indexOf(idx);
              const selecionada = selectedIndex !== -1;
              return (
                <button
                  key={idx}
                  onClick={() =>
                    setHandSelection((prev) => {
                      if (prev.includes(idx)) return prev.filter((i) => i !== idx);
                      if (prev.length >= slots) return prev;
                      return [...prev, idx];
                    })
                  }
                  className={`w-full text-left p-4 rounded-2xl font-black text-base leading-snug transition-all transform select-none ${
                    selecionada
                      ? 'bg-amber-100 border-4 border-amber-500 ring-4 ring-amber-300/80 -translate-y-1 shadow-[0_8px_0_#000] text-black'
                      : 'bg-white border-3 border-black card-shadow hover:-translate-y-0.5 active:translate-y-1 text-black'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span>{carta}</span>
                    {selecionada && (
                      <span className="bg-amber-400 text-black border-2 border-black text-[10px] font-black px-2 py-0.5 rounded-lg uppercase flex-shrink-0">
                        {slots > 1 ? `${selectedIndex + 1}º Espaço` : '✔ Escolhida'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <Botao
          onClick={enviarResposta}
          disabled={
            aguardandoEnvio ||
            (roomState.isWildcardHolder
              ? freeTexts.slice(0, slots).some((t) => !t.trim())
              : handSelection.length !== slots)
          }
        >
          {aguardandoEnvio ? 'ENVIANDO...' : 'CONFIRMAR RESPOSTA'}
        </Botao>
      </div>
    );
  }

  // Leitura em voz alta pelo anfitrião + voto da mesa
  if (roomState.phase === 'JUDGMENT_READING') {
    return (
      <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex flex-col overflow-hidden px-6 py-6 space-y-5">
        {renderTopBar()}

        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs font-black text-white/80 uppercase">
              Resposta {(readingCard?.index ?? 0) + 1} de {readingCard?.total ?? '?'}
            </p>
            <p className="text-[11px] font-bold text-amber-300 uppercase">
              Anfitrião lendo para a mesa
            </p>
          </div>
          {!askingVote && (
            <div
              className={`px-4 py-1.5 rounded-2xl border-3 border-black font-black text-2xl flex items-center gap-1.5 shadow-[0_4px_0_#000] ${
                readingSecondsLeft <= 5 ? 'bg-red-500 text-white animate-urgent' : 'bg-amber-300 text-black'
              }`}
            >
              <span>⏱️</span>
              <span>{readingSecondsLeft}s</span>
            </div>
          )}
        </div>

        {readingCard && (
          <div className="bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg rotate-1">
            <span className="inline-block bg-black text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-3 tracking-widest">
              LEIA COM ENTUSIASMO 🗣️
            </span>
            <p className="text-2xl leading-relaxed text-black font-black">
              {readingCard.texts.join('  •  ')}
            </p>
          </div>
        )}

        {souAnfitriao && !askingVote && (
          <div className="flex-1 flex flex-col justify-end space-y-3">
            <Botao variant="primary" onClick={pedirParaMesa}>
              JÁ LI, PERGUNTAR PRA MESA
            </Botao>
          </div>
        )}

        {!souAnfitriao && askingVote && !meuVotoEnviado && (
          <div className="flex-1 flex flex-col justify-center items-center space-y-6">
            <div className="speech-bubble rounded-3xl p-6 max-w-sm text-center">
              <p className="text-2xl font-black uppercase text-black">
                Ele leu em voz alta a tempo? 🗣️
              </p>
              <p className="text-xs font-bold text-zinc-500 uppercase mt-1">
                A mesa decide junto
              </p>
            </div>
            <div className="w-full max-w-sm grid grid-cols-2 gap-4">
              <Botao variant="danger" onClick={() => votar(false)}>
                NÃO (-0.1)
              </Botao>
              <Botao variant="success" onClick={() => votar(true)}>
                SIM (OK)
              </Botao>
            </div>
          </div>
        )}

        {((souAnfitriao && askingVote) || (!souAnfitriao && meuVotoEnviado)) && (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-black/40 border-2 border-white/30 px-6 py-4 rounded-2xl text-center">
              <p className="text-amber-300 font-black uppercase text-sm animate-pulse">
                Apurando os votos da mesa...
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Anfitrião escolhe a vencedora
  if (roomState.phase === 'JUDGMENT_PICKING') {
    if (!souAnfitriao) {
      return (
        <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex flex-col overflow-hidden px-6 py-6">
          {renderTopBar()}
          <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-center px-4">
            <span className="text-5xl animate-bounce">👑</span>
            <div className="bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg max-w-sm">
              <p className="text-xl font-black text-black uppercase leading-relaxed">
                {currentHostPlayer?.name || 'O anfitrião'} está escolhendo a melhor resposta da rodada...
              </p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex flex-col overflow-hidden px-6 py-6 space-y-4">
        {renderTopBar()}
        <div className="text-center space-y-1">
          <h2 className="text-3xl font-black text-white text-comic uppercase">Escolha a Melhor</h2>
          <p className="text-amber-300 font-bold uppercase text-xs">A frase mais engraçada leva +0.8 ponto</p>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {(pickingSubmissions || []).map((s, i) => (
            <div
              key={s.submissionId}
              className={`bg-white border-4 border-black rounded-3xl p-5 card-shadow transition-transform ${
                i % 2 === 0 ? '-rotate-0.5' : 'rotate-0.5'
              }`}
            >
              <p className="text-xl text-black font-black mb-4 leading-snug">{s.texts.join('  •  ')}</p>
              <Botao onClick={() => escolherVencedora(s.submissionId)}>VOTAR NESTA</Botao>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex items-center justify-center overflow-hidden">
      <p className="text-white/80 font-black uppercase tracking-widest text-sm animate-pulse">Carregando...</p>
    </div>
  );
};

export default App;
