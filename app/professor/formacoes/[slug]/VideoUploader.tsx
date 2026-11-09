"use client";

import { useState } from "react";
import { Upload } from "tus-js-client";
import { confirmVideoUpload, startVideoUpload } from "./actions";

/** Envio de vídeo direto do navegador para o Bunny (TUS, retomável). Só aparece para professor/admin. */
export function VideoUploader({ slug, lessonId, lessonTitle, hasVideo }: { slug: string; lessonId: string; lessonTitle: string; hasVideo: boolean }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(file: File) {
    if (!file.type.startsWith("video/")) { setMsg("Escolha um arquivo de vídeo."); return; }
    setMsg(null); setProgress(0);
    try {
      const auth = await startVideoUpload(lessonId, lessonTitle);
      await new Promise<void>((resolve, reject) => {
        const up = new Upload(file, {
          endpoint: auth.endpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          headers: {
            AuthorizationSignature: auth.signature,
            AuthorizationExpire: String(auth.expire),
            VideoId: auth.videoId,
            LibraryId: String(auth.libraryId),
          },
          metadata: { filetype: file.type, title: lessonTitle },
          onProgress: (sent, total) => setProgress(Math.round((sent / total) * 100)),
          onError: reject,
          onSuccess: () => resolve(),
        });
        up.findPreviousUploads().then((prev) => { if (prev.length) up.resumeFromPreviousUpload(prev[0]); up.start(); });
      });
      await confirmVideoUpload(slug, lessonId, auth.videoId);
      setMsg("Vídeo enviado. O Bunny processa em alguns minutos.");
    } catch (e) {
      setMsg("Falha no envio: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="stack" style={{ gap: 6 }}>
      <label className="btn ghost sm" style={{ alignSelf: "flex-start", cursor: "pointer" }}>
        {hasVideo ? "Substituir vídeo" : "Enviar vídeo"}
        <input type="file" accept="video/*" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} disabled={progress !== null} />
      </label>
      {progress !== null && <div className="bar" aria-label="Progresso do envio"><i style={{ width: `${progress}%` }} /></div>}
      {msg && <span className="note">{msg}</span>}
    </div>
  );
}
