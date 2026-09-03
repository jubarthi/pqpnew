import { config } from 'dotenv';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../.env.local') });
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import QRCode from 'qrcode';
import { criarSala, buscarSala, entrarNaSala, podeComecar, removerSalaVazia, listarSalas } from './RoomManager.js';
import { getConfiguracoes, drawRandomPergunta, drawRespostas } from './content.js';
import { startTunnel, getActiveTunnelUrl } from './tunnel.js';
import type { Room, Player } from './types.js';
import {
  WINNING_SCORE,
  ROUND_WIN_POINTS,
  READ_ALOUD_PENALTY,
  MAX_PROMPT_DRAWS,
  ANSWER_SECONDS,
  round1,
} from './types.js';

export function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  const validIps: { ip: string; priority: number }[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const ip = iface.address;
        // Ignora endereços de link-local (169.254.x.x) e loopbacks
        if (!ip.startsWith('169.254.') && !ip.startsWith('127.')) {
          let priority = 1;
          const lowerName = name.toLowerCase();
          if (lowerName.includes('ethernet') || lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wlan')) {
            priority += 5;
          }
          if (ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
            priority += 3;
          }
          validIps.push({ ip, priority });
        }
      }
    }
  }

  if (validIps.length > 0) {
    validIps.sort((a, b) => b.priority - a.priority);
    return validIps[0].ip;
  }
  return 'localhost';
}

import { adminRouter } from './routes/adminRoutes.js';

const PORT = Number(process.env.PORT) || 3001;
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || '';

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/api/admin', adminRouter);
app.get('/health', (_req, res) => res.json({ ok: true, timestamp: Date.now() }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['polling', 'websocket'],
});

const MENSAGENS_PERDEDOR = [
  '💩 SEU LIXO! PERDEU!',
  '🤡 TENTOU SER ENGRAÇADO E PASSOU VERGONHA.',
  '📉 RESPOSTA HORRÍVEL! NEM SUA MÃE RIA DISSO.',
  '🤦 SE FOR PRA JOGAR ISSO, ERA MELHOR NEM TER VINDO.',
];

function publicPlayer(p: Player) {
  return {
    id: p.id,
    name: p.name,
    score: p.score,
    penalties: p.penalties,
    isHost: p.isHost,
    connected: p.connected,
    isBot: !!p.isBot,
  };
}

function ehHostValido(room: Room, playerId: string | undefined, socketId: string): boolean {
  if (!playerId) return false;
  const jogador = room.players.find((p) => p.id === playerId);
  return !!jogador && jogador.isHost && (jogador.isBot || jogador.socketId === socketId);
}

function emitToPlayer(room: Room, playerId: string, event: string, payload: unknown) {
  const player = room.players.find((p) => p.id === playerId);
  if (player?.socketId) io.to(player.socketId).emit(event, payload);
}

function broadcastState(room: Room) {
  const pickingSubmissions =
    room.phase === 'JUDGMENT_PICKING' || room.phase === 'READING_EVALUATION'
      ? room.shuffledSubmissions.map((s) => ({ submissionId: s.playerId, texts: s.texts }))
      : undefined;

  const currentHost = room.players.find((p) => p.id === room.hostId);
  const promptDrawsLeft = Math.max(0, MAX_PROMPT_DRAWS - (room.promptDrawsCount || 0));
  const evaluationInfo =
    room.phase === 'READING_EVALUATION' && currentHost
      ? { hostName: currentHost.name, seconds: 5 }
      : undefined;

  for (const p of room.players) {
    if (!p.socketId) continue;
    io.to(p.socketId).emit('room:state_update', {
      roomId: room.id,
      phase: room.phase,
      players: room.players.map(publicPlayer),
      hostId: room.hostId,
      currentPrompt: room.currentPrompt,
      promptDrawsLeft,
      maxPromptDraws: MAX_PROMPT_DRAWS,
      yourHand: p.hand,
      isWildcardHolder: p.id === room.wildcardHolderId,
      winningScore: WINNING_SCORE,
      lang: room.lang,
      isMuted: room.isMuted,
      pickingSubmissions,
      evaluationInfo,
    });
  }
}

function elegiveisParaResponder(room: Room): Player[] {
  return room.players.filter((p) => !p.isHost && p.connected);
}

async function reporMao(room: Room, jogador: Player, quantidadeAlvo: number) {
  if (jogador.hand.length >= quantidadeAlvo) return;
  const faltam = quantidadeAlvo - jogador.hand.length;
  const excluir = room.players.flatMap((p) => p.hand);
  const novas = await drawRespostas(faltam, excluir, room.lang);
  jogador.hand.push(...novas);
}

async function iniciarOfertaDeCoringa(room: Room) {
  const cfg = await getConfiguracoes();
  room.wildcardPendingId = null;
  room.wildcardHolderId = null;

  // O Coringa não aparece na 1ª rodada. A partir da 2ª, surge de surpresa (50% de chance)
  const deveSurgir = cfg.coringa_ativo && room.roundNumber > 1 && Math.random() <= 0.50;

  if (!deveSurgir) {
    return iniciarRespostas(room);
  }

  const candidatos = elegiveisParaResponder(room);
  if (candidatos.length === 0) {
    return iniciarRespostas(room);
  }

  room.phase = 'WILDCARD_OFFER';
  const tempoSegundos = cfg.coringa_segundos || 5;

  // Notifica todos os jogadores elegíveis ao mesmo tempo na tela
  io.to(room.id).emit('coringa:rush_offer', {
    segundos: tempoSegundos,
    mensagem: 'OPORTUNIDADE CORINGA: VOCÊ É O PALHAÇO DA VEZ?',
    subtexto: 'O primeiro a clicar ganha o direito exclusivo de escrever a resposta que quiser!',
  });
  broadcastState(room);

  if (room.wildcardTimer) clearTimeout(room.wildcardTimer);
  room.wildcardTimer = setTimeout(() => {
    if (room.phase === 'WILDCARD_OFFER') {
      iniciarRespostas(room);
    }
  }, tempoSegundos * 1000);
}

function processarBotsRespostas(room: Room) {
  if (!room.currentPrompt) return;
  const slots = room.currentPrompt.slots || 1;
  const bots = room.players.filter((p) => p.isBot && !p.isHost && p.connected);

  bots.forEach((bot, idx) => {
    const delay = 1200 + (idx * 900) + Math.random() * 800;
    setTimeout(async () => {
      if (room.phase !== 'SUBMIT_ANSWERS') return;
      if (room.submissions.some((s) => s.playerId === bot.id)) return;

      let texts: string[] = [];
      const isWildcard = bot.id === room.wildcardHolderId;

      if (isWildcard) {
        texts = await drawRespostas(slots, []);
      } else {
        if (bot.hand.length < slots) {
          await reporMao(room, bot, 5);
        }
        texts = bot.hand.slice(0, slots);
        bot.hand = bot.hand.filter((c) => !texts.includes(c));
      }

      room.submissions.push({
        playerId: bot.id,
        texts,
        isWildcard,
      });

      broadcastState(room);

      const totalEsperado = elegiveisParaResponder(room).length;
      if (room.submissions.length >= totalEsperado) {
        fecharRespostas(room);
      }
    }, delay);
  });
}

async function iniciarRespostas(room: Room) {
  const cfg = await getConfiguracoes();
  room.phase = 'SUBMIT_ANSWERS';
  room.submissions = [];

  for (const jogador of elegiveisParaResponder(room)) {
    await reporMao(room, jogador, cfg.mao_tamanho);
  }

  broadcastState(room);

  // Executa jogadas automáticas dos robôs
  processarBotsRespostas(room);

  if (room.answerTimer) clearTimeout(room.answerTimer);
  room.answerTimer = setTimeout(() => fecharRespostas(room), ANSWER_SECONDS * 1000);
}

function fecharRespostas(room: Room) {
  if (room.phase !== 'SUBMIT_ANSWERS') return;
  if (room.answerTimer) clearTimeout(room.answerTimer);
  room.answerTimer = null;

  room.shuffledSubmissions = [...room.submissions].sort(() => Math.random() - 0.5);
  if (room.shuffledSubmissions.length === 0) {
    prepararPerguntaDaRodada(room);
    return;
  }

  // Vai direto para o Anfitrião com a Pergunta Fixa no Topo e Todas as Respostas na tela
  room.phase = 'JUDGMENT_PICKING';
  broadcastState(room);
  io.to(room.id).emit('round:submission_status', {
    submissions: room.shuffledSubmissions.map((s) => ({ submissionId: s.playerId, texts: s.texts })),
  });

  // Se o anfitrião for robô, escolhe a melhor resposta em 3.5s
  const host = room.players.find((p) => p.isHost);
  if (host?.isBot && room.shuffledSubmissions.length > 0) {
    setTimeout(() => {
      if (room.phase === 'JUDGMENT_PICKING' && room.shuffledSubmissions.length > 0) {
        const randomSub = room.shuffledSubmissions[Math.floor(Math.random() * room.shuffledSubmissions.length)];
        iniciarAvaliacaoDeLeitura(room, randomSub.playerId);
      }
    }, 3500);
  }
}

function iniciarAvaliacaoDeLeitura(room: Room, winnerSubmissionId: string) {
  room.pendingWinnerSubmissionId = winnerSubmissionId;
  room.phase = 'READING_EVALUATION';
  room.readVotes = {};

  const votantes = room.players.filter((p) => !p.isHost && p.connected);
  broadcastState(room);

  // Se não há votantes humanos conectados, conclui direto
  if (votantes.length === 0) {
    concluirAvaliacaoLeitura(room);
    return;
  }

  // Bots votam SIM automaticamente após 800ms
  const botsVotantes = votantes.filter((p) => p.isBot);
  if (botsVotantes.length > 0) {
    setTimeout(() => {
      if (room.phase === 'READING_EVALUATION') {
        for (const b of botsVotantes) {
          room.readVotes[b.id] = true;
        }
        if (Object.keys(room.readVotes).length >= votantes.length) {
          concluirAvaliacaoLeitura(room);
        }
      }
    }, 800);
  }

  // Timeout de 5s para não travar o jogo
  if (room.readTimer) clearTimeout(room.readTimer);
  room.readTimer = setTimeout(() => {
    if (room.phase === 'READING_EVALUATION') {
      concluirAvaliacaoLeitura(room);
    }
  }, 5000);
}

function concluirAvaliacaoLeitura(room: Room) {
  if (room.readTimer) clearTimeout(room.readTimer);
  room.readTimer = null;

  const votos = Object.values(room.readVotes);
  const sim = votos.filter(Boolean).length;
  const nao = votos.length - sim;
  const leuBem = votos.length === 0 ? true : sim >= nao;

  const host = room.players.find((p) => p.isHost);
  if (!leuBem && host) {
    host.score = round1(Math.max(0, host.score - READ_ALOUD_PENALTY));
    host.penalties += 1;
  }

  room.evaluationOutcome = { leuBem, votosSim: sim, votosNao: nao };

  if (room.pendingWinnerSubmissionId) {
    escolherVencedor(room, room.pendingWinnerSubmissionId, room.evaluationOutcome);
  }
}

function escolherVencedor(
  room: Room,
  submissionId: string,
  avaliacaoLeitura?: { leuBem: boolean; votosSim: number; votosNao: number } | null
) {
  const submissao = room.shuffledSubmissions.find((s) => s.playerId === submissionId);
  if (!submissao || !room.currentPrompt) return;

  const vencedor = room.players.find((p) => p.id === submissao.playerId);
  if (!vencedor) return;

  vencedor.score = round1(vencedor.score + ROUND_WIN_POINTS);
  room.winnerId = vencedor.id;
  room.phase = 'REVEAL_ROUND';

  const fraseCompleta = { texto: room.currentPrompt.text, respostas: submissao.texts };
  const placarAtualizado = room.players.map(publicPlayer);

  emitToPlayer(room, vencedor.id, 'round:reveal_result', {
    role: 'winner',
    mensagem: '👑 AE PORR@! VOCÊ VENCEU ESSA!',
    subtexto: `+${ROUND_WIN_POINTS.toFixed(1)} ponto na conta. Você é o novo Anfitrião da mesa.`,
    frase: fraseCompleta,
    vencedorNome: vencedor.name,
    avaliacaoLeitura,
    placar: placarAtualizado,
    winningScore: WINNING_SCORE,
  });

  const host = room.players.find((p) => p.isHost);
  if (host) {
    emitToPlayer(room, host.id, 'round:reveal_result', {
      role: 'host',
      mensagem: 'ESCOLHA FEITA!',
      subtexto: `Você coroou ${vencedor.name}. O bastão passou pra ele.`,
      frase: fraseCompleta,
      vencedorNome: vencedor.name,
      avaliacaoLeitura,
      placar: placarAtualizado,
      winningScore: WINNING_SCORE,
    });
  }

  for (const p of room.players) {
    if (p.id === vencedor.id || p.isHost) continue;
    emitToPlayer(room, p.id, 'round:reveal_result', {
      role: 'loser',
      mensagem: MENSAGENS_PERDEDOR[Math.floor(Math.random() * MENSAGENS_PERDEDOR.length)],
      subtexto: `A frase de ${vencedor.name} levou a rodada.`,
      frase: fraseCompleta,
      vencedorNome: vencedor.name,
      avaliacaoLeitura,
      placar: placarAtualizado,
      winningScore: WINNING_SCORE,
    });
  }

  broadcastState(room);

  if (vencedor.score >= WINNING_SCORE) {
    room.phase = 'GAME_OVER';
    const ranking = [...room.players].sort((a, b) => b.score - a.score).map(publicPlayer);
    io.to(room.id).emit('game:champion_declared', { ranking, campeao: vencedor.name });
  } else {
    // Se o host atual for robô, avança automaticamente após 6s
    if (host?.isBot) {
      setTimeout(() => {
        if (room.phase === 'REVEAL_ROUND') {
          proximaRodada(room);
        }
      }, 6000);
    }
  }
}

async function prepararPerguntaDaRodada(room: Room) {
  room.promptDrawsCount = 0;
  const p = await drawRandomPergunta(room.usedPromptTexts, room.lang);
  room.usedPromptTexts.push(p.texto);
  room.currentPrompt = { text: p.texto, slots: p.espacos };
  room.phase = 'PROMPT_SELECTION';
  broadcastState(room);

  const currentHost = room.players.find((p) => p.id === room.hostId);
  if (currentHost?.isBot) {
    setTimeout(() => {
      if (room.phase === 'PROMPT_SELECTION') {
        iniciarOfertaDeCoringa(room);
      }
    }, 2000);
  }
}

async function proximaRodada(room: Room) {
  if (!room.winnerId) return;
  for (const p of room.players) p.isHost = p.id === room.winnerId;
  room.hostId = room.winnerId;
  room.winnerId = null;
  room.currentPrompt = null;
  room.submissions = [];
  room.shuffledSubmissions = [];
  room.wildcardHolderId = null;
  room.wildcardOfferedTo = [];
  room.wildcardPendingId = null;
  room.roundNumber = (room.roundNumber || 1) + 1;
  await prepararPerguntaDaRodada(room);
}

const tunnelPromise = startTunnel(5175).catch(() => null);

io.on('connection', (socket) => {
  socket.on('room:create', async ({ hostName, lang = 'pt' }: { hostName: string; lang?: 'pt' | 'en' }, ack) => {
    if (!hostName?.trim()) return ack?.({ erro: 'Nome obrigatório.' });
    const { room, hostPlayerId } = criarSala(hostName, lang === 'en' ? 'en' : 'pt');
    const host = room.players.find((p) => p.id === hostPlayerId)!;
    host.socketId = socket.id;
    socket.join(room.id);

    const localIp = getLocalIp();
    const tunnelUrl =
      getActiveTunnelUrl() ||
      (await Promise.race([tunnelPromise, new Promise<null>((r) => setTimeout(() => r(null), 4000))]));

    const isRender = !!process.env.RENDER || !!process.env.RENDER_SERVICE_ID;
    const defaultPublicUrl = isRender ? 'https://pqpnew.vercel.app' : null;
    const validPublicUrl = PUBLIC_APP_URL && !PUBLIC_APP_URL.includes('localhost') ? PUBLIC_APP_URL : defaultPublicUrl;
    const baseUrl = validPublicUrl || tunnelUrl || `http://${localIp}:5175`;

    const joinUrl = `${baseUrl}/entrar/${room.id}`;
    const qrCodeDataUrl = await QRCode.toDataURL(joinUrl);

    ack?.({ roomId: room.id, hostPlayerId, joinUrl, qrCodeDataUrl });
    broadcastState(room);
  });

  socket.on('room:join', ({ roomId, playerName }: { roomId: string; playerName: string }, ack) => {
    const resultado = entrarNaSala(roomId, playerName);
    if ('erro' in resultado) return ack?.(resultado);
    const { room, player } = resultado;
    player.socketId = socket.id;
    socket.join(room.id);
    ack?.({ playerId: player.id, roomId: room.id });
    io.to(room.id).emit('round:submission_status', { evento: 'jogador_entrou', jogador: player.name });
    broadcastState(room);
  });

  socket.on('room:rejoin', ({ roomId, playerId }: { roomId: string; playerId: string }, ack) => {
    const room = buscarSala(roomId);
    const player = room?.players.find((p) => p.id === playerId);
    if (!room || !player) return ack?.({ erro: 'Sala ou jogador não encontrado.' });
    player.socketId = socket.id;
    player.connected = true;
    socket.join(room.id);
    ack?.({ ok: true });
    broadcastState(room);
  });

  socket.on('room:toggle_mute', ({ roomId }: { roomId: string }) => {
    const room = buscarSala(roomId);
    if (!room) return;
    room.isMuted = !room.isMuted;
    broadcastState(room);
  });

  socket.on('room:set_lang', ({ roomId, lang }: { roomId: string; lang: 'pt' | 'en' }) => {
    const room = buscarSala(roomId);
    if (!room || (lang !== 'pt' && lang !== 'en')) return;
    room.lang = lang;
    broadcastState(room);
  });

  socket.on('game:start', async ({ roomId, playerId }: { roomId: string; playerId: string }, ack) => {
    const room = buscarSala(roomId);
    if (!room) return ack?.({ erro: 'Sala não encontrada.' });
    if (!ehHostValido(room, playerId, socket.id)) return ack?.({ erro: 'Só o anfitrião pode iniciar a partida.' });
    if (!podeComecar(room)) return ack?.({ erro: 'Precisa de pelo menos 3 pessoas na sala.' });
    room.roundNumber = 1;
    ack?.({ ok: true });
    await prepararPerguntaDaRodada(room);
  });

  socket.on('prompt:confirm', ({ roomId, playerId }: { roomId: string; playerId: string }, ack) => {
    const room = buscarSala(roomId);
    if (!room) return ack?.({ erro: 'Sala não encontrada.' });
    if (!ehHostValido(room, playerId, socket.id)) return ack?.({ erro: 'Só o anfitrião pode confirmar a pergunta.' });
    if (!room.currentPrompt) return ack?.({ erro: 'Nenhuma pergunta sorteada.' });
    ack?.({ ok: true });
    iniciarOfertaDeCoringa(room);
  });

  socket.on('prompt:draw_random', async ({ roomId, playerId }: { roomId: string; playerId: string }, ack) => {
    const room = buscarSala(roomId);
    if (!room) return ack?.({ erro: 'Sala não encontrada.' });
    if (!ehHostValido(room, playerId, socket.id)) return ack?.({ erro: 'Só o anfitrião pode sortear a pergunta.' });
    if ((room.promptDrawsCount || 0) >= MAX_PROMPT_DRAWS) {
      return ack?.({ erro: `Limite de ${MAX_PROMPT_DRAWS} trocas de pergunta atingido nesta rodada!` });
    }
    room.promptDrawsCount = (room.promptDrawsCount || 0) + 1;
    const pergunta = await drawRandomPergunta(room.usedPromptTexts, room.lang);
    room.currentPrompt = { text: pergunta.texto, slots: pergunta.espacos };
    room.usedPromptTexts.push(pergunta.texto);
    ack?.({ ok: true, texto: pergunta.texto, drawsLeft: MAX_PROMPT_DRAWS - room.promptDrawsCount });
    broadcastState(room);
  });

  socket.on('coringa:claim', ({ roomId, playerId }: { roomId: string; playerId: string }, ack) => {
    const room = buscarSala(roomId);
    if (!room || room.phase !== 'WILDCARD_OFFER') return ack?.({ erro: 'Oferta expirada ou indisponível.' });
    if (room.wildcardHolderId) return ack?.({ erro: 'Outro jogador foi mais rápido!' });

    const jogador = room.players.find((p) => p.id === playerId);
    if (!jogador || jogador.isHost) return ack?.({ erro: 'Jogador inválido.' });

    room.wildcardHolderId = jogador.id;
    if (room.wildcardTimer) clearTimeout(room.wildcardTimer);
    room.wildcardTimer = null;

    ack?.({ ok: true, ganhou: true });
    io.to(room.id).emit('coringa:claimed', {
      mensagem: `👀 Alguém na mesa pegou o Coringa em segredo!`,
    });

    setTimeout(() => {
      if (room.phase === 'WILDCARD_OFFER') {
        iniciarRespostas(room);
      }
    }, 1200);
  });

  socket.on('answer:submit', ({ roomId, playerId, handIndexes, textoLivre }: { roomId: string; playerId: string; handIndexes?: number[]; textoLivre?: string[] }, ack) => {
    const room = buscarSala(roomId);
    if (!room || room.phase !== 'SUBMIT_ANSWERS') return ack?.({ erro: 'Não é hora de responder.' });
    const jogador = room.players.find((p) => p.id === playerId);
    if (!jogador || jogador.isHost) return ack?.({ erro: 'Jogador inválido.' });
    if (room.submissions.some((s) => s.playerId === playerId)) return ack?.({ erro: 'Você já respondeu essa rodada.' });

    const isWildcard = room.wildcardHolderId === playerId;
    let texts: string[];

    if (isWildcard) {
      texts = (textoLivre || []).map((t) => t.trim()).filter(Boolean);
      if (texts.length === 0) return ack?.({ erro: 'Escreva sua resposta.' });
    } else {
      const indices = handIndexes || [];
      texts = indices.map((i) => jogador.hand[i]).filter(Boolean);
      if (texts.length === 0) return ack?.({ erro: 'Escolha uma resposta da sua mão.' });
      jogador.hand = jogador.hand.filter((_, i) => !indices.includes(i));
    }

    room.submissions.push({ playerId, texts, isWildcard });
    ack?.({ ok: true });
    broadcastState(room);

    const faltam = elegiveisParaResponder(room).filter((p) => !room.submissions.some((s) => s.playerId === p.id));
    if (faltam.length === 0) fecharRespostas(room);
  });

  socket.on('winner:pick', ({ roomId, playerId, submissionId }: { roomId: string; playerId: string; submissionId: string }, ack) => {
    const room = buscarSala(roomId);
    if (!room || room.phase !== 'JUDGMENT_PICKING') return ack?.({ erro: 'Não é hora de escolher.' });
    if (!ehHostValido(room, playerId, socket.id)) return ack?.({ erro: 'Só o anfitrião pode escolher a vencedora.' });
    iniciarAvaliacaoDeLeitura(room, submissionId);
    ack?.({ ok: true });
  });

  socket.on('reading:evaluate', ({ roomId, playerId, leuBem }: { roomId: string; playerId: string; leuBem: boolean }) => {
    const room = buscarSala(roomId);
    if (!room || room.phase !== 'READING_EVALUATION') return;
    const jogador = room.players.find((p) => p.id === playerId);
    if (!jogador || jogador.isHost) return;
    room.readVotes[playerId] = leuBem;

    const votantesEsperados = room.players.filter((p) => !p.isHost && p.connected).length;
    if (Object.keys(room.readVotes).length >= votantesEsperados) {
      concluirAvaliacaoLeitura(room);
    }
  });

  socket.on('game:next_round', ({ roomId }: { roomId: string }) => {
    const room = buscarSala(roomId);
    if (!room || room.phase !== 'REVEAL_ROUND') return;
    proximaRodada(room);
  });

  socket.on('game:restart', ({ roomId, playerId, keepPlayers }: { roomId: string; playerId: string; keepPlayers: boolean }) => {
    const room = buscarSala(roomId);
    if (!room) return;
    if (!ehHostValido(room, playerId, socket.id)) return;
    if (keepPlayers) {
      for (const p of room.players) {
        p.score = 0;
        p.penalties = 0;
        p.hand = [];
      }
      room.phase = 'PROMPT_SELECTION';
      room.currentPrompt = null;
      room.submissions = [];
      room.shuffledSubmissions = [];
      room.wildcardHolderId = null;
      room.wildcardOfferedTo = [];
      broadcastState(room);
    } else {
      io.to(room.id).emit('game:reset_to_lobby');
    }
  });

  socket.on('disconnect', () => {
    for (const r of listarSalas()) {
      const jogador = r.players.find((p) => p.socketId === socket.id);
      if (jogador) {
        jogador.connected = false;
        jogador.socketId = null;
        broadcastState(r);
        removerSalaVazia(r.id);
      }
    }
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`\n======================================================`);
  console.log(`🎮 [PQP Backend] Servidor iniciado com sucesso!`);
  console.log(`   Local (PC):        http://localhost:${PORT}`);
  console.log(`   Rede Wi-Fi (LAN):  http://${localIp}:${PORT}`);
  console.log(`   Jogo no Navegador: http://localhost:5175`);
  console.log(`======================================================\n`);
});
