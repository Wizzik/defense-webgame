// A heartbeat that browsers do not throttle like main-thread timers and requestAnimationFrame: a dedicated worker
// posts a message every `ms`, and the page runs its lockstep steps from it. Hidden, minimized or covered windows
// keep stepping (Petr's net test, 2026-11-21: the guest window had crawled at about 2 steps a second).

const WORKER_SOURCE = "let id=0;onmessage=(e)=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data);};";

export interface Ticker {
  stop(): void;
}

/** Calls `onTick` about every `ms` from a worker; falls back to setInterval where workers are not allowed. */
export function startTicker(ms: number, onTick: () => void): Ticker {
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    worker.onmessage = () => onTick();
    worker.postMessage(ms);
    return { stop: () => worker.terminate() };
  } catch {
    const id = setInterval(onTick, ms);
    return { stop: () => clearInterval(id) };
  }
}
