/**
 * Arte do hero do painel de referência: linhas de onda finas em azul
 * e gráfico de barras ascendente com gradiente azul → roxo e brilho.
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

export function HeroChart() {
  const heights = [34, 52, 46, 70, 88, 104, 128, 150];
  return (
    <svg className="hero-chart" viewBox="0 0 360 220" aria-hidden="true">
      <defs>
        <linearGradient id="bar-fill" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#2563EB" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <filter id="bar-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {[50, 100, 150].map((y) => <line key={y} x1="0" x2="360" y1={y} y2={y} stroke="#FFFFFF" strokeOpacity="0.06" />)}
      <g filter="url(#bar-glow)">
        {heights.map((h, i) => <rect key={i} x={12 + i * 43} y={200 - h} width="26" height={h} rx="3" fill="url(#bar-fill)" />)}
      </g>
      <line x1="0" x2="360" y1="200.5" y2="200.5" stroke="#FFFFFF" strokeOpacity="0.15" />
    </svg>
  );
}
