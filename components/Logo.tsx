/**
 * Marca Casa Analítica: símbolo oficial (public/brand) + nome em Montserrat.
 * O símbolo é PNG com fundo transparente; o nome fica como texto para sair nítido em qualquer tamanho.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  const src = size > 128 ? "/brand/simbolo-512.png" : size > 48 ? "/brand/simbolo-256.png" : "/brand/simbolo-96.png";
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="" aria-hidden="true" style={{ display: "block" }} />;
}

/** Logo compacto (cabeçalho, menu lateral). */
export function Brand({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <>
      <LogoMark size={40} />
      <span className="wordmark" style={{ color: tone === "light" ? "#FFFFFF" : "var(--deep)" }}>
        <b>Casa</b><b>Analítica</b>
      </span>
    </>
  );
}

/** Assinatura completa com divisor e tagline (hero, materiais). */
export function BrandLockup() {
  return (
    <div className="lockup">
      <div className="lockup-row">
        <LogoMark size={120} />
        <span className="lockup-divider" aria-hidden="true" />
        <span className="lockup-name"><b>Casa</b><b>Analítica</b></span>
      </div>
      <span className="lockup-tagline">Formação em dados e negócios</span>
    </div>
  );
}
