export type RoomPhase =
  | 'LOBBY'
  | 'PROMPT_SELECTION'
  | 'SUBMIT_ANSWERS'
  | 'WILDCARD_OFFER'
  | 'JUDGMENT_READING'
  | 'JUDGMENT_PICKING'
  | 'READING_EVALUATION'
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

export interface PickingSubmission {
  submissionId: string;
  texts: string[];
}

export interface RoomState {
  roomId: string;
  phase: RoomPhase;
  players: PublicPlayer[];
  hostId: string;
  currentPrompt: CurrentPrompt | null;
  promptDrawsLeft?: number;
  maxPromptDraws?: number;
  yourHand: string[];
  isWildcardHolder: boolean;
  winningScore: number;
  pickingSubmissions?: PickingSubmission[];
  evaluationInfo?: {
    hostName: string;
    seconds: number;
  };
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
