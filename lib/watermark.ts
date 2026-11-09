import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

export type WatermarkOwner = { name: string; cpf: string; email: string; issuedAt: Date };

/** 12345678909 → 123.456.789-09 */
export function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf;
}

/** Validação dos dígitos verificadores do CPF. */
export function isValidCpf(value: string): boolean {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

export function watermarkText(o: WatermarkOwner): string {
  const date = o.issuedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `Licenciado para ${o.name} · CPF ${formatCpf(o.cpf)} · ${o.email} · ${date}`;
}

/** Verifica a assinatura de arquivo PDF (%PDF-). */
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

/**
 * Carimba cada página com:
 *  - marca d'água diagonal, translúcida, com nome e CPF (repetida para não sumir num recorte);
 *  - rodapé legível com nome, CPF, e-mail e data/hora do download.
 * Também grava o licenciado nos metadados do arquivo.
 */
export async function stampPdf(input: Uint8Array, owner: WatermarkOwner): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(input, { ignoreEncryption: false });
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const footerFont = await pdf.embedFont(StandardFonts.Helvetica);
  const diagonal = `${owner.name} · CPF ${formatCpf(owner.cpf)}`;
  const footer = watermarkText(owner);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    // Fonte dimensionada para a diagonal caber na página (70% da largura, girada 30°).
    const angle = Math.PI / 6;
    const size = Math.min(26, (width * 0.7) / Math.cos(angle) / (font.widthOfTextAtSize(diagonal, 1) || 1));
    const textWidth = font.widthOfTextAtSize(diagonal, size);
    for (const yFactor of [0.22, 0.5, 0.78]) {
      page.drawText(diagonal, {
        x: width / 2 - (textWidth / 2) * Math.cos(angle),
        y: height * yFactor - (textWidth / 2) * Math.sin(angle),
        size, font, color: rgb(0.043, 0.122, 0.231), opacity: 0.1, rotate: degrees(30),
      });
    }
    const fSize = 7;
    page.drawRectangle({ x: 0, y: 0, width, height: 16, color: rgb(1, 1, 1), opacity: 0.85 });
    page.drawText(footer, { x: 12, y: 5, size: fSize, font: footerFont, color: rgb(0.33, 0.38, 0.48), maxWidth: width - 24 });
  }
  pdf.setAuthor("Casa Analítica");
  pdf.setSubject(footer);
  pdf.setKeywords([`licenciado:${owner.cpf}`]);
  return pdf.save();
}
