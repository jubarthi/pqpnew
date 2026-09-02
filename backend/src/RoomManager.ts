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

export function criarSala(hostName: string): { room: Room; hostPlayerId: string } {
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
    answerTimer: null,
    readTimer: null,
    wildcardTimer: null,
  };

  rooms.set(id, room);
  return { room, hostPlayerId };
}

export function buscarSala(roomId: string): Room | undefined {
  return rooms.get(roomId.toUpperCase());
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

export function removerSalaVazia(roomId: string) {
  const room = rooms.get(roomId);
  if (room && room.players.every((p) => !p.connected)) {
    rooms.delete(roomId);
  }
}

export function listarSalas(): Room[] {
  return Array.from(rooms.values());
}
