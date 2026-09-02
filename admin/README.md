# P.Q.P. — Painel Admin

Painel de administração de conteúdo do jogo online: perguntas, mão de
respostas, configurações (coringa, abertura com logo) e efeitos sonoros.

## Passo a passo pra deixar funcionando

1. Crie um projeto grátis em https://supabase.com (não pede cartão).
2. No seu projeto, vá em **SQL Editor > New query**, cole todo o conteúdo
   de `../supabase-schema.sql` (na pasta raiz do jogo) e rode.
3. Vá em **Project Settings > API** e copie a `Project URL` e a chave
   `anon public`.
4. Cole essas duas no arquivo `.env.local` desta pasta, substituindo os
   valores de exemplo.
5. Crie seu login de admin em **Authentication > Users > Add user**
   (e-mail + senha). Não existe cadastro público nessa tela, só login.
6. Rode:
   ```
   npm install
   npm run dev
   ```
7. Acesse o endereço que aparecer no terminal (algo como
   http://localhost:5174) e entre com o e-mail/senha que você criou.

Sem os passos 1-5 feitos, o painel abre mas não consegue salvar nada —
é o único passo manual que só você pode fazer (é a sua própria conta).
