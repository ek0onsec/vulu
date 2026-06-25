"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

/** Overlay caméra : lit un EAN-13 (ISBN) et appelle onIsbn. ZXing chargé en lazy. */
export function BookScanner({ onIsbn, onClose }: { onIsbn: (isbn: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onIsbnRef = useRef(onIsbn);
  onIsbnRef.current = onIsbn;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
        const reader = new BrowserMultiFormatReader(hints);
        if (cancelled || !videoRef.current) return;
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _err, ctrl) => {
          if (!result) return;
          const text = result.getText();
          if (/^(978|979)\d{10}$/.test(text)) {
            ctrl.stop();
            onIsbnRef.current(text);
          }
        });
      } catch (e) {
        const name = (e as { name?: string })?.name;
        setError(
          name === "NotAllowedError" ? "Accès à la caméra refusé."
            : name === "NotFoundError" ? "Aucune caméra détectée."
              : "Impossible d'ouvrir la caméra.",
        );
      }
    })();
    return () => { cancelled = true; controls?.stop(); };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="flex items-center justify-between px-3 py-2 text-white">
        <span className="font-semibold">Scanner un livre</span>
        <button onClick={onClose} aria-label="Fermer" className="rounded-full p-2 hover:bg-white/10"><Icon name="back" size={22} /></button>
      </div>
      <div className="relative flex-1">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        {!error && <div className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-64 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-white/80" />}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <p>{error}</p>
            <button onClick={onClose} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">Utiliser la recherche</button>
          </div>
        )}
      </div>
      {!error && <p className="px-4 py-3 text-center text-sm text-white/70">Vise le code-barres au dos du livre.</p>}
    </div>
  );
}
