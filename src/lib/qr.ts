import QRCode from "qrcode";

/** Rend une URI otpauth en SVG (encodeur pur, pas d'I/O). */
export function qrSvgFromUri(uri: string): Promise<string> {
  return QRCode.toString(uri, { type: "svg", margin: 1 });
}
