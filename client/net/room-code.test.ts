import { describe, expect, it } from "vitest";
import { isRoomCode, newRoomCode, ROOM_ALPHABET } from "./room-code";

describe("room codes", () => {
  it("are dwg- and six characters of the alphabet", () => {
    let x = 0;
    const random = () => (x = (x + 0.137) % 1);
    for (let i = 0; i < 50; i++) {
      const code = newRoomCode(random);
      expect(code).toMatch(/^dwg-[a-z2-9]{6}$/);
      for (const ch of code.slice(4)) expect(ROOM_ALPHABET).toContain(ch);
      expect(isRoomCode(code)).toBe(true);
    }
  });

  it("leave out characters that look alike", () => {
    for (const ch of "ilo01") expect(ROOM_ALPHABET).not.toContain(ch);
  });

  it("use the last character when random() is just under 1", () => {
    expect(newRoomCode(() => 0.999999)).toBe(`dwg-${"9".repeat(6)}`);
  });

  it.each(["dwg-ABC123", "dwg-12345", "xyz-abcdef", "dwg-abcdefg", "dwg-abcde1", ""])("rejects %s", (s) => {
    expect(isRoomCode(s)).toBe(false);
  });
});
