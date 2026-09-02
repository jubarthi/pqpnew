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
  READ_ALOUD_SECONDS,
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

const PORT = Number(process.env.PORT) || 3001;
const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || '';

const app = express();
app.use(cors());
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

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
  for (const p of room.players) {
    if (!p.socketId) continue;
    io.to(p.socketId).emit('room:state_update', {
      roomId: room.id,
      phase: room.phase,
      players: room.players.map(publicPlayer),
      hostId: room.hostId,
      currentPrompt: room.currentPrompt,
      yourHand: p.hand,
      isWildcardHolder: p.id === room.wildcardHolderId,
      winningScore: WINNING_SCORE,
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
  const novas = await drawRespostas(faltam, excluir);
  jogador.hand.push(...novas);
}

async function iniciarOfertaDeCoringa(room: Room) {
  const cfg = await getConfiguracoes();
  if (!cfg.coringa_ativo) {
    room.wildcardPendingId = null;
    return iniciarRespostas(room);
  }

  const candidatos = elegiveisParaResponder(room).filter((p) => !room.wildcardOfferedTo.includes(p.id));
  if (candidatos.length === 0) {
    room.wildcardPendingId = null;
    return iniciarRespostas(room);
  }

  const escolhido = candidatos[Math.floor(Math.random() * candidatos.length)];
  room.wildcardOfferedTo.push(escolhido.id);
  room.wildcardPendingId = escolhido.id;
  room.phase = 'WILDCARD_OFFER';

  emitToPlayer(room, escolhido.id, 'coringa:offer', { segundos: cfg.coringa_segundos });
  broadcastState(room);

  // Se o coringa for oferecido a um robô, ele aceita após 1.5s
  if (escolhido.isBot) {
    setTimeout(() => {
      if (room.wildcardPendingId === escolhido.id && room.phase === 'WILDCARD_OFFER') {
        room.wildcardHolderId = escolhido.id;
        room.wildcardPendingId = null;
        if (room.wildcardTimer) clearTimeout(room.wildcardTimer);
        iniciarRespostas(room);
      }
    }, 1500);
  }

  if (room.wildcardTimer) clearTimeout(room.wildcardTimer);
  room.wildcardTimer = setTimeout(() => {
    if (room.wildcardPendingId === escolhido.id) {
      room.wildcardPendingId = null;
      iniciarOfertaDeCoringa(room);
    }
  }, cfg.coringa_segundos * 1000);
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
  room.phase = 'JUDGMENT_READING';
  room.readIndex = 0;
  room.readOutcome = 'reading';
  room.readVotes = {};

  broadcastState(room);
  anunciarCartaAtual(room);
}

function anunciarCartaAtual(room: Room) {
  const atual = room.shuffledSubmissions[room.readIndex];
  if (!atual) return;
  io.to(room.id).emit('round:reading_card', {
    index: room.readIndex,
    total: room.shuffledSubmissions.length,
    texts: atual.texts,
    submissionId: atual.playerId,
    seconds: READ_ALOUD_SECONDS,
  });

  const host = room.players.find((p) => p.isHost);
  if (host?.isBot) {
    // Se o anfitrião for robô, simula leitura em 3.5 segundos
    setTimeout(() => {
      if (room.phase === 'JUDGMENT_READING' && room.readOutcome === 'reading') {
        pedirVotoDaMesa(room);
      }
    }, 3500);
  } else {
    if (room.readTimer) clearTimeout(room.readTimer);
    room.readTimer = setTimeout(() => pedirVotoDaMesa(room), READ_ALOUD_SECONDS * 1000);
  }
}

function pedirVotoDaMesa(room: Room) {
  if (room.readTimer) clearTimeout(room.readTimer);
  room.readTimer = null;
  room.readOutcome = 'confirming';
  room.readVotes = {};

  const votantes = room.players.filter((p) => !p.isHost && p.connected);
  io.to(room.id).emit('round:ask_vote', { votantesEsperados: votantes.length });

  // Robôs votam SIM automaticamente após 800ms
  const botsVotantes = votantes.filter((p) => p.isBot);
  if (botsVotantes.length > 0) {
    setTimeout(() => {
      if (room.phase === 'JUDGMENT_READING' && room.readOutcome === 'confirming') {
        for (const b of botsVotantes) {
          room.readVotes[b.id] = true;
        }
        if (Object.keys(room.readVotes).length >= votantes.length) {
          apurarVotoDaMesa(room);
        }
      }
    }, 800);
  }

  room.readTimer = setTimeout(() => apurarVotoDaMesa(room), 8000);
}

function apurarVotoDaMesa(room: Room) {
  if (room.readTimer) clearTimeout(room.readTimer);
  room.readTimer = null;

  const votos = Object.values(room.readVotes);
  const sim = votos.filter(Boolean).length;
  const nao = votos.length - sim;
  const leuAlto = votos.length === 0 ? true : sim >= nao;

  room.readOutcome = leuAlto ? 'success' : 'failed';

  if (!leuAlto) {
    const host = room.players.find((p) => p.isHost);
    if (host) {
      host.score = round1(host.score - READ_ALOUD_PENALTY);
      host.penalties += 1;
    }
  }

  io.to(room.id).emit('round:read_result', { leuAlto, placar: room.players.map(publicPlayer) });
  broadcastState(room);

  setTimeout(() => {
    const proximo = room.readIndex + 1;
    if (proximo >= room.shuffledSubmissions.length) {
      room.phase = 'JUDGMENT_PICKING';
      broadcastState(room);
      io.to(room.id).emit('round:submission_status', {
        submissions: room.shuffledSubmissions.map((s) => ({ submissionId: s.playerId, texts: s.texts })),
      });

      // Se o anfitrião for robô, escolhe a melhor resposta em 2.5s
      const host = room.players.find((p) => p.isHost);
      if (host?.isBot && room.shuffledSubmissions.length > 0) {
        setTimeout(() => {
          if (room.phase === 'JUDGMENT_PICKING' && room.shuffledSubmissions.length > 0) {
            const randomSub = room.shuffledSubmissions[Math.floor(Math.random() * room.shuffledSubmissions.length)];
            escolherVencedor(room, randomSub.playerId);
          }
        }, 2500);
      }
    } else {
      room.readIndex = proximo;
      room.readOutcome = 'reading';
      broadcastState(room);
      anunciarCartaAtual(room);
    }
  }, leuAlto ? 700 : 1300);
}

function escolherVencedor(room: Room, submissionId: string) {
  const submissao = room.shuffledSubmissions.find((s) => s.playerId === submissionId);
  if (!submissao || !room.currentPrompt) return;

  const vencedor = room.players.find((p) => p.id === submissao.playerId);
  if (!vencedor) return;

  vencedor.score = round1(vencedor.score + ROUND_WIN_POINTS);
  room.winnerId = vencedor.id;
  room.phase = 'REVEAL_ROUND';

  const fraseCompleta = { texto: room.currentPrompt.text, respostas: submissao.texts };

  emitToPlayer(room, vencedor.id, 'round:reveal_result', {
    role: 'winner',
    mensagem: '👑 AE PORR@! VOCÊ VENCEU ESSA!',
    subtexto: `+${ROUND_WIN_POINTS.toFixed(1)} ponto na conta. Você é o novo Anfitrião da mesa.`,
    frase: fraseCompleta,
  });

  const host = room.players.find((p) => p.isHost);
  if (host) {
    emitToPlayer(room, host.id, 'round:reveal_result', {
      role: 'host',
      mensagem: 'ESCOLHA FEITA!',
      subtexto: `Você coroou ${vencedor.name}. O bastão passou pra ele.`,
      frase: fraseCompleta,
      vencedorNome: vencedor.name,
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
    });
  }

  broadcastState(room);

  if (vencedor.score >= WINNING_SCORE) {
    room.phase = 'GAME_OVER';
    const ranking = [...room.players].sort((a, b) => b.score - a.score).map(publicPlayer);
    io.to(room.id).emit('game:champion_declared', { ranking, campeao: vencedor.name });
  } else {
    // Se o host atual for robô, avança automaticamente após 5s
    if (host?.isBot) {
      setTimeout(() => {
        if (room.phase === 'REVEAL_ROUND') {
          proximaRodada(room);
        }
      }, 5000);
    }
  }
}

async function prepararPerguntaDaRodada(room: Room) {
  const p = await drawRandomPergunta(room.usedPromptTexts);
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
  await prepararPerguntaDaRodada(room);
}

const tunnelPromise = startTunnel(5175).catch(() => null);

io.on('connection', (socket) => {
  socket.on('room:create', async ({ hostName }: { hostName: string }, ack) => {
    if (!hostName?.trim()) return ack?.({ erro: 'Nome obrigatório.' });
    const { room, hostPlayerId } = criarSala(hostName);
    const host = room.players.find((p) => p.id === hostPlayerId)!;
    host.socketId = socket.id;
    socket.join(room.id);

    const localIp = getLocalIp();
    const tunnelUrl =
      getActiveTunnelUrl() ||
      (await Promise.race([tunnelPromise, new Promise<null>((r) => setTimeout(() => r(null), 4000))]));

    const validPublicUrl = PUBLIC_APP_URL && !PUBLIC_APP_URL.includes('localhost') ? PUBLIC_APP_URL : null;
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

  socket.on('game:start', async ({ roomId, playerId }: { roomId: string; playerId: string }, ack) => {
    const room = buscarSala(roomId);
    if (!room) return ack?.({ erro: 'Sala não encontrada.' });
    if (!ehHostValido(room, playerId, socket.id)) return ack?.({ erro: 'Só o anfitrião pode iniciar a partida.' });
    if (!podeComecar(room)) return ack?.({ erro: 'Precisa de pelo menos 3 pessoas na sala.' });
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
    const pergunta = await drawRandomPergunta(room.usedPromptTexts);
    room.currentPrompt = { text: pergunta.texto, slots: pergunta.espacos };
    room.usedPromptTexts.push(pergunta.texto);
    ack?.({ ok: true, texto: pergunta.texto });
    broadcastState(room);
  });

  socket.on('coringa:responder', ({ roomId, playerId, aceitar }: { roomId: string; playerId: string; aceitar: boolean }, ack) => {
    const room = buscarSala(roomId);
    if (!room || room.wildcardPendingId !== playerId) return ack?.({ erro: 'Oferta expirada.' });
    if (room.wildcardTimer) clearTimeout(room.wildcardTimer);
    room.wildcardPendingId = null;
    if (aceitar) {
      room.wildcardHolderId = playerId;
      ack?.({ ok: true });
      iniciarRespostas(room);
    } else {
      ack?.({ ok: true });
      iniciarOfertaDeCoringa(room);
    }
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

  socket.on('reading:ask_table', ({ roomId, playerId }: { roomId: string; playerId: string }) => {
    const room = buscarSala(roomId);
    if (!room || room.phase !== 'JUDGMENT_READING' || room.readOutcome !== 'reading') return;
    if (!ehHostValido(room, playerId, socket.id)) return;
    pedirVotoDaMesa(room);
  });

  socket.on('reading:vote', ({ roomId, playerId, leuAlto }: { roomId: string; playerId: string; leuAlto: boolean }) => {
    const room = buscarSala(roomId);
    if (!room || room.readOutcome !== 'confirming') return;
    room.readVotes[playerId] = leuAlto;
    const votantesEsperados = room.players.filter((p) => !p.isHost && p.connected).length;
    if (Object.keys(room.readVotes).length >= votantesEsperados) apurarVotoDaMesa(room);
  });

  socket.on('winner:pick', ({ roomId, playerId, submissionId }: { roomId: string; playerId: string; submissionId: string }, ack) => {
    const room = buscarSala(roomId);
    if (!room || room.phase !== 'JUDGMENT_PICKING') return ack?.({ erro: 'Não é hora de escolher.' });
    if (!ehHostValido(room, playerId, socket.id)) return ack?.({ erro: 'Só o anfitrião pode escolher a vencedora.' });
    escolherVencedor(room, submissionId);
    ack?.({ ok: true });
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
