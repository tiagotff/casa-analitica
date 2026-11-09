import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { formatCpf, isValidCpf, looksLikePdf, stampPdf, watermarkText } from "./watermark.ts";

const owner = { name: "Ana Ribeiro", cpf: "12345678909", email: "ana@exemplo.com", issuedAt: new Date("2027-03-15T13:00:00Z") };

test("formata e valida CPF", () => {
  assert.equal(formatCpf("12345678909"), "123.456.789-09");
  assert.ok(isValidCpf("123.456.789-09"));
  assert.ok(!isValidCpf("111.111.111-11"));
  assert.ok(!isValidCpf("123.456.789-00"));
});

test("texto da marca d'água traz nome, CPF e e-mail", () => {
  const t = watermarkText(owner);
  assert.match(t, /Ana Ribeiro/);
  assert.match(t, /123\.456\.789-09/);
  assert.match(t, /ana@exemplo\.com/);
});

test("carimba todas as páginas e mantém o PDF válido", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]);
  doc.addPage([842, 595]);
  const original = await doc.save();
  assert.ok(looksLikePdf(original));

  const stamped = await stampPdf(original, owner);
  assert.ok(looksLikePdf(stamped));
  assert.ok(stamped.length > original.length, "o arquivo carimbado recebe conteúdo novo");
  const reloaded = await PDFDocument.load(stamped);
  assert.equal(reloaded.getPageCount(), 2);
  assert.match(reloaded.getSubject() ?? "", /123\.456\.789-09/);
});

test("recusa arquivo que não é PDF", () => {
  assert.ok(!looksLikePdf(new TextEncoder().encode("MZ executável")));
});
