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

  // Efeitos sonoros temáticos em passos especiais
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
      className="h-screen w-screen max-w-lg mx-auto flex flex-col justify-between overflow-hidden px-4 py-5 select-none"
      style={curTheme.bgInlineStyle}
    >
      {/* ------------------------------------------------------------- */}
      {/* CABEÇALHO DO TUTORIAL: CONTADOR & BARRA DE PROGRESSO          */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-amber-400 text-black border-2 border-black font-black text-[11px] px-3 py-1 rounded-full uppercase tracking-wider shadow-[0_2px_0_#000]">
              🎓 TUTORIAL OFICIAL P.Q.P.
            </span>
            <span className="text-white/90 font-black text-xs uppercase bg-black/40 px-2 py-0.5 rounded-lg border border-white/20">
              {step} / {totalSteps}
            </span>
          </div>

          <button
            onClick={onFinish}
            className="text-white/80 hover:text-white font-black text-xs uppercase underline tracking-wider px-2 py-1 transition-all"
          >
            Pular ✕
          </button>
        </div>

        {/* Barra de Progresso */}
        <div className="w-full bg-black/50 h-2.5 rounded-full overflow-hidden border border-white/30">
          <div
            className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-sm"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ÁREA CENTRAL INTERATIVA DO TUTORIAL                            */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col justify-center my-auto py-2 space-y-3 overflow-y-auto">
        {/* ========================================================================= */}
        {/* PASSO 1: ABRIR SALA NO CELULAR & CONECTAR PELO QR CODE                    */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="space-y-3 animate-fade-in text-center">
            <div className="space-y-0.5">
              <span className="text-3xl inline-block">👑</span>
              <h2 className="text-xl md:text-2xl font-black text-white title-crisp uppercase leading-tight">
                1. ABRIR SALA NO SEU CELULAR
              </h2>
              <p className="text-[11px] text-amber-300 font-black uppercase tracking-wider">
                Os amigos apontam a câmera pro seu celular e entram na hora
              </p>
            </div>

            {/* Mockup da Tela do Celular do Anfitrião */}
            <div className="bg-white border-4 border-black rounded-3xl p-3.5 card-shadow space-y-2.5 max-w-sm mx-auto text-black">
              <div className="flex justify-between items-center bg-zinc-100 p-2 rounded-xl border-2 border-black">
                <span className="text-[11px] font-black uppercase text-zinc-700">CÓDIGO DA SALA:</span>
                <span className="text-base font-black text-amber-600 tracking-widest bg-white px-2 py-0.5 rounded-lg border border-black">
                  4PQP
                </span>
              </div>

              {/* QR Code Simulado no Celular */}
              <div className="bg-amber-50 border-2 border-dashed border-amber-400 rounded-2xl p-3 flex flex-col items-center justify-center space-y-1">
                <span className="text-3xl">📱</span>
                <p className="text-[10px] font-black uppercase text-amber-900">
                  Amigos apontam a câmera do celular pro seu QR Code
                </p>
              </div>

              {/* Lista de Conectados em Tempo Real */}
              <div className="space-y-1 text-left">
                <p className="text-[9px] font-black uppercase text-zinc-500">Mesa Conectada (Em Tempo Real):</p>
                <div className="grid grid-cols-2 gap-1 text-[11px] font-bold">
                  <div className="bg-zinc-50 border border-black p-1 rounded-lg flex items-center justify-between">
                    <span>👑 Você (Host)</span>
                    <span className="text-emerald-600 text-[9px]">● online</span>
                  </div>
                  <div className="bg-zinc-50 border border-black p-1 rounded-lg flex items-center justify-between">
                    <span>Bruno</span>
                    <span className="text-emerald-600 text-[9px]">● online</span>
                  </div>
                  <div className="bg-zinc-50 border border-black p-1 rounded-lg flex items-center justify-between">
                    <span>Camila</span>
                    <span className="text-emerald-600 text-[9px]">● online</span>
                  </div>
                  <div className="bg-zinc-50 border border-black p-1 rounded-lg flex items-center justify-between">
                    <span>Rodrigo</span>
                    <span className="text-emerald-600 text-[9px]">● online</span>
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-white/90 leading-relaxed max-w-sm mx-auto">
              Você abre a sala no seu celular. Os amigos apontam a câmera do celular deles pro seu QR Code, digitam seus apelidos e todos ficam conectados <strong>online</strong>. Quando todos entrarem, você clica em <strong>INICIAR PARTIDA</strong>!
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASSO 2: A PERGUNTA DA RODADA (LEITURA EM VOZ ALTA)                      */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="space-y-3 animate-fade-in text-center">
            <div className="space-y-0.5">
              <span className="text-3xl inline-block">🎲</span>
              <h2 className="text-xl md:text-2xl font-black text-white title-crisp uppercase leading-tight">
                2. A PERGUNTA DA RODADA
              </h2>
              <p className="text-[11px] text-amber-300 font-black uppercase tracking-wider">
                O Anfitrião lê a frase em voz alta para toda a mesa
              </p>
            </div>

            {/* Mockup da Carta da Pergunta */}
            <div className="bg-white border-4 border-black rounded-3xl p-4 card-shadow space-y-2.5 max-w-sm mx-auto text-black">
              <span className="inline-block bg-[#003388] text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-widest">
                CARTA DA RODADA (1 ESPAÇO)
              </span>
              <p className="text-base md:text-lg font-black leading-snug">
                "No almoço de domingo em família, meu maior segredo foi esconder ___ debaixo da mesa."
              </p>
              <div className="flex items-center justify-center gap-2 pt-0.5">
                <span className="bg-amber-100 text-amber-900 border border-black text-[10px] font-black px-2 py-0.5 rounded-full">
                  Trocas disponíveis: 3/3
                </span>
              </div>
            </div>

            <div className="bg-black/40 border-2 border-white/20 p-2.5 rounded-2xl max-w-sm mx-auto">
              <p className="text-xs font-bold text-white/95 leading-relaxed">
                🗣️ <strong>Como Funciona:</strong> O Anfitrião lê a frase em voz alta com bastante drama! Ele pode clicar em <strong>USAR ESTA PERGUNTA</strong> ou em <strong>SORTEAR OUTRA</strong> (até 3 trocas por rodada).
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASSO 3: A TELA DO USUÁRIO (ESCOLHER E ENVIAR RESPOSTA)                  */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div className="space-y-3 animate-fade-in text-center">
            <div className="space-y-0.5">
              <span className="text-3xl inline-block">🃏</span>
              <h2 className="text-xl md:text-2xl font-black text-white title-crisp uppercase leading-tight">
                3. A SUA RESPOSTA NO CELULAR
              </h2>
              <p className="text-[11px] text-amber-300 font-black uppercase tracking-wider">
                Pergunta fixa no topo e suas cartas abaixo
              </p>
            </div>

            {/* Mockup da Tela dos Jogadores */}
            <div className="space-y-2 max-w-sm mx-auto text-left">
              {/* Pergunta Fixa */}
              <div className="bg-zinc-900 text-white border-2 border-black p-2 rounded-xl text-center">
                <span className="text-[9px] bg-amber-400 text-black font-black px-1.5 py-0.2 rounded uppercase">
                  📌 Pergunta Fixa
                </span>
                <p className="text-[11px] font-bold mt-0.5">"...esconder ___ debaixo da mesa."</p>
              </div>

              {/* Cartas da Mão */}
              <div className="space-y-1">
                <div className="bg-zinc-100 border-2 border-black p-2 rounded-xl text-black font-bold text-[11px] opacity-75">
                  1. Um boleto vencido há 3 meses
                </div>
                <div className="bg-amber-300 border-3 border-black p-2 rounded-xl text-black font-black text-xs shadow-[0_2px_0_#000] scale-[1.01]">
                  ✓ 2. A dentadura do meu avô dentro do pudim 👈
                </div>
              </div>

              {/* Botão de Envio */}
              <div className="bg-emerald-400 text-black border-2 border-black p-2 rounded-xl text-center font-black text-xs uppercase shadow-[0_2px_0_#000]">
                ✅ CONFIRMAR RESPOSTA
              </div>
            </div>

            <p className="text-xs font-bold text-white/90 leading-relaxed max-w-sm mx-auto">
              No celular de cada jogador, a pergunta fica fixa no topo. Você escolhe a resposta mais engraçada da sua mão, clica nela e depois clica em <strong>CONFIRMAR RESPOSTA</strong>. Na tela aparece: <em>"Resposta enviada! Aguardando os demais..."</em>
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASSO 4: O CORINGA RELÂMPAGO (5 SEGUNDOS)                                */}
        {/* ========================================================================= */}
        {step === 4 && (
          <div className="space-y-3 animate-fade-in text-center">
            <div className="space-y-0.5">
              <span className="text-4xl inline-block animate-bounce">🤡</span>
              <h2 className="text-xl md:text-2xl font-black text-white title-crisp uppercase leading-tight">
                4. O CORINGA RELÂMPAGO!
              </h2>
              <p className="text-[11px] text-amber-300 font-black uppercase tracking-wider">
                5 segundos para garantir e escrever o que quiser!
              </p>
            </div>

            {/* Mockup do Alerta do Coringa */}
            <div className="bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 border-4 border-black p-4 rounded-3xl card-shadow space-y-2 max-w-sm mx-auto text-black">
              <div className="flex justify-between items-center">
                <span className="bg-black text-amber-300 text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
                  ⚡ CORINGA RELÂMPAGO
                </span>
                <span className="text-base font-black bg-black text-white px-2.5 py-0.5 rounded-lg border border-white">
                  5s
                </span>
              </div>
              <p className="text-base font-black uppercase leading-tight">
                VOCÊ É O PALHAÇO DA VEZ? 🤡
              </p>
              <div className="bg-black text-amber-300 border-2 border-white p-2 rounded-xl font-black text-xs uppercase shadow-md">
                EU QUERO SER O CORINGA! 💥
              </div>
            </div>

            <div className="bg-black/50 border-2 border-amber-400/60 p-2.5 rounded-2xl max-w-sm mx-auto">
              <p className="text-xs font-bold text-amber-200 leading-relaxed">
                🤫 <strong>Segredo:</strong> Se aparecer o Coringa do nada, você tem <strong>5 segundos</strong> para ser o primeiro a apertar e garantir ele para você! Não conte para ninguém... agora você pode <strong>escrever como quiser a resposta</strong> do próprio punho!
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASSO 5: TODOS ENVIARAM -> TELA DO ANFITRIÃO COM PERGUNTA FIXA E RESPOSTAS*/}
        {/* ========================================================================= */}
        {step === 5 && (
          <div className="space-y-3 animate-fade-in text-center">
            <div className="space-y-0.5">
              <span className="text-3xl inline-block">🗣️</span>
              <h2 className="text-xl md:text-2xl font-black text-white title-crisp uppercase leading-tight">
                5. JULGAMENTO DO ANFITRIÃO
              </h2>
              <p className="text-[11px] text-amber-300 font-black uppercase tracking-wider">
                Pergunta fixa em cima e todas as respostas abaixo
              </p>
            </div>

            {/* Mockup da Tela de Julgamento */}
            <div className="space-y-2 max-w-sm mx-auto text-left">
              {/* Pergunta Fixa no Topo */}
              <div className="bg-white border-3 border-black p-2 rounded-xl text-black text-center shadow-sm">
                <span className="text-[9px] bg-amber-400 text-black font-black px-1.5 py-0.2 rounded uppercase">
                  📌 Pergunta Fixa no Topo
                </span>
                <p className="text-xs font-black mt-0.5">"No almoço de domingo em família, meu maior segredo foi esconder ___..."</p>
              </div>

              {/* Cards de Respostas da Mesa */}
              <div className="bg-white border-2 border-black p-2 rounded-xl text-black space-y-1 card-shadow">
                <p className="text-xs font-bold">
                  "...esconder <strong className="bg-amber-300 px-1 py-0.5 rounded border border-black">A DENTADURA DO VOVÔ</strong> debaixo da mesa."
                </p>
                <div className="bg-amber-400 text-black text-[9px] font-black uppercase text-center p-1 rounded-lg border border-black">
                  👑 ESCOLHER ESTA VENCEDORA
                </div>
              </div>

              <div className="bg-zinc-900 border border-amber-400/80 p-1.5 rounded-xl text-white text-center">
                <p className="text-[9px] font-black text-amber-300 uppercase">A MESA AVALIA: O ANFITRIÃO LEU EM VOZ ALTA? 👍 / 👎</p>
              </div>
            </div>

            <p className="text-xs font-bold text-white/90 leading-relaxed max-w-sm mx-auto">
              Quando todos enviam, na tela dos participantes abre: <em>"Anfitrião vai escolher"</em>. No celular do Anfitrião, a <strong>pergunta fica fixa em cima e todas as respostas aparecem abaixo</strong>. Ele lê todas em voz alta e escolhe a que mais gostou!
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASSO 6: VENCEDOR DA RODADA & NOVO ANFITRIÃO                             */}
        {/* ========================================================================= */}
        {step === 6 && (
          <div className="space-y-3 animate-fade-in text-center">
            <div className="space-y-0.5">
              <span className="text-3xl inline-block">🏆</span>
              <h2 className="text-xl md:text-2xl font-black text-white title-crisp uppercase leading-tight">
                6. VENCEDOR & NOVO ANFITRIÃO
              </h2>
              <p className="text-[11px] text-amber-300 font-black uppercase tracking-wider">
                O autor da frase ganha os pontos e vira o novo anfitrião
              </p>
            </div>

            {/* Mockup do Placar e Vitória */}
            <div className="bg-black/50 border-3 border-white/30 rounded-3xl p-3 card-shadow space-y-1.5 max-w-sm mx-auto text-left">
              <div className="flex justify-between items-center text-xs font-black text-amber-300">
                <span>🏆 PLACAR DA MESA</span>
                <span>META: 4.0 PTS</span>
              </div>

              <div className="space-y-1">
                <div className="bg-amber-100 border-2 border-black p-2 rounded-xl text-black space-y-0.5">
                  <div className="flex justify-between text-xs font-black">
                    <span>🥇 Camila (Vencedora da Rodada!)</span>
                    <span>1.6 pts (+0.8)</span>
                  </div>
                  <div className="w-full bg-zinc-200 h-1.5 rounded-full overflow-hidden border border-black/30">
                    <div className="bg-emerald-500 h-full w-[40%]" />
                  </div>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase">Faltam 2.4 pts para vencer a partida</p>
                </div>
              </div>
            </div>

            <p className="text-xs font-bold text-white/90 leading-relaxed max-w-sm mx-auto">
              O Anfitrião escolhe a melhor resposta e aparece o vencedor para quem era o dono da resposta (com barulho de vitória no celular dele) e para os outros mostra a derrota cômica. O vencedor ganha <strong>+0.8 ponto</strong> e se torna o <strong>NOVO ANFITRIÃO</strong> da próxima rodada!
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASSO 7: TELA FINAL DIVERTIDA — BÓRA COMEÇAR PQP?                         */}
        {/* ========================================================================= */}
        {step === 7 && (
          <div className="space-y-5 animate-fade-in text-center my-auto">
            <div className="space-y-2 transform -rotate-1">
              <span className="text-5xl inline-block animate-bounce">🔥</span>
              <h1 className="text-3xl md:text-4xl font-black text-white title-crisp uppercase tracking-tight leading-none">
                BÓRA COMEÇAR <br />
                <span className="text-amber-300 drop-shadow-[0_4px_0_#000]">PQP?</span>
              </h1>
              <p className="text-xs font-black uppercase text-amber-200 tracking-widest">
                Você já sabe tudo! Agora junte os amigos no celular e que vença o mais sem noção!
              </p>
            </div>

            <div className="w-full max-w-sm mx-auto space-y-2.5 pt-1">
              <button
                onClick={onFinish}
                className="btn-3d w-full py-4 px-5 rounded-3xl font-black text-xl uppercase tracking-wider bg-gradient-to-b from-amber-300 via-amber-400 to-amber-500 border-4 border-black text-black shadow-[0_6px_0_#000] hover:scale-[1.02] active:translate-y-1 transition-all"
              >
                🔥 BÓRA JOGAR AGORA!
              </button>

              <button
                onClick={() => setStep(1)}
                className="text-white/80 hover:text-white font-black text-xs uppercase underline tracking-wider pt-0.5"
              >
                ↺ Rever Tutorial do Início
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* BARRA INFERIOR DE CONTROLES: VOLTAR, INDICADORES E AVANÇAR     */}
      {/* ------------------------------------------------------------- */}
      <div className="pt-2.5 border-t-2 border-white/20 flex items-center justify-between gap-2">
        <button
          onClick={anterior}
          className="bg-black/60 hover:bg-black/80 text-white border-2 border-white/40 px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all"
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
              className={`h-2 rounded-full cursor-pointer transition-all ${
                step === i + 1 ? 'w-5 bg-amber-400 border border-black shadow' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
            />
          ))}
        </div>

        <button
          onClick={proximo}
          className="bg-amber-400 hover:bg-amber-300 text-black border-2 border-black px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-[0_2px_0_#000] active:translate-y-0.5 transition-all"
        >
          {step === totalSteps ? '🚀 BÓRA!' : 'Avançar ➡️'}
        </button>
      </div>
    </div>
  );
};
