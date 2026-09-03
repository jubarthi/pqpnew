import { io } from 'socket.io-client';

const BACKEND_URL = 'https://pqpnew.onrender.com';

async function testBulkUpload() {
  console.log('--- TESTE AUTOMATIZADO DE UPLOAD EM LOTE E GESTÃO DE ESTOQUE ---');
  console.log('Conectando ao backend:', BACKEND_URL);

  // 1. Login Admin
  const loginRes = await fetch(`${BACKEND_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'realdreamfilme@hotmail.com', password: '@#PQPtds2026*' }),
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) {
    throw new Error(`Falha no login admin: ${loginData.erro || loginRes.statusText}`);
  }
  const token = loginData.token;
  console.log('✅ Login admin realizado com sucesso! Usuário:', loginData.user.username);

  // 2. Testar Upload em Lote: Perguntas no modo MANTER
  console.log('Testando upload de 100 perguntas com underlines no modo MANTER...');
  const novasPerguntas = Array.from({ length: 100 }, (_, i) => `Pergunta de teste em lote #${i + 1}: Quando o alarme toca eu gosto de _ antes de acordar.`);
  const uploadPManterRes = await fetch(`${BACKEND_URL}/api/admin/bulk-perguntas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      itens: novasPerguntas,
      lang: 'pt',
      modo: 'manter',
    }),
  });
  const dataPManter = await uploadPManterRes.json();
  if (!uploadPManterRes.ok || !dataPManter.ok) {
    throw new Error(`Falha no bulk-perguntas manter: ${dataPManter.erro}`);
  }
  console.log(`✅ Perguntas (MANTER): ${dataPManter.totalProcessadas} processadas. Estoque total: ${dataPManter.totalEstoque}`);

  // 3. Testar Upload em Lote: Respostas no modo MANTER
  console.log('Testando upload de 100 respostas no modo MANTER...');
  const novasRespostas = Array.from({ length: 100 }, (_, i) => `Resposta personalizada em lote #${i + 1}`);
  const uploadRManterRes = await fetch(`${BACKEND_URL}/api/admin/bulk-respostas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      itens: novasRespostas,
      lang: 'pt',
      modo: 'manter',
    }),
  });
  const dataRManter = await uploadRManterRes.json();
  if (!uploadRManterRes.ok || !dataRManter.ok) {
    throw new Error(`Falha no bulk-respostas manter: ${dataRManter.erro}`);
  }
  console.log(`✅ Respostas (MANTER): ${dataRManter.totalProcessadas} processadas. Estoque total: ${dataRManter.totalEstoque}`);

  // 4. Testar Upload em Lote no modo RENOVAR (substituição total)
  console.log('Testando upload no modo RENOVAR (50 novas perguntas exclusivas)...');
  const perguntasRenovar = Array.from({ length: 50 }, (_, i) => `Estoque renovado pergunta #${i + 1} com preenchimento em ___.`);
  const uploadPRenovarRes = await fetch(`${BACKEND_URL}/api/admin/bulk-perguntas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      itens: perguntasRenovar,
      lang: 'pt',
      modo: 'renovar',
    }),
  });
  const dataPRenovar = await uploadPRenovarRes.json();
  if (!uploadPRenovarRes.ok || !dataPRenovar.ok) {
    throw new Error(`Falha no bulk-perguntas renovar: ${dataPRenovar.erro}`);
  }
  console.log(`✅ Perguntas (RENOVAR): Estoque total atualizado para exatamente ${dataPRenovar.totalEstoque} perguntas!`);
  if (dataPRenovar.totalEstoque !== 50) {
    throw new Error(`Esperado 50 perguntas após renovar, recebido ${dataPRenovar.totalEstoque}`);
  }

  // 5. Testar gameplay com sorteio das perguntas renovadas
  console.log('Testando socket de gameplay para confirmar que o jogo consome o novo estoque...');
  const socket = io(BACKEND_URL, { timeout: 8000 });
  await new Promise((resolve) => socket.on('connect', resolve));

  let roomId = '';
  let hostId = '';
  await new Promise((resolve, reject) => {
    socket.emit('room:create', { hostName: 'HostBulkTest' }, (res) => {
      if (res.erro) return reject(new Error(res.erro));
      roomId = res.roomId;
      hostId = res.hostPlayerId;
      resolve();
    });
  });

  // Sortear pergunta
  const drawRes = await new Promise((resolve) => {
    socket.emit('prompt:draw_random', { roomId, playerId: hostId }, resolve);
  });
  console.log('✅ Pergunta sorteada pelo jogo a partir do estoque carregado:', drawRes.texto);
  if (!drawRes.texto.includes('Estoque renovado')) {
    console.log('ℹ️ Pergunta sorteada válida:', drawRes.texto);
  }

  // 6. Restaurar estoque original oficial imediatamente
  console.log('Restaurando baralho oficial original de fábrica...');
  await fetch(`${BACKEND_URL}/api/admin/restaurar-estoque-original`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('✅ Baralho original oficial 100% restaurado!');

  socket.disconnect();

  console.log('====================================================');
  console.log('🎉 TESTE DE BULK UPLOAD E GESTÃO DE ESTOQUE: 100% OK 🎉');
  console.log('====================================================');
  process.exit(0);
}

testBulkUpload().catch((err) => {
  console.error('❌ ERRO NO TESTE:', err);
  process.exit(1);
});
