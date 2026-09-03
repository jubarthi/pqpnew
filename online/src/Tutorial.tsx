import React, { useState, useEffect } from 'react';
import { ThemeType, themes } from './theme';
import { soundEngine } from './soundEngine';
import { Language } from './i18n';

interface TutorialProps {
  theme: ThemeType;
  lang: Language;
  onFinish: () => void;
  onBackToWelcome?: () => void;
}

export const Tutorial: React.FC<TutorialProps> = ({
  theme,
  lang: _lang,
  onFinish,
  onBackToWelcome,
}) => {
  const [step, setStep] = useState(1);
  const totalSteps = 7;
  const curTheme = themes[theme];

  // Tocar efeitos de som contextuais em passos marcantes
  useEffect(() => {
    if (step === 4) {
      soundEngine.playCoringa();
    } else if (step === 6) {
      soundEngine.playChampion(true);
    } else if (step === 7) {
      soundEngine.playIntro();
    }
  }, [step]);

  const proximo = () => {
    soundEngine.playClick();
    if (step < totalSteps) {
      setStep((s) => s + 1);
    } else {
      onFinish();
    }
  };

  const anterior = () => {
    soundEngine.playClick();
    if (step > 1) {
      setStep((s) => s - 1);
    } else if (onBackToWelcome) {
      onBackToWelcome();
    }
  };

  return (
    <div
      className="h-screen w-screen max-w-lg mx-auto flex flex-col justify-between overflow-hidden px-5 py-6 select-none"
      style={curTheme.bgInlineStyle}
    >
      {/* Topo do Tutorial com Barra de Progresso e Botão Pular */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-black border-2 border-black font-black text-xs px-3 py-1 rounded-full uppercase tracking-wider shadow-[0_2px_0_#000]">
              🎓 TUTORIAL DO JOGO
            </span>
            <span className="text-white/80 font-black text-xs uppercase">
              {step} de {totalSteps}
            </span>
          </div>

          <button
            onClick={onFinish}
            className="text-white/70 hover:text-white font-bold text-xs uppercase underline tracking-wider px-2 py-1"
          >
            Pular ✕
          </button>
        </div>

        {/* Barra de Progresso Visual */}
        <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden border border-white/30">
          <div
            className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Conteúdo Central da Etapa */}
      <div className="flex-1 flex flex-col justify-center my-auto py-2 space-y-4 overflow-y-auto">
        {/* ========================================================================= */}
        {/* ETAPA 1: ABERTURA DA MESA E QR CODE */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in text-center">
            <div className="space-y-1">
              <span className="text-4xl inline-block animate-bounce">👑</span>
              <h2 className="text-2xl md:text-3xl font-black text-white title-crisp uppercase leading-tight">
                1. ABRIR SALA & CONECTAR AMIGOS
              </h2>
              <p className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                O Anfitrião abre a sala no seu próprio celular
              </p>
            </div>

            {/* Simulação Visual da Tela de Lobby */}
            <div className="bg-white border-4 border-black rounded-3xl p-4 card-shadow-lg space-y-3 max-w-sm mx-auto text-black rotate-[-0.5deg]">
              <div className="flex justify-between items-center bg-zinc-100 p-2 rounded-xl border-2 border-black">
                <span className="text-xs font-black uppercase text-zinc-700">CÓDIGO DA SALA:</span>
                <span className="text-lg font-black text-amber-600 tracking-widest bg-white px-2 py-0.5 rounded-lg border border-black">
                  PQP4
                </span>
              </div>

              {/* QR Code Simulado */}
              <div className="bg-amber-100 border-2 border-black rounded-2xl p-3 flex flex-col items-center justify-center space-y-1">
                <span className="text-4xl">📱</span>
                <p className="text-[11px] font-black uppercase text-amber-900">
                  Amigos apontam a câmera pro celular do Anfitrião
                </p>
              </div>

              {/* Lista de Jogadores Conectados */}
              <div className="space-y-1 text-left">
                <p className="text-[10px] font-black uppercase text-zinc-500">Mesa Conectada (Tempo Real no Celular):</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs font-bold">
                  <div className="bg-zinc-50 border border-black p-1.5 rounded-xl flex items-center justify-between">
                    <span>👑 Você (Host)</span>
                    <span className="text-emerald-600 text-[10px]">● online</span>
                  </div>
                  <div className="bg-zinc-50 border border-black p-1.5 rounded-xl flex items-center justify-between">
                    <span>Bruno</span>
                    <span className="text-emerald-600 text-[10px]">● online</span>
                  </div>
                  <div className="bg-zinc-50 border border-black p-1.5 rounded-xl flex items-center justify-between">
                    <span>Camila</span>
                    <span className="text-emerald-600 text-[10px]">● online</span>
                  </div>
                  <div className="bg-zinc-50 border border-black p-1.5 rounded-xl flex items-center justify-between">
                    <span>Rodrigo</span>
                    <span className="text-emerald-600 text-[10px]">● online</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-white/90 leading-relaxed max-w-sm mx-auto">
              Cada amigo aponta o celular pro aparelho do Anfitrião (ou digita o código), coloca seu apelido e entra na hora! Com 3 ou mais na mesa, o Anfitrião clica em <strong>INICIAR PARTIDA</strong>!
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ETAPA 2: A CARTA DA RODADA */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in text-center">
            <div className="space-y-1">
              <span className="text-4xl inline-block animate-bounce">🎲</span>
              <h2 className="text-2xl md:text-3xl font-black text-white title-crisp uppercase leading-tight">
                2. A PERGUNTA DA RODADA
              </h2>
              <p className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                O Anfitrião lê a frase em voz alta para a mesa
              </p>
            </div>

            {/* Simulação Visual do Card de Pergunta */}
            <div className="bg-white border-4 border-black rounded-3xl p-5 card-shadow-lg space-y-3 max-w-sm mx-auto text-black rotate-0.5">
              <span className="inline-block bg-[#003388] text-white text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-widest">
                CARTA DA RODADA (1 ESPAÇO)
              </span>
              <p className="text-lg md:text-xl font-black leading-snug">
                "No almoço de domingo em família, meu maior segredo foi esconder ___ debaixo da mesa."
              </p>
              <div className="pt-1 flex items-center justify-center gap-2">
                <span className="bg-amber-100 text-amber-900 border border-black text-[10px] font-black px-2 py-0.5 rounded-full">
                  Trocas restantes: 3/3
                </span>
              </div>
            </div>

            <div className="bg-black/40 border-2 border-white/20 p-3 rounded-2xl max-w-sm mx-auto">
              <p className="text-xs font-bold text-white/95 leading-relaxed">
                🗣️ <strong>Regra de Ouro:</strong> O anfitrião lê a pergunta em voz alta com bastante drama! Se não gostar da pergunta, ele pode sortear outra (até 3 trocas por rodada).
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ETAPA 3: A SUA RESPOSTA */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in text-center">
            <div className="space-y-1">
              <span className="text-4xl inline-block animate-bounce">✍️</span>
              <h2 className="text-2xl md:text-3xl font-black text-white title-crisp uppercase leading-tight">
                3. ESCOLHA SUA RESPOSTA
              </h2>
              <p className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                Cada participante escolhe a melhor carta da sua mão
              </p>
            </div>

            {/* Simulação Visual da Mão de Cartas do Jogador */}
            <div className="space-y-2 max-w-sm mx-auto text-left">
              {/* Pergunta Fixa no Topo */}
              <div className="bg-zinc-900 text-white border-2 border-black p-2.5 rounded-2xl text-center">
                <span className="text-[9px] bg-amber-400 text-black font-black px-2 py-0.5 rounded uppercase">
                  📌 Pergunta Fixa
                </span>
                <p className="text-xs font-bold mt-1">"No almoço de domingo em família, meu maior segredo foi esconder ___..."</p>
              </div>

              {/* Cartas da Mão */}
              <div className="space-y-1.5">
                <div className="bg-zinc-100 border-2 border-black p-2.5 rounded-xl text-black font-bold text-xs opacity-75">
                  1. Um boleto vencido há 3 meses
                </div>
                <div className="bg-amber-300 border-3 border-black p-3 rounded-xl text-black font-black text-sm shadow-[0_3px_0_#000] scale-[1.02]">
                  ✓ 2. A dentadura do meu avô dentro do pudim 👈
                </div>
                <div className="bg-zinc-100 border-2 border-black p-2.5 rounded-xl text-black font-bold text-xs opacity-75">
                  3. Uma mensagem de áudio de 15 minutos
                </div>
              </div>

              <div className="bg-emerald-400 text-black border-2 border-black p-2 rounded-xl text-center font-black text-xs uppercase shadow-[0_2px_0_#000]">
                ✅ CONFIRMAR RESPOSTA
              </div>
            </div>

            <p className="text-xs font-bold text-white/90 leading-relaxed max-w-sm mx-auto">
              Ao selecionar sua carta, a tela rola direto para o botão de confirmação. Assim que você envia, a tela aguarda os outros jogadores.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ETAPA 4: O CORINGA RELÂMPAGO */}
        {/* ========================================================================= */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in text-center">
            <div className="space-y-1">
              <span className="text-5xl inline-block animate-bounce">🃏</span>
              <h2 className="text-2xl md:text-3xl font-black text-white title-crisp uppercase leading-tight">
                4. O CORINGA RELÂMPAGO!
              </h2>
              <p className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                O mais rápido ganha o direito de digitar qualquer coisa!
              </p>
            </div>

            {/* Simulação Visual do Alerta do Coringa */}
            <div className="bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 border-4 border-black p-5 rounded-3xl card-shadow-lg space-y-3 max-w-sm mx-auto text-black animate-pulse">
              <div className="flex justify-between items-center">
                <span className="bg-black text-amber-300 text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
                  ⚡ RELÂMPAGO
                </span>
                <span className="text-xl font-black bg-black text-white px-3 py-0.5 rounded-xl border border-white">
                  5s
                </span>
              </div>
              <p className="text-lg font-black uppercase leading-tight">
                VOCÊ É O PALHAÇO DA VEZ? 🤡
              </p>
              <div className="bg-black text-amber-300 border-2 border-white p-2.5 rounded-2xl font-black text-xs uppercase shadow-md">
                EU QUERO SER O CORINGA! 💥
              </div>
            </div>

            <div className="bg-black/50 border-2 border-amber-400/60 p-3 rounded-2xl max-w-sm mx-auto">
              <p className="text-xs font-bold text-amber-200 leading-relaxed">
                🤫 <strong>Segredo Absoluto:</strong> Se você for o primeiro a clicar, ninguém saberá quem pegou! Você ganha um campo aberto para <strong>escrever a resposta mais sem noção que quiser</strong>!
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ETAPA 5: O JULGAMENTO DO ANFITRIÃO */}
        {/* ========================================================================= */}
        {step === 5 && (
          <div className="space-y-4 animate-fade-in text-center">
            <div className="space-y-1">
              <span className="text-4xl inline-block animate-bounce">🗣️</span>
              <h2 className="text-2xl md:text-3xl font-black text-white title-crisp uppercase leading-tight">
                5. LEITURA & JULGAMENTO
              </h2>
              <p className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                O Anfitrião lê todas e escolhe a vencedora
              </p>
            </div>

            {/* Simulação Visual da Tela de Julgamento */}
            <div className="space-y-2 max-w-sm mx-auto text-left">
              {/* Pergunta Fixa no Topo */}
              <div className="bg-white border-3 border-black p-2.5 rounded-2xl text-black text-center shadow-md">
                <span className="text-[9px] bg-amber-400 text-black font-black px-2 py-0.5 rounded uppercase">
                  📌 Pergunta Fixa no Topo
                </span>
                <p className="text-xs font-black mt-1">"No almoço de domingo em família, meu maior segredo foi esconder ___..."</p>
              </div>

              {/* Cards com as Frases Completas Montadas */}
              <div className="bg-white border-2 border-black p-2.5 rounded-2xl text-black space-y-1.5 card-shadow">
                <p className="text-xs font-bold">
                  "...esconder <strong className="bg-amber-300 px-1.5 py-0.5 rounded border border-black">A DENTADURA DO VOVÔ</strong> debaixo da mesa."
                </p>
                <div className="bg-amber-400 text-black text-[10px] font-black uppercase text-center p-1.5 rounded-xl border border-black">
                  👑 ESCOLHER ESTA VENCEDORA
                </div>
              </div>

              {/* Avaliação da Leitura */}
              <div className="bg-zinc-900 border-2 border-amber-400 p-2.5 rounded-2xl text-white text-center space-y-1">
                <p className="text-[10px] font-black text-amber-300 uppercase">A MESA AVALIA: O ANFITRIÃO LEU EM VOZ ALTA?</p>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-black">
                  <span className="bg-emerald-400 text-black py-1 rounded-lg">👍 LEU MUITO BEM!</span>
                  <span className="bg-rose-500 text-white py-1 rounded-lg">👎 NÃO LEU (-0.3)</span>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-white/90 leading-relaxed max-w-sm mx-auto">
              O anfitrião lê todas as combinações em voz alta sem pressa. A mesa avalia se ele leu direito e ele coroa a melhor frase da rodada!
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ETAPA 6: VITÓRIA, PLACAR & NOVO ANFITRIÃO */}
        {/* ========================================================================= */}
        {step === 6 && (
          <div className="space-y-4 animate-fade-in text-center">
            <div className="space-y-1">
              <span className="text-4xl inline-block animate-bounce">🏆</span>
              <h2 className="text-2xl md:text-3xl font-black text-white title-crisp uppercase leading-tight">
                6. PLACAR & NOVO ANFITRIÃO
              </h2>
              <p className="text-xs text-amber-300 font-bold uppercase tracking-wider">
                O bastão passa para o vencedor da rodada
              </p>
            </div>

            {/* Simulação Visual do Placar da Rodada */}
            <div className="bg-black/50 border-3 border-white/30 rounded-3xl p-4 card-shadow-lg space-y-2 max-w-sm mx-auto text-left">
              <div className="flex justify-between items-center text-xs font-black text-amber-300">
                <span>🏆 PLACAR DA MESA</span>
                <span>META: 4.0 PTS</span>
              </div>

              <div className="space-y-1.5">
                <div className="bg-amber-100 border-2 border-black p-2 rounded-xl text-black space-y-1">
                  <div className="flex justify-between text-xs font-black">
                    <span>🥇 Camila (Venceu a rodada!)</span>
                    <span>1.6 pts (+0.8)</span>
                  </div>
                  <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden border border-black/30">
                    <div className="bg-emerald-500 h-full w-[40%]" />
                  </div>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase">Faltam 2.4 pts para vencer a partida</p>
                </div>

                <div className="bg-white border-2 border-black p-1.5 rounded-xl text-black flex justify-between text-xs font-bold">
                  <span>🥈 Bruno</span>
                  <span>0.8 pts</span>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-white/90 leading-relaxed max-w-sm mx-auto">
              Quem vencer a rodada leva <strong>+0.8 ponto</strong> e se torna o <strong>novo Anfitrião</strong> da próxima pergunta! Quem atingir 4.0 pontos primeiro é consagrado o Grande Campeão da Mesa!
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ETAPA 7: TELA FINAL DIVERTIDA — BÓRA COMEÇAR P.Q.P.? */}
        {/* ========================================================================= */}
        {step === 7 && (
          <div className="space-y-6 animate-fade-in text-center my-auto">
            <div className="space-y-3 transform -rotate-1">
              <span className="text-6xl inline-block animate-bounce">🔥</span>
              <h1 className="text-4xl md:text-5xl font-black text-white title-crisp uppercase tracking-tight leading-none">
                BÓRA COMEÇAR <br />
                <span className="text-amber-300 drop-shadow-[0_4px_0_#000]">P.Q.P.?</span>
              </h1>
              <p className="text-sm font-black uppercase text-amber-200 tracking-widest">
                Você já sabe tudo. Agora chame a galera e que vença o mais sem noção!
              </p>
            </div>

            <div className="w-full max-w-sm mx-auto space-y-3 pt-2">
              <button
                onClick={onFinish}
                className="btn-3d w-full py-5 px-6 rounded-3xl font-black text-2xl uppercase tracking-wider bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 border-4 border-black text-black shadow-[0_8px_0_#000] hover:scale-[1.02] active:translate-y-1 transition-all"
              >
                🔥 BÓRA JOGAR AGORA!
              </button>

              <button
                onClick={() => setStep(1)}
                className="text-white/80 hover:text-white font-black text-xs uppercase underline tracking-wider pt-1"
              >
                ↺ Rever Tutorial do Início
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Barra Inferior com Botões Voltar e Avançar */}
      <div className="pt-3 border-t-2 border-white/20 flex items-center justify-between gap-3">
        <button
          onClick={anterior}
          className="bg-black/60 hover:bg-black/80 text-white border-2 border-white/40 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
        >
          {step === 1 ? '← Início' : '⬅️ Voltar'}
        </button>

        {/* Indicadores de bolinhas */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              onClick={() => {
                soundEngine.playClick();
                setStep(i + 1);
              }}
              className={`h-2.5 rounded-full cursor-pointer transition-all ${
                step === i + 1 ? 'w-6 bg-amber-400 border border-black shadow' : 'w-2.5 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>

        <button
          onClick={proximo}
          className="bg-amber-400 hover:bg-amber-300 text-black border-2 border-black px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-[0_3px_0_#000] active:translate-y-0.5 transition-all"
        >
          {step === totalSteps ? '🚀 BÓRA!' : 'Avançar ➡️'}
        </button>
      </div>
    </div>
  );
};
