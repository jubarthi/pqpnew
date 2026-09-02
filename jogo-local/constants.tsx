
import { QUESTION_CATEGORIES, ALL_QUESTIONS } from './questions-data';

export { QUESTION_CATEGORIES };

// Banco completo (todas as categorias juntas) — mantém a mesma lógica de sorteio
// sem repetir que já existia, só que agora com 500+ frases em vez de 25.
export const QUESTIONS_BANK: string[] = ALL_QUESTIONS;

// Regras de pontuação
export const WINNING_SCORE = 17;      // quem chegar aqui primeiro vence
export const ROUND_WIN_POINTS = 0.8;  // pontos ganhos por vencer uma rodada
export const READ_ALOUD_PENALTY = 0.1; // desconto por não ler a resposta em voz alta a tempo
export const READ_ALOUD_SECONDS = 15;  // tempo pra ler cada resposta em voz alta
