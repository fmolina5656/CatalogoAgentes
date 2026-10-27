import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function Qr({ url, size = 168, label = "Ábrelo en tu celular" }: { url: string; size?: number; label?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: size * 2, color: { dark: "#04121b", light: "#f3f6fa" } }).then(setSrc);
  }, [url, size]);
  return (
    <figure className="qr">
      {src && <img src={src} width={size} height={size} alt={`Código QR para abrir ${url}`} />}
      <figcaption>{label}</figcaption>
    </figure>
  );
}
