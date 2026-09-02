export type ThemeType = 'cassino' | 'popart';

export interface ThemeStyles {
  id: ThemeType;
  name: string;
  icon: string;
  bgClass: string;
  bgInlineStyle: React.CSSProperties;
  cardClass: string;
  cardPromptClass: string;
  btnPrimaryClass: string;
  btnSuccessClass: string;
  btnDangerClass: string;
  btnSecondaryClass: string;
  topBarBadgeClass: string;
  badgeClass: string;
  headingTextClass: string;
  subheadingTextClass: string;
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
    cardClass: 'bg-white border-4 border-black rounded-3xl p-5 card-shadow text-black',
    cardPromptClass: 'bg-white border-4 border-black rounded-3xl p-6 card-shadow-lg text-black rotate-[-0.5deg]',
    btnPrimaryClass: 'btn-3d bg-amber-400 text-black border-4 border-black hover:bg-amber-300 font-black rounded-2xl',
    btnSuccessClass: 'btn-3d bg-emerald-500 text-white border-4 border-black hover:bg-emerald-400 font-black rounded-2xl',
    btnDangerClass: 'btn-3d bg-red-500 text-white border-4 border-black hover:bg-red-400 font-black rounded-2xl',
    btnSecondaryClass: 'btn-3d bg-white/20 text-white border-3 border-white/50 hover:bg-white/30 font-black rounded-2xl',
    topBarBadgeClass: 'bg-black/60 border-2 border-white/30 text-white font-black text-xs px-3 py-1 rounded-full',
    badgeClass: 'bg-black text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-widest',
    headingTextClass: 'text-white text-comic font-black',
    subheadingTextClass: 'text-amber-300 font-bold',
  },
  popart: {
    id: 'popart',
    name: 'Pop Art Comic',
    icon: '⚡',
    bgClass: 'popart-bg text-slate-900',
    bgInlineStyle: {
      backgroundColor: '#FFE600',
      backgroundImage: `radial-gradient(#F59E0B 12%, transparent 12%), radial-gradient(#F59E0B 12%, transparent 12%)`,
      backgroundPosition: '0 0, 15px 15px',
      backgroundSize: '30px 30px',
    },
    cardClass: 'bg-white border-4 border-black rounded-[2rem] p-5 card-shadow text-black relative shadow-[0_8px_0_#000]',
    cardPromptClass: 'bg-white border-4 border-black rounded-[2.5rem] p-6 card-shadow-lg text-black rotate-[-1deg] shadow-[0_10px_0_#000]',
    btnPrimaryClass: 'btn-3d bg-blue-600 text-white border-4 border-black hover:bg-blue-500 font-black rounded-full shadow-[0_6px_0_#000]',
    btnSuccessClass: 'btn-3d bg-emerald-400 text-black border-4 border-black hover:bg-emerald-300 font-black rounded-full shadow-[0_6px_0_#000]',
    btnDangerClass: 'btn-3d bg-rose-500 text-white border-4 border-black hover:bg-rose-400 font-black rounded-full shadow-[0_6px_0_#000]',
    btnSecondaryClass: 'btn-3d bg-white text-black border-4 border-black hover:bg-slate-100 font-black rounded-full shadow-[0_6px_0_#000]',
    topBarBadgeClass: 'bg-white border-3 border-black text-black font-black text-xs px-3 py-1 rounded-full shadow-[0_3px_0_#000]',
    badgeClass: 'bg-blue-600 text-white text-[11px] font-black uppercase px-3 py-1 rounded-full tracking-wider border-2 border-black',
    headingTextClass: 'text-slate-900 text-comic font-black',
    subheadingTextClass: 'text-blue-900 font-black',
  },
};
