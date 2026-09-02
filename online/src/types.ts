export type RoomPhase =
  | 'LOBBY'
  | 'PROMPT_SELECTION'
  | 'SUBMIT_ANSWERS'
  | 'WILDCARD_OFFER'
  | 'JUDGMENT_READING'
  | 'JUDGMENT_PICKING'
  | 'REVEAL_ROUND'
  | 'GAME_OVER';

export interface PublicPlayer {
  id: string;
  name: string;
  score: number;
  penalties: number;
  isHost: boolean;
  connected: boolean;
  isBot?: boolean;
}

export interface CurrentPrompt {
  text: string;
  slots: number;
}

export interface RoomState {
  roomId: string;
  phase: RoomPhase;
  players: PublicPlayer[];
  hostId: string;
  currentPrompt: CurrentPrompt | null;
  yourHand: string[];
  isWildcardHolder: boolean;
  winningScore: number;
}

export interface Som {
  evento: string;
  arquivo_url: string | null;
}

export interface Configuracoes {
  logo_intro_url: string | null;
  logo_intro_tipo: 'video' | 'gif' | 'imagem' | null;
  logo_intro_duracao_seg: number;
}
