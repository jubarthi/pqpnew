export interface Pergunta {
  id: string;
  texto: string;
  categoria: string;
  espacos: number;
  status: 'rascunho' | 'publicado';
  criado_em: string;
}

export interface Resposta {
  id: string;
  texto: string;
  status: 'rascunho' | 'publicado';
  criado_em: string;
}

export interface Configuracoes {
  id: number;
  coringa_ativo: boolean;
  coringa_segundos: number;
  mao_tamanho: number;
  logo_intro_url: string | null;
  logo_intro_tipo: 'video' | 'gif' | 'imagem' | null;
  logo_intro_duracao_seg: number;
}

export interface Som {
  evento: string;
  rotulo: string;
  arquivo_url: string | null;
}
