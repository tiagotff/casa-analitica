/**
 * Arte do hero do painel de referência: linhas de onda finas em azul e roxo.
 */
const waves = Array.from({ length: 18 }, (_, i) => {
  const o = i * 7;
  return `M-20 ${250 + o} C 160 ${170 + o}, 300 ${330 + o}, 480 ${220 + o} S 760 ${120 + o}, 900 ${200 + o}`;
});

export function HeroWaves() {
  return (
    <svg className="hero-waves" viewBox="0 0 880 440" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="wave-stroke" x1="0" x2="1">
          <stop offset="0" stopColor="#2563EB" stopOpacity="0" />
          <stop offset="0.45" stopColor="#3B82F6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#7C3AED" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {waves.map((d, i) => <path key={i} d={d} fill="none" stroke="url(#wave-stroke)" strokeWidth="0.8" />)}
    </svg>
  );
}
