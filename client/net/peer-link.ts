// A thin PeerJS wrapper (spec 2026-11-20, 5.4; up to three guests since 2026-11-24): a host's room and the guests'
// links to it, ordered JSON messages through PeerJS's free cloud signalling. Every received message passes decodeMessage; a bad one is counted and dropped.
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

/** One data connection as a link; `onFinish` runs once when it closes or fails (a guest destroys his Peer there). */
function wrap(peer: Peer, conn: DataConnection, onFinish: () => void): PeerLink {
  let messageCb: (m: NetMessage) => void = () => {};
  let closeCb: (reason: string) => void = () => {};
  let closed = false;
  const state = { rejected: 0 };
  const finish = (reason: string): void => {
    if (closed) return;
    closed = true;
    closeCb(reason);
    onFinish();
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
      // let "bye" leave before the channel goes
      setTimeout(() => {
        conn.close();
        onFinish();
      }, 200);
    },
    get rejected() {
      return state.rejected;
    },
  };
}

/** A host's open room. */
export interface Room {
  /** Turns away every later guest (the run started). */
  lock(): void;
  /** Closes the room and every guest link. */
  close(): void;
}

/**
 * Opens room `code`; resolves once the code is registered. Every guest whose data channel opens is given to
 * `onGuest`; one over `maxGuests` open links, or after `lock()`, is closed at once. A guest link that closes does not
 * close the room.
 */
export function openRoom(
  code: string, signal: SignalServer | null, onGuest: (link: PeerLink) => void, maxGuests = 3,
): Promise<Room> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(code, peerOptions(signal));
    let open = false;
    let locked = false;
    let guests = 0;
    peer.on("disconnected", () => {
      // losing the signalling server does not break open data channels; nothing to do
    });
    peer.on("error", (err) => {
      if (!open) {
        peer.destroy();
        reject(new Error(readable(err)));
      }
    });
    peer.on("open", () => {
      open = true;
      resolve({
        lock() {
          locked = true;
        },
        close() {
          locked = true;
          setTimeout(() => peer.destroy(), 300);
        },
      });
    });
    peer.on("connection", (conn) => {
      conn.on("open", () => {
        if (locked || guests >= maxGuests) {
          conn.close();
          return;
        }
        guests++;
        let counted = true;
        onGuest(wrap(peer, conn, () => {
          if (counted) guests--;
          counted = false;
        }));
      });
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
        resolve(wrap(peer, conn, () => peer.destroy()));
      });
    });
  });
}
