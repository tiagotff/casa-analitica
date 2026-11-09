import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Vídeo das aulas no Bunny Stream.
 *
 * Proteção (configure na biblioteca do Bunny, além deste código):
 *  - Embed view token authentication: ligado (o player só abre com token deste servidor).
 *  - MP4 fallback: desligado (não existe arquivo .mp4 para baixar).
 *  - CDN token authentication na pull zone: ligado (URLs diretas só com assinatura).
 *  - Allowed referrers: só o domínio da escola.
 *  - Keep original files: ligado (o original fica disponível só para professor/admin).
 *  - Opcional: MediaCage DRM, que dificulta também a captura por extensões.
 *
 * O aluno nunca recebe o id do vídeo: o servidor confere o acesso e devolve só a URL do player.
 */

const API = "https://video.bunnycdn.com";

/** URL do player assinada e temporária. */
export function signedEmbedUrl(videoId: string, ttlSeconds = 2 * 3600): string | null {
  if (!env.bunnyLibraryId() || !env.bunnyEmbedKey()) return null;
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = createHash("sha256").update(env.bunnyEmbedKey() + videoId + expires).digest("hex");
  const params = new URLSearchParams({ token, expires: String(expires), preload: "false", responsive: "true" });
  return `https://iframe.mediadelivery.net/embed/${env.bunnyLibraryId()}/${videoId}?${params}`;
}

/** Cria o vídeo na biblioteca e devolve o GUID (usado no upload TUS). */
export async function createVideo(title: string): Promise<string> {
  const res = await fetch(`${API}/library/${env.bunnyLibraryId()}/videos`, {
    method: "POST",
    headers: { AccessKey: env.bunnyApiKey(), Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Bunny ${res.status}: não foi possível criar o vídeo`);
  const json = (await res.json()) as { guid?: string; videoId?: string };
  const id = json.guid ?? json.videoId;
  if (!id) throw new Error("Bunny não devolveu o id do vídeo");
  return id;
}

/** Credenciais de upload retomável (TUS) direto do navegador para o Bunny, sem expor a chave da API. */
export function tusUploadAuth(videoId: string, ttlSeconds = 6 * 3600) {
  const libraryId = env.bunnyLibraryId();
  const expire = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = createHash("sha256").update(`${libraryId}${env.bunnyApiKey()}${expire}${videoId}`).digest("hex");
  return { endpoint: `${API}/tusupload`, libraryId, videoId, expire, signature };
}

export async function deleteVideo(videoId: string) {
  await fetch(`${API}/library/${env.bunnyLibraryId()}/videos/${videoId}`, {
    method: "DELETE", headers: { AccessKey: env.bunnyApiKey() }, cache: "no-store",
  });
}

/**
 * URL assinada do arquivo original (CDN token authentication):
 * token = base64url(SHA256(chave + caminho + expiração)). Só para professor/admin.
 */
export function signedOriginalUrl(videoId: string, ttlSeconds = 600): string | null {
  const host = env.bunnyCdnHost();
  if (!host || !env.bunnyCdnTokenKey()) return null;
  const path = `/${videoId}/original`;
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = createHash("sha256").update(env.bunnyCdnTokenKey() + path + expires).digest("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `https://${host}${path}?token=${token}&expires=${expires}`;
}
