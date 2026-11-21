// A thin PeerJS wrapper for the net spike (spec 2026-11-20, 5.4): one host, one guest, ordered JSON messages
// through PeerJS's free cloud signalling. Every received message passes decodeMessage; a bad one is counted and dropped.
import Peer, { type DataConnection, type PeerOptions } from "peerjs";
import { decodeMessage, type NetMessage } from "./protocol";
import type { SignalServer } from "./signal";

export interface PeerLink {
  send(m: NetMessage): void;
  onMessage(cb: (m: NetMessage) => void): void;
  onClose(cb: (reason: string) => void): void;
  close(): void;
  /** Messages dropped because they were malformed or unknown. */
  readonly rejected: number;
}

function peerOptions(signal: SignalServer | null): PeerOptions {
  return signal === null ? {} : { host: signal.host, port: signal.port, secure: signal.secure, path: "/" };
}

const CONNECT_OPTIONS = { reliable: true, serialization: "json" } as const;

function readable(err: unknown): string {
  const type = (err as { type?: string } | null)?.type;
  if (type === "unavailable-id") return "This room code is taken; host again for a new one.";
  if (type === "peer-unavailable") return "No room with this code (the host may have left).";
  if (type === "network" || type === "server-error" || type === "socket-error") {
    return "Cannot reach the PeerJS signalling server.";
  }
  if (type === "browser-incompatible") return "This browser does not support WebRTC data channels.";
  return err instanceof Error ? err.message : String(err);
}

function wrap(peer: Peer, conn: DataConnection): PeerLink {
  let messageCb: (m: NetMessage) => void = () => {};
  let closeCb: (reason: string) => void = () => {};
  let closed = false;
  const state = { rejected: 0 };
  const finish = (reason: string): void => {
    if (closed) return;
    closed = true;
    closeCb(reason);
    peer.destroy();
  };
  conn.on("data", (data) => {
    const m = decodeMessage(data);
    if (m === null) {
      state.rejected++;
      return;
    }
    messageCb(m);
  });
  conn.on("close", () => finish("the connection closed"));
  conn.on("error", (err) => finish(readable(err)));
  peer.on("disconnected", () => {
    // losing the signalling server does not break an open data channel; nothing to do
  });
  peer.on("error", (err) => finish(readable(err)));
  return {
    send(m) {
      if (!closed && conn.open) conn.send(m);
    },
    onMessage(cb) {
      messageCb = cb;
    },
    onClose(cb) {
      closeCb = cb;
    },
    close() {
      if (closed) return;
      if (conn.open) conn.send({ t: "bye" } satisfies NetMessage);
      closed = true;
      setTimeout(() => peer.destroy(), 200);
    },
    get rejected() {
      return state.rejected;
    },
  };
}

/** Opens room `code` and resolves with the first guest; later guests are turned away. */
export function hostRoom(code: string, signal: SignalServer | null = null): Promise<PeerLink> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(code, peerOptions(signal));
    let taken = false;
    peer.on("error", (err) => {
      if (!taken) {
        peer.destroy();
        reject(new Error(readable(err)));
      }
    });
    peer.on("connection", (conn) => {
      if (taken) {
        conn.on("open", () => conn.close());
        return;
      }
      taken = true;
      conn.on("open", () => resolve(wrap(peer, conn)));
    });
  });
}

/** Joins room `code`. */
export function joinRoom(code: string, signal: SignalServer | null = null): Promise<PeerLink> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerOptions(signal));
    let open = false;
    peer.on("error", (err) => {
      if (!open) {
        peer.destroy();
        reject(new Error(readable(err)));
      }
    });
    peer.on("open", () => {
      const conn = peer.connect(code, CONNECT_OPTIONS);
      conn.on("open", () => {
        open = true;
        resolve(wrap(peer, conn));
      });
    });
  });
}
