import type { messagesEn } from "./messages-en";

export const messagesCs: Record<keyof typeof messagesEn, string> = {
  "error.noGpu": "Hra potřebuje WebGPU nebo WebGL 2, ale tvůj prohlížeč nenabízí ani jedno. Zkus aktuální Chrome, Edge, Firefox nebo Safari.",
  "error.generic": "Něco se pokazilo. Načti stránku znovu.",
};
