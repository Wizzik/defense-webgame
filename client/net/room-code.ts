// Room codes of the net spike: "dwg-" and six characters without look-alikes (no i, l, o, 0, 1).
export const ROOM_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const LENGTH = 6;
const PATTERN = new RegExp(`^dwg-[${ROOM_ALPHABET}]{${LENGTH}}$`);

export function newRoomCode(random: () => number): string {
  let code = "dwg-";
  for (let i = 0; i < LENGTH; i++) code += ROOM_ALPHABET[Math.floor(random() * ROOM_ALPHABET.length)];
  return code;
}

export function isRoomCode(s: string): boolean {
  return PATTERN.test(s);
}
