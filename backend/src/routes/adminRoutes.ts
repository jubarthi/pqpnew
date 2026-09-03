import { Router, Request, Response, NextFunction } from 'express';
import {
  loadStore,
  saveStore,
  authenticateAdmin,
  verifyAdminToken,
  PerguntaItem,
  RespostaItem,
} from '../adminStore.js';

export const adminRouter = Router();

// Middleware de autenticação
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ erro: 'Não autorizado. Token ausente.' });
    return;
  }
  const token = authHeader.split(' ')[1];
  const { ok, user } = verifyAdminToken(token);
  if (!ok || !user) {
    res.status(401).json({ erro: 'Sessão expirada ou inválida.' });
    return;
  }
  (req as any).user = user;
  next();
}

// 1. Login
adminRouter.post('/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ erro: 'Informe usuário/e-mail e senha.' });
  }
  const result = authenticateAdmin(identifier, password);
  if (!result.ok) {
    return res.status(401).json({ erro: result.erro });
  }
  return res.json({ token: result.token, user: result.user });
});

// 2. Verificar Sessão
adminRouter.get('/me', authMiddleware, (req: Request, res: Response) => {
  return res.json({ ok: true, user: (req as any).user });
});

// 3. Estatísticas rápidas
adminRouter.get('/stats', authMiddleware, (_req: Request, res: Response) => {
  const store = loadStore();
  const totalPerguntasPt = store.perguntas.filter((p) => p.lang === 'pt').length;
  const totalPerguntasEn = store.perguntas.filter((p) => p.lang === 'en').length;
  const totalRespostasPt = store.respostas.filter((r) => r.lang === 'pt').length;
  const totalRespostasEn = store.respostas.filter((r) => r.lang === 'en').length;

  res.json({
    totalPerguntasPt,
    totalPerguntasEn,
    totalRespostasPt,
    totalRespostasEn,
    soundsActive: Object.values(store.sounds).filter((s) => s.active).length,
  });
});

// 4. Perguntas (CRUD)
adminRouter.get('/perguntas', authMiddleware, (req: Request, res: Response) => {
  const store = loadStore();
  const lang = (req.query.lang as string) || 'pt';
  const search = ((req.query.q as string) || '').toLowerCase().trim();

  let lista = store.perguntas.filter((p) => p.lang === lang);
  if (search) {
    lista = lista.filter((p) => p.texto.toLowerCase().includes(search));
  }
  res.json(lista);
});

adminRouter.post('/perguntas', authMiddleware, (req: Request, res: Response) => {
  const { texto, lang = 'pt' } = req.body || {};
  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return res.status(400).json({ erro: 'O texto da pergunta é obrigatório.' });
  }

  const store = loadStore();
  const espacos = (texto.match(/_{3,}/g) || []).length || 1;
  const novaPergunta: PerguntaItem = {
    id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    texto: texto.trim(),
    espacos,
    lang: lang === 'en' ? 'en' : 'pt',
    createdAt: Date.now(),
  };

  store.perguntas.unshift(novaPergunta);
  saveStore();
  res.status(201).json(novaPergunta);
});

adminRouter.put('/perguntas/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const { texto, lang } = req.body || {};
  const store = loadStore();

  const item = store.perguntas.find((p) => p.id === id);
  if (!item) {
    return res.status(404).json({ erro: 'Pergunta não encontrada.' });
  }

  if (texto && typeof texto === 'string') {
    item.texto = texto.trim();
    item.espacos = (item.texto.match(/_{3,}/g) || []).length || 1;
  }
  if (lang === 'pt' || lang === 'en') {
    item.lang = lang;
  }

  saveStore();
  res.json(item);
});

adminRouter.delete('/perguntas/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const store = loadStore();

  const idx = store.perguntas.findIndex((p) => p.id === id);
  if (idx === -1) {
    return res.status(404).json({ erro: 'Pergunta não encontrada.' });
  }

  store.perguntas.splice(idx, 1);
  saveStore();
  res.json({ ok: true, id });
});

// 5. Respostas (CRUD)
adminRouter.get('/respostas', authMiddleware, (req: Request, res: Response) => {
  const store = loadStore();
  const lang = (req.query.lang as string) || 'pt';
  const search = ((req.query.q as string) || '').toLowerCase().trim();

  let lista = store.respostas.filter((r) => r.lang === lang);
  if (search) {
    lista = lista.filter((r) => r.texto.toLowerCase().includes(search));
  }
  res.json(lista);
});

adminRouter.post('/respostas', authMiddleware, (req: Request, res: Response) => {
  const { texto, lang = 'pt' } = req.body || {};
  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return res.status(400).json({ erro: 'O texto da resposta é obrigatório.' });
  }

  const store = loadStore();
  const novaResposta: RespostaItem = {
    id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    texto: texto.trim(),
    lang: lang === 'en' ? 'en' : 'pt',
    createdAt: Date.now(),
  };

  store.respostas.unshift(novaResposta);
  saveStore();
  res.status(201).json(novaResposta);
});

adminRouter.put('/respostas/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const { texto, lang } = req.body || {};
  const store = loadStore();

  const item = store.respostas.find((r) => r.id === id);
  if (!item) {
    return res.status(404).json({ erro: 'Resposta não encontrada.' });
  }

  if (texto && typeof texto === 'string') {
    item.texto = texto.trim();
  }
  if (lang === 'pt' || lang === 'en') {
    item.lang = lang;
  }

  saveStore();
  res.json(item);
});

adminRouter.delete('/respostas/:id', authMiddleware, (req: Request, res: Response) => {
  const { id } = req.params;
  const store = loadStore();

  const idx = store.respostas.findIndex((r) => r.id === id);
  if (idx === -1) {
    return res.status(404).json({ erro: 'Resposta não encontrada.' });
  }

  store.respostas.splice(idx, 1);
  saveStore();
  res.json({ ok: true, id });
});

// 6. Áudios
adminRouter.get('/audios', authMiddleware, (_req: Request, res: Response) => {
  const store = loadStore();
  res.json(store.sounds);
});

adminRouter.post('/audios/toggle', authMiddleware, (req: Request, res: Response) => {
  const { key, active } = req.body || {};
  const store = loadStore();
  if (store.sounds[key as keyof typeof store.sounds]) {
    store.sounds[key as keyof typeof store.sounds].active = Boolean(active);
    saveStore();
    return res.json(store.sounds);
  }
  return res.status(400).json({ erro: 'Som inválido.' });
});

// 7. Configurações
adminRouter.get('/configs', authMiddleware, (_req: Request, res: Response) => {
  const store = loadStore();
  res.json(store.configs);
});

adminRouter.post('/configs', authMiddleware, (req: Request, res: Response) => {
  const { winningScore, answerSeconds, readAloudSeconds, coringaActive } = req.body || {};
  const store = loadStore();
  if (typeof winningScore === 'number') store.configs.winningScore = winningScore;
  if (typeof answerSeconds === 'number') store.configs.answerSeconds = answerSeconds;
  if (typeof readAloudSeconds === 'number') store.configs.readAloudSeconds = readAloudSeconds;
  if (typeof coringaActive === 'boolean') store.configs.coringaActive = coringaActive;
  saveStore();
  res.json(store.configs);
});

// 8. Upload em Lote: Perguntas (Manter ou Renovar)
adminRouter.post('/bulk-perguntas', authMiddleware, (req: Request, res: Response) => {
  const { itens, lang = 'pt', modo = 'manter' } = req.body || {};
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Nenhuma pergunta enviada na lista.' });
  }

  const store = loadStore();
  const targetLang = lang === 'en' ? 'en' : 'pt';

  const jaExistentes = new Set(
    store.perguntas.filter((p) => p.lang === targetLang).map((p) => p.texto.toLowerCase().trim())
  );
  const formatadas: PerguntaItem[] = [];

  for (const raw of itens) {
    if (typeof raw !== 'string') continue;
    let texto = raw.trim();
    if (!texto) continue;

    // Converte underlines simples ou múltiplos para ___
    texto = texto.replace(/_+/g, '___');
    const espacos = (texto.match(/_{3,}/g) || []).length || 1;

    if (modo === 'manter' && jaExistentes.has(texto.toLowerCase())) {
      continue;
    }

    formatadas.push({
      id: `p_${targetLang}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      texto,
      espacos,
      lang: targetLang,
      createdAt: Date.now(),
    });
    jaExistentes.add(texto.toLowerCase());
  }

  if (formatadas.length === 0) {
    return res.status(400).json({ erro: 'Nenhuma pergunta válida (ou todas já existiam no estoque).' });
  }

  if (modo === 'renovar') {
    // Apaga perguntas atuais daquele idioma e coloca as novas
    store.perguntas = store.perguntas.filter((p) => p.lang !== targetLang);
    store.perguntas.push(...formatadas);
  } else {
    // Manter: adiciona as novas
    store.perguntas.unshift(...formatadas);
  }

  saveStore();
  res.json({
    ok: true,
    totalProcessadas: formatadas.length,
    modo,
    totalEstoque: store.perguntas.filter((p) => p.lang === targetLang).length,
  });
});

// 9. Upload em Lote: Respostas (Manter ou Renovar)
adminRouter.post('/bulk-respostas', authMiddleware, (req: Request, res: Response) => {
  const { itens, lang = 'pt', modo = 'manter' } = req.body || {};
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ erro: 'Nenhuma resposta enviada na lista.' });
  }

  const store = loadStore();
  const targetLang = lang === 'en' ? 'en' : 'pt';

  const jaExistentes = new Set(
    store.respostas.filter((r) => r.lang === targetLang).map((r) => r.texto.toLowerCase().trim())
  );
  const formatadas: RespostaItem[] = [];

  for (const raw of itens) {
    if (typeof raw !== 'string') continue;
    const texto = raw.trim();
    if (!texto) continue;

    if (modo === 'manter' && jaExistentes.has(texto.toLowerCase())) {
      continue;
    }

    formatadas.push({
      id: `r_${targetLang}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      texto,
      lang: targetLang,
      createdAt: Date.now(),
    });
    jaExistentes.add(texto.toLowerCase());
  }

  if (formatadas.length === 0) {
    return res.status(400).json({ erro: 'Nenhuma resposta válida (ou todas já existiam no estoque).' });
  }

  if (modo === 'renovar') {
    // Apaga respostas atuais daquele idioma e coloca as novas
    store.respostas = store.respostas.filter((r) => r.lang !== targetLang);
    store.respostas.push(...formatadas);
  } else {
    // Manter: adiciona as novas
    store.respostas.unshift(...formatadas);
  }

  saveStore();
  res.json({
    ok: true,
    totalProcessadas: formatadas.length,
    modo,
    totalEstoque: store.respostas.filter((r) => r.lang === targetLang).length,
  });
});
