-- ============================================================
-- P.Q.P. — Schema do banco (Supabase / Postgres)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (Project > SQL Editor > New query > cola tudo > Run).
-- ============================================================

create extension if not exists "pgcrypto";

-- Perguntas do anfitrião (a "carta preta")
create table if not exists perguntas (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  categoria text not null default 'geral',
  espacos int not null default 1 check (espacos between 1 and 2),
  status text not null default 'publicado' check (status in ('rascunho','publicado')),
  criado_em timestamptz not null default now()
);

-- Mão de respostas prontas que os participantes escolhem
create table if not exists respostas (
  id uuid primary key default gen_random_uuid(),
  texto text not null,
  status text not null default 'publicado' check (status in ('rascunho','publicado')),
  criado_em timestamptz not null default now()
);

-- Configurações gerais do jogo (linha única, id sempre = 1)
create table if not exists configuracoes (
  id int primary key default 1,
  coringa_ativo boolean not null default true,
  coringa_segundos int not null default 5,
  mao_tamanho int not null default 5,
  logo_intro_url text,
  logo_intro_tipo text check (logo_intro_tipo in ('video','gif','imagem')),
  logo_intro_duracao_seg int not null default 3,
  atualizado_em timestamptz not null default now(),
  constraint singleton check (id = 1)
);
insert into configuracoes (id) values (1) on conflict (id) do nothing;

-- Efeitos sonoros por evento do jogo
create table if not exists sons (
  evento text primary key,
  rotulo text not null,
  arquivo_url text,
  atualizado_em timestamptz not null default now()
);

insert into sons (evento, rotulo) values
  ('abertura_logo', 'Abertura com o logo'),
  ('inicio_jogo', 'Início da partida'),
  ('sala_aberta', 'Anfitrião abre a sala'),
  ('jogador_entrou', 'Jogador entra pelo QR Code'),
  ('contagem_regressiva', 'Início da contagem regressiva'),
  ('tempo_esgotado', 'Tempo esgotado'),
  ('penalidade', 'Penalidade aplicada (não leu a tempo)'),
  ('placar', 'Tela de placar / pontuação'),
  ('rodada_vencida', 'Revelação do vencedor da rodada'),
  ('vitoria_final', 'Tela de campeão / vitória final'),
  ('coringa_apareceu', 'Carta coringa apareceu pra alguém'),
  ('coringa_aceito', 'Coringa foi aceito'),
  ('coringa_recusado', 'Coringa foi recusado / passou pra outra pessoa')
on conflict (evento) do nothing;

-- Row Level Security: leitura pública (o jogo online lê sem precisar logar),
-- escrita só por quem estiver autenticado no painel admin.
alter table perguntas enable row level security;
alter table respostas enable row level security;
alter table configuracoes enable row level security;
alter table sons enable row level security;

drop policy if exists "leitura publica perguntas publicadas" on perguntas;
create policy "leitura publica perguntas publicadas" on perguntas
  for select using (status = 'publicado' or auth.role() = 'authenticated');
drop policy if exists "escrita admin perguntas" on perguntas;
create policy "escrita admin perguntas" on perguntas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "leitura publica respostas publicadas" on respostas;
create policy "leitura publica respostas publicadas" on respostas
  for select using (status = 'publicado' or auth.role() = 'authenticated');
drop policy if exists "escrita admin respostas" on respostas;
create policy "escrita admin respostas" on respostas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "leitura publica configuracoes" on configuracoes;
create policy "leitura publica configuracoes" on configuracoes
  for select using (true);
drop policy if exists "escrita admin configuracoes" on configuracoes;
create policy "escrita admin configuracoes" on configuracoes
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "leitura publica sons" on sons;
create policy "leitura publica sons" on sons
  for select using (true);
drop policy if exists "escrita admin sons" on sons;
create policy "escrita admin sons" on sons
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Buckets de armazenamento (arquivos de som e mídia de abertura)
insert into storage.buckets (id, name, public) values ('sons', 'sons', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('midia', 'midia', true) on conflict (id) do nothing;

drop policy if exists "leitura publica bucket sons" on storage.objects;
create policy "leitura publica bucket sons" on storage.objects
  for select using (bucket_id = 'sons');
drop policy if exists "upload admin bucket sons" on storage.objects;
create policy "upload admin bucket sons" on storage.objects
  for insert with check (bucket_id = 'sons' and auth.role() = 'authenticated');
drop policy if exists "update admin bucket sons" on storage.objects;
create policy "update admin bucket sons" on storage.objects
  for update using (bucket_id = 'sons' and auth.role() = 'authenticated');
drop policy if exists "delete admin bucket sons" on storage.objects;
create policy "delete admin bucket sons" on storage.objects
  for delete using (bucket_id = 'sons' and auth.role() = 'authenticated');

drop policy if exists "leitura publica bucket midia" on storage.objects;
create policy "leitura publica bucket midia" on storage.objects
  for select using (bucket_id = 'midia');
drop policy if exists "upload admin bucket midia" on storage.objects;
create policy "upload admin bucket midia" on storage.objects
  for insert with check (bucket_id = 'midia' and auth.role() = 'authenticated');
drop policy if exists "update admin bucket midia" on storage.objects;
create policy "update admin bucket midia" on storage.objects
  for update using (bucket_id = 'midia' and auth.role() = 'authenticated');
drop policy if exists "delete admin bucket midia" on storage.objects;
create policy "delete admin bucket midia" on storage.objects
  for delete using (bucket_id = 'midia' and auth.role() = 'authenticated');
