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
    <div className="fixed inset-0 z-[60] overflow-hidden bg-black">
      <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />

      {/* En-tête superposé */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 pb-8 pt-3 text-white">
        <button onClick={onClose} aria-label="Fermer" className="rounded-full p-2 hover:bg-white/10"><Icon name="back" size={22} /></button>
        <span className="font-semibold">Scanner un livre</span>
      </div>

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
          <Icon name="camera" size={40} />
          <p className="max-w-xs">{error}</p>
          <button onClick={onClose} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">Utiliser la recherche</button>
        </div>
      ) : (
        <>
          {/* Fenêtre de visée : cutout transparent, le reste assombri (style scan KYC) */}
          <div className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2">
            <div className="relative h-44 w-[min(86vw,22rem)] rounded-2xl shadow-[0_0_0_100vmax_rgba(0,0,0,0.62)]">
              <span className="absolute -left-px -top-px h-8 w-8 rounded-tl-2xl border-l-[3px] border-t-[3px] border-white" />
              <span className="absolute -right-px -top-px h-8 w-8 rounded-tr-2xl border-r-[3px] border-t-[3px] border-white" />
              <span className="absolute -bottom-px -left-px h-8 w-8 rounded-bl-2xl border-b-[3px] border-l-[3px] border-white" />
              <span className="absolute -bottom-px -right-px h-8 w-8 rounded-br-2xl border-b-[3px] border-r-[3px] border-white" />
              <span className="absolute inset-x-5 top-1/2 h-0.5 -translate-y-1/2 animate-pulse rounded-full bg-[var(--color-accent)]" />
            </div>
          </div>

          <p className="absolute inset-x-0 bottom-10 z-10 px-8 text-center text-sm text-white/85">
            Centre le code-barres au dos du livre dans le cadre.
          </p>
        </>
      )}
    </div>
  );
}
