// The signalling server of the net spike: the PeerJS cloud by default, or "host:port" from `?signal=` (local tests).
export interface SignalServer {
  host: string;
  port: number;
  secure: boolean;
}

/** Reads "host:port"; null when it does not parse (then the PeerJS cloud is used). */
export function parseSignal(value: string | null): SignalServer | null {
  const m = value === null ? null : /^([a-z0-9.-]+):(\d{1,5})$/i.exec(value);
  if (m === null) return null;
  const port = Number(m[2]);
  return port > 0 && port < 65536 ? { host: m[1]!, port, secure: false } : null;
}
