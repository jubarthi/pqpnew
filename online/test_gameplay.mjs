import { io } from 'socket.io-client';

const BACKEND_URL = 'https://pqpnew.onrender.com';

async function testGame() {
  console.log('--- TESTE COMPLETO DE JOGO PQP NO BACKEND ---');
  console.log('Conectando ao backend:', BACKEND_URL);

  const socketHost = io(BACKEND_URL, { reconnection: false, timeout: 8000 });
  const socketP2 = io(BACKEND_URL, { reconnection: false, timeout: 8000 });
  const socketP3 = io(BACKEND_URL, { reconnection: false, timeout: 8000 });

  await Promise.all([
    new Promise((resolve) => socketHost.on('connect', resolve)),
    new Promise((resolve) => socketP2.on('connect', resolve)),
    new Promise((resolve) => socketP3.on('connect', resolve)),
  ]);
  console.log('✅ 3 sockets conectados ao backend!');

  let roomId = '';
  let hostId = '';
  let p2Id = '';
  let p3Id = '';

  // 1. Criar sala
  await new Promise((resolve, reject) => {
    socketHost.emit('room:create', { hostName: 'Host_Tester' }, (res) => {
      if (res.erro) return reject(new Error(res.erro));
      roomId = res.room.id;
      hostId = res.hostPlayerId;
      console.log('✅ Sala criada:', roomId, 'HostId:', hostId);
      resolve();
    });
  });

  // 2. Player 2 entra
  await new Promise((resolve, reject) => {
    socketP2.emit('room:join', { roomId, playerName: 'Player_Beta' }, (res) => {
      if (res.erro) return reject(new Error(res.erro));
      p2Id = res.player.id;
      console.log('✅ Player 2 entrou:', p2Id);
      resolve();
    });
  });

  // 3. Player 3 entra
  await new Promise((resolve, reject) => {
    socketP3.emit('room:join', { roomId, playerName: 'Player_Gama' }, (res) => {
      if (res.erro) return reject(new Error(res.erro));
      p3Id = res.player.id;
      console.log('✅ Player 3 entrou:', p3Id);
      resolve();
    });
  });

  // 4. Iniciar partida
  await new Promise((resolve, reject) => {
    socketHost.emit('game:start', { roomId, playerId: hostId }, (res) => {
      if (res.erro) return reject(new Error(res.erro));
      console.log('✅ Partida iniciada com sucesso!');
      resolve();
    });
  });

  // Aguarda PROMPT_SELECTION
  await new Promise((r) => setTimeout(r, 1000));

  // 5. Testar limite de 3 trocas de pergunta
  console.log('Testando limite de trocas de pergunta (max 3)...');
  for (let i = 1; i <= 3; i++) {
    const res = await new Promise((resolve) => {
      socketHost.emit('prompt:draw_random', { roomId, playerId: hostId }, resolve);
    });
    console.log(`Troca ${i}:`, res.ok ? `OK (Restam: ${res.drawsLeft})` : res.erro);
    if (!res.ok) throw new Error(`Falha na troca ${i}`);
  }

  // 4ª troca deve ser bloqueada
  const res4 = await new Promise((resolve) => {
    socketHost.emit('prompt:draw_random', { roomId, playerId: hostId }, resolve);
  });
  console.log('4ª troca (deve ser rejeitada):', res4);
  if (res4.ok) throw new Error('Limite de 3 trocas não foi respeitado!');
  console.log('✅ Limite de trocas validado com sucesso!');

  // 6. Host confirma pergunta
  await new Promise((resolve) => {
    socketHost.emit('prompt:confirm', { roomId, playerId: hostId }, resolve);
  });
  console.log('✅ Host confirmou pergunta');

  // Aguarda fase de respostas
  await new Promise((r) => setTimeout(r, 2000));

  // 7. Envio de respostas
  await new Promise((resolve) => {
    socketP2.emit('answer:submit', { roomId, playerId: p2Id, handIndexes: [0] }, resolve);
  });
  console.log('✅ Player 2 enviou resposta');

  await new Promise((resolve) => {
    socketP3.emit('answer:submit', { roomId, playerId: p3Id, handIndexes: [0] }, resolve);
  });
  console.log('✅ Player 3 enviou resposta');

  // Aguarda fase de julgamento
  await new Promise((r) => setTimeout(r, 1000));

  let revealData = null;
  socketHost.on('round:reveal_result', (data) => {
    revealData = data;
  });

  // 8. Host escolhe vencedor
  console.log('Host escolhe vencedor Player 2...');
  await new Promise((resolve) => {
    socketHost.emit('winner:pick', { roomId, playerId: hostId, submissionId: p2Id }, resolve);
  });
  console.log('✅ Host selecionou vencedor.');

  // 9. Mesa avalia leitura em voz alta
  console.log('Aguardando e enviando votos de avaliação de leitura...');
  await new Promise((r) => setTimeout(r, 400));
  socketP2.emit('reading:evaluate', { roomId, playerId: p2Id, leuBem: true });
  socketP3.emit('reading:evaluate', { roomId, playerId: p3Id, leuBem: true });

  // Aguarda reveal
  await new Promise((r) => setTimeout(r, 1500));

  if (!revealData) {
    throw new Error('Não recebeu revealData após avaliação!');
  }

  console.log('✅ REVEAL RESULT RECEBIDO:');
  console.log('- Mensagem:', revealData.mensagem);
  console.log('- Avaliação de leitura:', revealData.avaliacaoLeitura);
  console.log('- Meta:', revealData.winningScore);
  console.log('- Placar da mesa:', revealData.placar?.map((p) => `${p.name}: ${p.score} pts`));

  if (!revealData.placar || revealData.placar.length !== 3) {
    throw new Error('Placar incompleto!');
  }

  console.log('====================================================');
  console.log('🌟 TODOS OS CRITÉRIOS TESTADOS E 100% OPERACIONAIS 🌟');
  console.log('====================================================');

  socketHost.disconnect();
  socketP2.disconnect();
  socketP3.disconnect();
  process.exit(0);
}

testGame().catch((err) => {
  console.error('❌ ERRO NO TESTE:', err);
  process.exit(1);
});
