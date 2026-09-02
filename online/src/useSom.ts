import { useCallback, useEffect, useRef } from 'react';
import { carregarSons } from './content';

// Hook central de som: carrega o mapa evento->url uma vez, e expõe tocar(evento).
// Se não houver som cadastrado pro evento, simplesmente não toca nada (sem erro).
export function useSom() {
  const mapaRef = useRef<Record<string, string>>({});
  const cacheAudioRef = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    carregarSons().then((mapa) => { mapaRef.current = mapa; });
  }, []);

  const tocar = useCallback((evento: string) => {
    const url = mapaRef.current[evento];
    if (!url) return;
    let audio = cacheAudioRef.current[evento];
    if (!audio) {
      audio = new Audio(url);
      cacheAudioRef.current[evento] = audio;
    }
    audio.currentTime = 0;
    audio.play().catch(() => { /* autoplay bloqueado até o 1º toque na tela — ignora */ });
  }, []);

  return { tocar };
}
