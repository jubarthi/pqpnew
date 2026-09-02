export type ThemeType = 'cassino' | 'popart';

export interface ThemeStyles {
  id: ThemeType;
  name: string;
  icon: string;
  bgClass: string;
  bgInlineStyle: React.CSSProperties;
  titleClass: string;
  subtitleClass: string;
  cardPromptClass: string;
  cardOptionClass: (selected: boolean) => string;
  btnPrimaryClass: string;
  btnSecondaryClass: string;
  btnDangerClass: string;
  btnSuccessClass: string;
}

export const themes: Record<ThemeType, ThemeStyles> = {
  cassino: {
    id: 'cassino',
    name: 'Cassino Verde',
    icon: '🎰',
    bgClass: 'felt-bg text-white',
    bgInlineStyle: {
      background: 'radial-gradient(ellipse at 50% 15%, #1fa147 0%, #167a34 50%, #0d4a1f 85%, #082d13 100%)',
      boxShadow: 'inset 0 0 100px rgba(0, 0, 0, 0.45)',
    },
    titleClass: 'text-white font-black title-crisp tracking-tight',
    subtitleClass: 'text-amber-300 font-black tracking-widest uppercase text-sm',
    cardPromptClass: 'bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg text-black rotate-[-0.5deg]',
    cardOptionClass: (selected: boolean) =>
      `w-full text-left p-4 rounded-2xl font-black text-base leading-snug transition-all transform select-none ${
        selected
          ? 'bg-amber-100 border-4 border-amber-500 ring-4 ring-amber-300/80 -translate-y-1 shadow-[0_8px_0_#000] text-black'
          : 'bg-white border-3 border-black card-shadow hover:-translate-y-0.5 active:translate-y-1 text-black'
      }`,
    btnPrimaryClass: 'btn-3d bg-gradient-to-b from-amber-300 to-amber-400 text-black border-4 border-black font-black rounded-2xl shadow-[0_6px_0_#000]',
    btnSecondaryClass: 'btn-3d bg-gradient-to-b from-blue-500 to-blue-600 text-white border-4 border-black font-black rounded-2xl shadow-[0_6px_0_#000]',
    btnDangerClass: 'btn-3d bg-gradient-to-b from-rose-500 to-red-600 text-white border-4 border-black font-black rounded-2xl shadow-[0_6px_0_#000]',
    btnSuccessClass: 'btn-3d bg-gradient-to-b from-emerald-400 to-emerald-500 text-black border-4 border-black font-black rounded-2xl shadow-[0_6px_0_#000]',
  },
  popart: {
    id: 'popart',
    name: 'Comic Quiz Azul',
    icon: '⚡',
    bgClass: 'comic-blue-bg text-white',
    bgInlineStyle: {
      backgroundColor: '#0088FF',
      backgroundImage: 'radial-gradient(#0066CC 15%, transparent 15%)',
      backgroundPosition: '0 0',
      backgroundSize: '22px 22px',
    },
    titleClass: 'text-white font-black title-crisp tracking-tight',
    subtitleClass: 'text-sky-200 font-extrabold tracking-widest uppercase text-sm',
    cardPromptClass: 'card-comic-doodle p-6 text-[#003388] rotate-[-1deg]',
    cardOptionClass: (selected: boolean) =>
      `w-full text-left p-4 rounded-full font-black text-base leading-snug transition-all transform select-none relative ${
        selected
          ? 'bg-amber-300 text-black border-4 border-black shadow-[0_6px_0_#000] scale-[1.02]'
          : 'bg-white text-[#003388] border-3 border-[#003388]/30 btn-comic-pill hover:border-[#003388] hover:scale-[1.01]'
      }`,
    btnPrimaryClass: 'btn-3d bg-white text-[#003388] border-4 border-black font-black rounded-full shadow-[0_6px_0_#000]',
    btnSecondaryClass: 'btn-3d bg-[#003388] text-white border-4 border-black font-black rounded-full shadow-[0_6px_0_#000]',
    btnDangerClass: 'btn-3d bg-rose-500 text-white border-4 border-black font-black rounded-full shadow-[0_6px_0_#000]',
    btnSuccessClass: 'btn-3d bg-emerald-400 text-black border-4 border-black font-black rounded-full shadow-[0_6px_0_#000]',
  },
};
