class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  constructor() {
    // AudioContext é instanciado no primeiro toque do usuário
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(val: boolean) {
    this.muted = val;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  // 1. Som de Inicialização do Jogo / Boas-vindas (Arcade Chime)
  public playIntro() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25]; // C4, E4, G4, C5, E5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0, now + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.2, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.36);
    });
  }

  // 2. Risada do Coringa Marcante (HA-HA-HA-HA em todos os celulares) 🃏
  public playCoringa() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const laughs = [
      { pitch: 480, time: 0.00, dur: 0.14 },
      { pitch: 550, time: 0.15, dur: 0.14 },
      { pitch: 510, time: 0.30, dur: 0.14 },
      { pitch: 620, time: 0.45, dur: 0.16 },
      { pitch: 440, time: 0.63, dur: 0.22 },
      { pitch: 360, time: 0.86, dur: 0.30 },
    ];

    laughs.forEach((l) => {
      const osc = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      mod.type = 'sine';
      mod.frequency.setValueAtTime(25, now + l.time);
      modGain.gain.setValueAtTime(30, now + l.time);

      osc.frequency.setValueAtTime(l.pitch, now + l.time);
      osc.frequency.exponentialRampToValueAtTime(l.pitch * 0.75, now + l.time + l.dur);

      gain.gain.setValueAtTime(0, now + l.time);
      gain.gain.linearRampToValueAtTime(0.28, now + l.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + l.time + l.dur);

      mod.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(ctx.destination);

      mod.start(now + l.time);
      osc.start(now + l.time);
      mod.stop(now + l.time + l.dur + 0.02);
      osc.stop(now + l.time + l.dur + 0.02);
    });
  }

  // 3. Som de Sala Aberta / Criada
  public playRoomOpen() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [330, 415, 523, 659, 830];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.06);
      gain.gain.setValueAtTime(0.2, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.26);
    });
  }

  // 4. Som de Fim de Rodada / Gongo
  public playRoundEnd() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.8);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.25);
  }

  // 5. Som de Campeão / Vencedor EXCLUSIVO no celular do vencedor
  public playChampion(isWinner: boolean) {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (isWinner) {
      // Fanfarra Épica de Vitória (Trompetes Real / Royal Fanfare) 🎺
      const melody = [
        { f: 392.0, d: 0.15 }, // G4
        { f: 523.25, d: 0.15 }, // C5
        { f: 659.25, d: 0.15 }, // E5
        { f: 783.99, d: 0.4 },  // G5
        { f: 659.25, d: 0.15 }, // E5
        { f: 783.99, d: 0.7 },  // G5 sustentado
      ];

      let t = now;
      melody.forEach((note) => {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc2.type = 'triangle';
        osc.frequency.setValueAtTime(note.f, t);
        osc2.frequency.setValueAtTime(note.f * 1.005, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.28, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + note.d);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc2.start(t);
        osc.stop(t + note.d + 0.05);
        osc2.stop(t + note.d + 0.05);

        t += note.d * 0.85;
      });
    } else {
      // Som cômico de derrota leve para os demais participantes
      const notes = [392.0, 349.23, 329.63, 261.63];
      notes.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.18);
        gain.gain.setValueAtTime(0.12, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.4);
      });
    }
  }

  // 5. Clique de Voto / UI
  public playVoteTick() {
    if (this.muted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // 6. Clique Geral de UI
  public playClick() {
    this.playVoteTick();
  }
}

export const soundEngine = new SoundEngine();
