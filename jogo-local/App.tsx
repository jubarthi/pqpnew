
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GameState, Player, Question, Answer } from './types';
import { QUESTIONS_BANK, WINNING_SCORE, ROUND_WIN_POINTS, READ_ALOUD_PENALTY, READ_ALOUD_SECONDS } from './constants';
import { Button } from './components/Button';

const round1 = (n: number) => Math.round(n * 10) / 10;

const App: React.FC = () => {
  // Game State
  const [gameState, setGameState] = useState<GameState>(GameState.HOME);
  const [players, setPlayers] = useState<Player[]>([]);
  const [hostIndex, setHostIndex] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentAnswers, setCurrentAnswers] = useState<Answer[]>([]);
  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);

  const [shuffledAnswers, setShuffledAnswers] = useState<Answer[]>([]);

  const [tempName, setTempName] = useState('');
  const [manualQuestion, setManualQuestion] = useState('');
  const [currentPlayerIndexInRound, setCurrentPlayerIndexInRound] = useState(0);
  const [activeResponses, setActiveResponses] = useState<string[]>(['', '']);
  const [winnerRevealedId, setWinnerRevealedId] = useState<number | null>(null);

  // --- Leitura em voz alta (julgamento) ---
  // 'reading'    -> cronômetro rodando, anfitrião lendo a resposta em voz alta
  // 'confirming' -> pergunta pra mesa: "E AÍ, FALOU ALTO?" (SIM/NÃO)
  // 'success'    -> mesa confirmou que leu (feedback verde, avança)
  // 'failed'     -> mesa disse que não leu (feedback vermelho, aplica -0.1, avança)
  const [judgePhase, setJudgePhase] = useState<'reading' | 'picking'>('reading');
  const [readIndex, setReadIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(READ_ALOUD_SECONDS);
  const [readOutcome, setReadOutcome] = useState<'reading' | 'confirming' | 'success' | 'failed'>('reading');

  const advancingRef = useRef(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Derived state
  const currentHost = players[hostIndex];
  const participants = useMemo(() => players.filter((_, idx) => idx !== hostIndex), [players, hostIndex]);
  const isLastPlayerInRound = currentPlayerIndexInRound === participants.length - 1;

  const manualSlotsCount = useMemo(() => {
    return (manualQuestion.match(/_{3,}/g) || []).length;
  }, [manualQuestion]);

  // Ao entrar em julgamento: embaralha respostas e reinicia a leitura em voz alta
  useEffect(() => {
    if (gameState === GameState.JUDGMENT) {
      const shuffled = [...currentAnswers].sort(() => Math.random() - 0.5);
      setShuffledAnswers(shuffled);
      setJudgePhase('reading');
      setReadIndex(0);
      setSecondsLeft(READ_ALOUD_SECONDS);
      setReadOutcome('reading');
    }
  }, [gameState, currentAnswers]);

  // Desconta -0.1 do anfitrião atual (é ele quem está lendo em voz alta)
  const applyReadPenalty = useCallback(() => {
    setPlayers(prev => prev.map((p, idx) =>
      idx === hostIndex ? { ...p, score: round1(p.score - READ_ALOUD_PENALTY), penalties: p.penalties + 1 } : p
    ));
  }, [hostIndex]);

  // Chama a pergunta pra mesa: "E AÍ, FALOU ALTO?"
  const askTable = useCallback(() => {
    setReadOutcome(prev => (prev === 'reading' ? 'confirming' : prev));
  }, []);

  // A mesa responde SIM (leu) ou NÃO (não leu) — decisão coletiva, sem depender de microfone
  const answerTable = useCallback((readAloud: boolean) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    if (!readAloud) {
      applyReadPenalty();
    }
    setReadOutcome(readAloud ? 'success' : 'failed');
    setTimeout(() => {
      const next = readIndex + 1;
      if (next >= shuffledAnswers.length) {
        setJudgePhase('picking');
      } else {
        setReadIndex(next);
        setSecondsLeft(READ_ALOUD_SECONDS);
        setReadOutcome('reading');
      }
      advancingRef.current = false;
    }, readAloud ? 700 : 1300);
  }, [applyReadPenalty, readIndex, shuffledAnswers.length]);

  // Cronômetro da fase de leitura: ao zerar, chama a pergunta pra mesa automaticamente
  useEffect(() => {
    if (gameState !== GameState.JUDGMENT || judgePhase !== 'reading') return;
    if (readOutcome !== 'reading') return;

    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          askTable();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, judgePhase, readIndex, readOutcome, askTable]);

  // Actions
  const startNewGame = () => {
    setPlayers([]);
    setHostIndex(0);
    setGameState(GameState.SETUP_HOST);
  };

  const setHost = () => {
    if (!tempName.trim()) return;
    setPlayers([{ name: tempName.trim(), score: 0, penalties: 0 }]);
    setTempName('');
    setGameState(GameState.ADD_PLAYERS);
  };

  const addPlayer = () => {
    const trimmed = tempName.trim();
    if (!trimmed) return;
    if (players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
        alert("Este nome já está em uso!");
        return;
    }
    setPlayers(prev => [...prev, { name: trimmed, score: 0, penalties: 0 }]);
    setTempName('');
  };

  const startGameMatch = () => {
    if (players.length < 3) {
      alert("Adicione pelo menos mais 2 jogadores (mínimo 3 pessoas no total).");
      return;
    }
    setGameState(GameState.CREATE_QUESTION);
  };

  const handleRandomQuestion = () => {
    let available = QUESTIONS_BANK.filter(q => !usedQuestions.includes(q));
    if (available.length === 0) {
      setUsedQuestions([]);
      available = [...QUESTIONS_BANK];
    }
    const picked = available[Math.floor(Math.random() * available.length)];
    setUsedQuestions(prev => [...prev, picked]);
    setCurrentQuestion({ text: picked, slots: 1 });
    setCurrentAnswers([]);
    setCurrentPlayerIndexInRound(0);
    setGameState(GameState.ANSWER_ROUND);
  };

  const handleManualQuestion = () => {
    if (!manualQuestion.trim() || manualSlotsCount === 0) {
      alert("Escreva uma pergunta e adicione pelo menos um espaço (______).");
      return;
    }
    if (manualSlotsCount > 2) {
      alert("O máximo de espaços permitidos é 2.");
      return;
    }
    setCurrentQuestion({ 
      text: manualQuestion.trim(), 
      slots: manualSlotsCount 
    });
    setCurrentAnswers([]);
    setCurrentPlayerIndexInRound(0);
    setGameState(GameState.ANSWER_ROUND);
  };

  const addPlaceholder = () => {
    if (manualSlotsCount >= 2) return;
    const textArea = textAreaRef.current;
    const placeholder = "______";
    if (textArea) {
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const text = manualQuestion;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + placeholder + after;
      setManualQuestion(newText);
      setTimeout(() => {
        textArea.focus();
        const newCursorPos = start + placeholder.length;
        textArea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      setManualQuestion(prev => prev + placeholder);
    }
  };

  const submitAnswer = () => {
    const currentParticipant = participants[currentPlayerIndexInRound];
    const playerIndexInFullList = players.findIndex(p => p.name === currentParticipant.name);
    const cleanAnswers = activeResponses.slice(0, currentQuestion?.slots).map(a => a.trim());
    
    if (cleanAnswers.some(a => !a)) {
        alert("Preencha todos os espaços!");
        return;
    }

    const newAnswer: Answer = {
      playerId: playerIndexInFullList,
      texts: cleanAnswers
    };

    setCurrentAnswers(prev => [...prev, newAnswer]);
    setActiveResponses(['', '']);

    if (isLastPlayerInRound) {
      setGameState(GameState.WAIT_HOST);
    } else {
      setCurrentPlayerIndexInRound(prev => prev + 1);
    }
  };

  const pickWinner = (playerId: number) => {
    setWinnerRevealedId(playerId);
    setGameState(GameState.REVEAL);
  };

  const nextRound = () => {
    if (winnerRevealedId === null) return;

    const updatedPlayers = [...players];
    updatedPlayers[winnerRevealedId] = {
      ...updatedPlayers[winnerRevealedId],
      score: round1(updatedPlayers[winnerRevealedId].score + ROUND_WIN_POINTS)
    };

    if (updatedPlayers[winnerRevealedId].score >= WINNING_SCORE) {
      setPlayers(updatedPlayers);
      setGameState(GameState.VICTORY);
    } else {
      setPlayers(updatedPlayers);
      setHostIndex(winnerRevealedId); // The winner becomes the next host
      setWinnerRevealedId(null);
      setManualQuestion('');
      setCurrentPlayerIndexInRound(0);
      setGameState(GameState.CREATE_QUESTION);
    }
  };

  const restartGame = (keepPlayers: boolean) => {
    if (keepPlayers) {
      const resetPlayers = players.map(p => ({ ...p, score: 0, penalties: 0 }));
      setPlayers(resetPlayers);
      setHostIndex(0);
      setManualQuestion('');
      setGameState(GameState.CREATE_QUESTION);
    } else {
      startNewGame();
    }
  };

  // Renderers
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center space-y-12">
      <div className="space-y-4">
        <h1 className="text-8xl font-black tracking-tighter text-white text-comic">P.Q.P.</h1>
        <p className="text-xl font-black uppercase tracking-widest text-amber-300 text-comic">Pra Quem Pode</p>
      </div>
      <div className="w-full max-w-sm">
        <Button onClick={startNewGame}>NOVO JOGO</Button>
      </div>
      <p className="text-xs uppercase font-bold text-white/70">Jogo incrível com alto risco de dependência</p>
    </div>
  );

  const renderSetupHost = () => (
    <div className="flex flex-col h-full px-6 py-12 space-y-8">
      <h2 className="text-4xl font-black tracking-tight uppercase text-white text-comic">Defina o Anfitrião</h2>
      <div className="flex flex-col space-y-4">
        <label className="text-sm font-bold uppercase text-white/80">Nome do Anfitrião</label>
        <input 
          type="text" 
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          placeholder="Ex: Carlos"
          className="bg-white border-4 border-black p-4 rounded-2xl text-2xl font-black text-black placeholder-zinc-400 focus:border-blue-600 outline-none transition-all"
        />
        <Button onClick={setHost}>DEFINIR</Button>
      </div>
    </div>
  );

  const renderAddPlayers = () => (
    <div className="flex flex-col h-full px-6 py-12 space-y-8">
      <div className="space-y-2">
        <h2 className="text-4xl font-black tracking-tight uppercase text-white text-comic">Jogadores</h2>
        <p className="text-sm text-amber-300 font-bold uppercase">Anfitrião: {players[0]?.name}</p>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {players.slice(1).map((p, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl flex justify-between items-center border-4 border-black shadow-md">
            <span className="font-black text-xl text-black">{p.name}</span>
            <span className="text-zinc-500 font-bold">#{i + 1}</span>
          </div>
        ))}
        {players.length === 1 && (
            <div className="h-20 flex items-center justify-center border-4 border-dashed border-white/40 rounded-2xl text-white/60 font-bold">
                NENHUM JOGADOR ADICIONADO
            </div>
        )}
      </div>

      <div className="space-y-4">
        <input 
          type="text" 
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          placeholder="Nome do próximo jogador"
          className="bg-white border-4 border-black w-full p-4 rounded-2xl text-xl font-black text-black placeholder-zinc-400 focus:border-blue-600 outline-none"
        />
        <div className="grid grid-cols-1 gap-4">
          <Button variant="secondary" onClick={addPlayer}>PRÓXIMO JOGADOR</Button>
          <Button onClick={startGameMatch} disabled={players.length < 3}>COMEÇAR PARTIDA</Button>
        </div>
      </div>
    </div>
  );

  const renderCreateQuestion = () => (
    <div className="flex flex-col h-full px-6 py-12 space-y-8">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h2 className="text-3xl font-black uppercase tracking-tight text-white text-comic">Vez de {currentHost.name}</h2>
          <p className="text-sm font-bold text-amber-300 uppercase tracking-widest">Anfitrião da rodada</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-white/70 uppercase">Pontos (meta: {WINNING_SCORE})</p>
          <div className="flex flex-wrap gap-1 justify-end">
            {players.map((p, idx) => (
                <div key={idx} className="bg-white px-2 py-1 rounded-lg text-[10px] font-black border-2 border-black text-black">
                    {p.name}: {p.score.toFixed(1)}
                </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col space-y-6 flex-1 overflow-y-auto">
        <div className="space-y-4">
          <label className="text-xs font-bold text-white/70 uppercase">Crie sua pergunta</label>
          <div className="space-y-2">
            <textarea 
              ref={textAreaRef}
              value={manualQuestion}
              onChange={(e) => setManualQuestion(e.target.value)}
              placeholder="Ex: Eu nao quero _____ porque _______"
              className="w-full bg-white border-4 border-black p-4 rounded-2xl text-xl font-bold h-32 outline-none text-black placeholder-zinc-400 focus:border-blue-600"
            />
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border-2 border-black">
              <span className="font-bold text-zinc-600">Espaços: {manualSlotsCount}</span>
              <Button 
                variant="secondary" 
                className="w-auto py-2 px-4 text-sm" 
                onClick={addPlaceholder}
                disabled={manualSlotsCount >= 2}
              >
                + RESPOSTA (______)
              </Button>
            </div>
            <Button variant="primary" onClick={handleManualQuestion} disabled={!manualQuestion.trim() || manualSlotsCount === 0 || manualSlotsCount > 2}>
                PRONTO
            </Button>
          </div>
        </div>

        <div className="relative py-2 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-white/30"></div></div>
          <span className="relative bg-white border-2 border-black rounded-full px-4 py-1 text-xs uppercase text-black font-black">OU</span>
        </div>

        <div className="space-y-4">
          <label className="text-xs font-bold text-white/70 uppercase">Sugestão Aleatória (500+ frases)</label>
          <Button variant="secondary" onClick={handleRandomQuestion}>SORTEAR PERGUNTA</Button>
        </div>
      </div>
    </div>
  );

  const renderAnswerRound = () => {
    const currentParticipant = participants[currentPlayerIndexInRound];
    if (!currentQuestion) return null;

    return (
      <div className="flex flex-col h-full px-6 py-12 space-y-8">
        <div className="space-y-2 text-center">
            <p className="text-sm font-bold text-white/70 uppercase tracking-widest">Passe o celular para</p>
            <h2 className="text-5xl font-black uppercase text-amber-300 text-comic tracking-tight">{currentParticipant.name}</h2>
        </div>

        <div className="bg-white p-8 rounded-3xl border-4 border-black shadow-xl -rotate-1">
            <p className="text-2xl font-bold leading-relaxed text-black">{currentQuestion.text}</p>
        </div>

        <div className="space-y-6 flex-1">
          {Array.from({ length: currentQuestion.slots }).map((_, idx) => (
            <div key={idx} className="space-y-2">
                <label className="text-xs font-bold text-white/70 uppercase">Complete o espaço {idx + 1}</label>
                <input 
                    type="text"
                    value={activeResponses[idx]}
                    onChange={(e) => {
                        const newRes = [...activeResponses];
                        newRes[idx] = e.target.value;
                        setActiveResponses(newRes);
                    }}
                    placeholder="..."
                    className="w-full bg-white border-4 border-black p-6 rounded-2xl text-2xl font-black outline-none text-black placeholder-zinc-400 focus:border-blue-600"
                />
            </div>
          ))}
        </div>

        <Button onClick={submitAnswer}>CONFIRMAR</Button>
      </div>
    );
  };

  const renderWaitHost = () => (
    <div className="flex flex-col items-center justify-center h-full px-6 space-y-12 text-center">
      <div className="space-y-4">
          <p className="text-sm font-bold text-white/70 uppercase tracking-widest">Respostas enviadas!</p>
          <p className="text-sm font-bold text-white/70 uppercase tracking-widest">Passe o celular de volta para</p>
          <h2 className="text-7xl font-black uppercase tracking-tighter text-amber-300 text-comic">{currentHost.name}</h2>
      </div>
      <div className="w-full max-w-sm">
          <Button onClick={() => setGameState(GameState.JUDGMENT)}>ABRIR RESPOSTAS</Button>
      </div>
    </div>
  );

  const buildFullSentence = (ans: Answer) => {
    if (!currentQuestion) return '';
    let fullSentence = currentQuestion.text;
    ans.texts.forEach(t => {
      fullSentence = fullSentence.replace(
        /_{3,}/,
        `<strong class="inline-block text-black bg-amber-300 border-2 border-black px-2.5 py-0.5 rounded-xl uppercase font-black shadow-[0_2px_0_#000] mx-1">${t}</strong>`
      );
    });
    return fullSentence;
  };

  const renderJudgeReading = () => {
    if (!currentQuestion) return null;
    const currentAns = shuffledAnswers[readIndex];
    if (!currentAns) return null;

    const isConfirming = readOutcome === 'confirming';
    const isSuccess = readOutcome === 'success';
    const isFail = readOutcome === 'failed';
    const upcoming = shuffledAnswers.slice(readIndex + 1);

    return (
      <div className="flex flex-col h-full text-white px-6 py-10 space-y-6">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-2xl font-black uppercase text-comic">Anfitrião: {currentHost.name}</h2>
            <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Resposta {readIndex + 1} de {shuffledAnswers.length}</p>
          </div>
          {!isConfirming && !isSuccess && !isFail && (
            <div className={`px-4 py-1.5 rounded-2xl border-3 border-black font-black text-2xl flex items-center gap-1.5 shadow-[0_4px_0_#000] ${secondsLeft <= 5 ? 'bg-red-500 text-white animate-urgent' : 'bg-amber-300 text-black'}`}>
              <span>⏱️</span>
              <span>{secondsLeft}s</span>
            </div>
          )}
        </div>

        {!isConfirming && !isSuccess && !isFail && (
          <p className="text-center text-sm font-black uppercase tracking-[0.3em] text-amber-300 flex-shrink-0">
            Leia em voz alta
          </p>
        )}

        <div className="relative flex-shrink-0">
          <div className="bg-white border-4 border-black rounded-3xl p-8 shadow-xl min-h-[160px] flex items-center rotate-1">
            <div className="text-2xl leading-relaxed text-black" dangerouslySetInnerHTML={{ __html: buildFullSentence(currentAns) }} />
          </div>

          {isSuccess && (
            <div className="absolute inset-0 bg-[#22C55E]/95 border-4 border-black rounded-3xl flex items-center justify-center">
              <span className="text-4xl font-black text-black uppercase text-comic">✔ Leu!</span>
            </div>
          )}
          {isFail && (
            <div className="absolute inset-0 bg-red-600/95 border-4 border-black rounded-3xl flex flex-col items-center justify-center gap-1">
              <span className="text-5xl font-black text-white text-comic">1X</span>
              <span className="text-lg font-black text-white uppercase">Se ferrou, próxima!</span>
              <span className="text-xs font-bold text-white/80 uppercase">-{READ_ALOUD_PENALTY.toFixed(1)} ponto pro anfitrião</span>
            </div>
          )}
        </div>

        {isConfirming ? (
          <div className="flex-1 flex flex-col justify-center items-center space-y-8">
            <div className="speech-bubble rounded-2xl px-6 py-4 max-w-sm">
              <p className="text-2xl font-black uppercase text-center text-black">E aí, falou alto? 🗣️</p>
            </div>
            <p className="text-xs font-bold text-white/70 uppercase text-center px-6">A mesa decide junto — vale a palavra de todo mundo</p>
            <div className="w-full max-w-sm grid grid-cols-2 gap-4">
              <Button variant="danger" onClick={() => answerTable(false)}>NÃO</Button>
              <Button onClick={() => answerTable(true)}>SIM</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3">
              {upcoming.map((_, i) => (
                <div key={i} className="bg-black/25 border-2 border-white/30 rounded-2xl h-16 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-white/60 font-black uppercase text-sm">Aguardando...</span>
                </div>
              ))}
            </div>
            {!isSuccess && !isFail && (
              <Button variant="secondary" onClick={askTable} className="flex-shrink-0">
                JÁ LI, PERGUNTAR PRA MESA
              </Button>
            )}
          </>
        )}
      </div>
    );
  };

  const renderJudgePicking = () => {
    if (!currentQuestion) return null;

    return (
      <div className="flex flex-col h-full text-white px-6 py-12 space-y-8">
        <div className="space-y-2 flex-shrink-0">
            <h2 className="text-4xl font-black uppercase leading-tight tracking-tight text-comic">Anfitrião: {currentHost.name}</h2>
            <p className="font-bold text-amber-300 uppercase tracking-tighter">Escolha a melhor frase</p>
        </div>

        <div className="space-y-6 overflow-y-auto pb-12 flex-1 pr-1">
            {shuffledAnswers.map((ans, i) => (
                <div key={i} className={`flex flex-col gap-6 p-8 bg-white border-4 border-black rounded-3xl shadow-xl transform transition-transform hover:scale-[1.01] ${i % 2 === 0 ? '-rotate-1' : 'rotate-1'}`}>
                    <div 
                        className="text-2xl leading-relaxed text-black" 
                        dangerouslySetInnerHTML={{ __html: buildFullSentence(ans) }} 
                    />
                    <Button onClick={() => pickWinner(ans.playerId)}>VOTAR NESTA</Button>
                </div>
            ))}
        </div>
      </div>
    );
  };

  const renderReveal = () => {
    if (winnerRevealedId === null) return null;
    const winner = players[winnerRevealedId];

    return (
      <div className="flex flex-col items-center justify-center h-full px-6 space-y-12 text-center">
        <div className="space-y-4">
            <p className="text-sm font-bold text-amber-300 uppercase tracking-[0.5em]">O autor da frase foi...</p>
            <h2 className="text-7xl font-black uppercase tracking-tighter text-white text-comic">{winner.name}</h2>
        </div>
        <div className="bg-white p-8 rounded-full border-4 border-black w-48 h-48 flex items-center justify-center shadow-xl">
            <span className="text-4xl font-black text-amber-500">+{ROUND_WIN_POINTS.toFixed(1)}</span>
        </div>
        <div className="w-full max-w-sm">
            <Button onClick={nextRound}>PRÓXIMA RODADA</Button>
        </div>
        <p className="text-white/70 font-bold uppercase tracking-widest">{winner.name} será o próximo Anfitrião!</p>
      </div>
    );
  };

  const renderVictory = () => {
    const winner = players.find(p => p.score >= WINNING_SCORE);
    if (!winner) return null;
    const ranking = [...players].sort((a, b) => b.score - a.score);

    return (
      <div className="flex flex-col h-full px-6 py-10 space-y-6 text-center bg-gradient-to-b from-amber-300 to-amber-500 text-black overflow-y-auto">
        <div className="space-y-2 flex-shrink-0">
            <h2 className="text-7xl font-black tracking-tighter uppercase leading-none text-comic text-white">VENCEDOR!</h2>
            <p className="text-xl font-black uppercase">P.Q.P. - O JOGO É DELE</p>
        </div>
        
        <div className="bg-black text-white p-8 rounded-3xl w-full max-w-sm mx-auto rotate-2 shadow-2xl flex-shrink-0 border-4 border-white">
            <h3 className="text-4xl font-black uppercase">{winner.name}</h3>
            <p className="text-lg font-bold mt-1 uppercase tracking-widest">{winner.score.toFixed(1)} pontos</p>
        </div>

        <div className="bg-black/10 rounded-2xl p-4 w-full max-w-sm mx-auto text-left space-y-2 flex-shrink-0 border-2 border-black/20">
            <p className="text-xs font-black uppercase tracking-widest mb-2">Placar final</p>
            {ranking.map((p, i) => (
              <div key={i} className="flex justify-between items-center text-sm font-bold">
                <span>{i + 1}. {p.name}</span>
                <span>
                  {p.score.toFixed(1)} pts
                  {p.penalties > 0 && (
                    <span className="text-black/60"> ({p.penalties}x não leu, -{round1(p.penalties * READ_ALOUD_PENALTY).toFixed(1)})</span>
                  )}
                </span>
              </div>
            ))}
        </div>

        <div className="w-full max-w-sm mx-auto flex flex-col gap-4 mt-4 flex-shrink-0">
            <Button variant="secondary" onClick={() => restartGame(true)}>JOGAR NOVAMENTE</Button>
            <Button variant="secondary" onClick={() => restartGame(false)} className="bg-white text-black border-black">NOVOS JOGADORES</Button>
        </div>
      </div>
    );
  };

  const renderState = () => {
    switch (gameState) {
      case GameState.HOME: return renderHome();
      case GameState.SETUP_HOST: return renderSetupHost();
      case GameState.ADD_PLAYERS: return renderAddPlayers();
      case GameState.CREATE_QUESTION: return renderCreateQuestion();
      case GameState.ANSWER_ROUND: return renderAnswerRound();
      case GameState.WAIT_HOST: return renderWaitHost();
      case GameState.JUDGMENT: return judgePhase === 'reading' ? renderJudgeReading() : renderJudgePicking();
      case GameState.REVEAL: return renderReveal();
      case GameState.VICTORY: return renderVictory();
      default: return renderHome();
    }
  };

  return (
    <div className="h-screen w-screen max-w-lg mx-auto felt-bg flex flex-col relative overflow-hidden">
      <main className="flex-1 overflow-hidden">
        {renderState()}
      </main>
      <div className="h-16 bg-black/25 border-t-2 border-black/40 flex items-center justify-center text-[10px] text-white/60 font-bold uppercase tracking-widest flex-shrink-0 backdrop-blur-sm">
        Espaço Publicitário
      </div>
    </div>
  );
};

export default App;
