export interface Player {
  id: string;
  socketId: string | null;
  name: string;
  score: number;
  penalties: number;
  isHost: boolean;
  hand: string[];
  connected: boolean;
  isBot?: boolean;
}

export interface Submission {
  playerId: string;
  texts: string[];
  isWildcard: boolean;
}

export type RoomPhase =
  | 'LOBBY'
  | 'PROMPT_SELECTION'
  | 'SUBMIT_ANSWERS'
  | 'WILDCARD_OFFER'
  | 'JUDGMENT_READING'
  | 'JUDGMENT_PICKING'
  | 'REVEAL_ROUND'
  | 'GAME_OVER';

export interface CurrentPrompt {
  text: string;
  slots: number;
}

export interface Room {
  id: string;
  players: Player[];
  hostId: string;
  phase: RoomPhase;
  currentPrompt: CurrentPrompt | null;
  usedPromptTexts: string[];
  submissions: Submission[];
  shuffledSubmissions: Submission[];
  readIndex: number;
  readOutcome: 'reading' | 'confirming' | 'success' | 'failed';
  readVotes: Record<string, boolean>;
  wildcardHolderId: string | null;
  wildcardOfferedTo: string[];
  wildcardPendingId: string | null;
  winnerId: string | null;
  createdAt: number;
  answerTimer: NodeJS.Timeout | null;
  readTimer: NodeJS.Timeout | null;
  wildcardTimer: NodeJS.Timeout | null;
}

export interface Configuracoes {
  coringa_ativo: boolean;
  coringa_segundos: number;
  mao_tamanho: number;
  logo_intro_url: string | null;
  logo_intro_tipo: 'video' | 'gif' | 'imagem' | null;
  logo_intro_duracao_seg: number;
}

export const WINNING_SCORE = 17;
export const ROUND_WIN_POINTS = 0.8;
export const READ_ALOUD_PENALTY = 0.1;
export const READ_ALOUD_SECONDS = 15;
export const ANSWER_SECONDS = 45;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;

export const round1 = (n: number) => Math.round(n * 10) / 10;
