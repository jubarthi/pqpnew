import { randomUUID } from 'crypto';
import type { Room, Player } from './types.js';
import { MIN_PLAYERS, MAX_PLAYERS } from './types.js';

const rooms = new Map<string, Room>();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1 pra não confundir

function gerarCodigoSala(): string {
  let tentativa = '';
  do {
    tentativa = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (rooms.has(tentativa));
  return tentativa;
}

export function criarSala(hostName: string, lang: 'pt' | 'en' = 'pt'): { room: Room; hostPlayerId: string } {
  const id = gerarCodigoSala();
  const hostPlayerId = randomUUID();

  const host: Player = {
    id: hostPlayerId,
    socketId: null,
    name: hostName.trim().slice(0, 24),
    score: 0,
    penalties: 0,
    isHost: true,
    hand: [],
    connected: true,
    isBot: false,
  };

  const room: Room = {
    id,
    players: [host],
    hostId: hostPlayerId,
    phase: 'LOBBY',
    currentPrompt: null,
    usedPromptTexts: [],
    submissions: [],
    shuffledSubmissions: [],
    readIndex: 0,
    readOutcome: 'reading',
    readVotes: {},
    wildcardHolderId: null,
    wildcardOfferedTo: [],
    wildcardPendingId: null,
    winnerId: null,
    createdAt: Date.now(),
    roundNumber: 0,
    lang: lang === 'en' ? 'en' : 'pt',
    isMuted: false,
    answerTimer: null,
    readTimer: null,
    wildcardTimer: null,
  };

  rooms.set(id, room);
  return { room, hostPlayerId };
}

export function buscarSala(roomId: string): Room | undefined {
  if (!roomId || typeof roomId !== 'string') return undefined;
  const cleanId = roomId.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return rooms.get(cleanId);
}

export function entrarNaSala(roomId: string, playerName: string): { room: Room; player: Player } | { erro: string } {
  const room = buscarSala(roomId);
  if (!room) return { erro: 'Sala não encontrada.' };
  if (room.phase !== 'LOBBY') return { erro: 'Essa sala já começou a partida.' };
  if (room.players.length >= MAX_PLAYERS) return { erro: 'Sala lotada (máximo de 10 jogadores).' };

  const nomeLimpo = playerName.trim().slice(0, 24);
  if (room.players.some((p) => p.name.toLowerCase() === nomeLimpo.toLowerCase())) {
    return { erro: 'Esse nome já está em uso nessa sala.' };
  }

  const player: Player = {
    id: randomUUID(),
    socketId: null,
    name: nomeLimpo,
    score: 0,
    penalties: 0,
    isHost: false,
    hand: [],
    connected: true,
  };

  room.players.push(player);
  return { room, player };
}

export function podeComecar(room: Room): boolean {
  return room.players.length >= MIN_PLAYERS;
}

const deletionTimeouts = new Map<string, NodeJS.Timeout>();

export function removerSalaVazia(roomId: string) {
  const room = buscarSala(roomId);
  if (!room) return;

  // Se todos os jogadores desconectaram, aguarda 15 minutos de tolerancia antes de deletar
  if (room.players.every((p) => !p.connected)) {
    if (!deletionTimeouts.has(roomId)) {
      const t = setTimeout(() => {
        const r = buscarSala(roomId);
        if (r && r.players.every((p) => !p.connected)) {
          rooms.delete(roomId);
        }
        deletionTimeouts.delete(roomId);
      }, 1000 * 60 * 15);
      deletionTimeouts.set(roomId, t);
    }
  } else {
    const existing = deletionTimeouts.get(roomId);
    if (existing) {
      clearTimeout(existing);
      deletionTimeouts.delete(roomId);
    }
  }
}

export function listarSalas(): Room[] {
  return Array.from(rooms.values());
}
