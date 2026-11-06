/** Creates an element with a class and optional text, and appends it to `parent`. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  parent?.appendChild(node);
  return node;
}

/** Writes only when the text changed, so a per-frame update does not touch the DOM needlessly. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
