import { describe, expect, it } from "vitest";
import { NO_INPUT, type TickInput } from "../../sim";
import { Keyboard } from "./keyboard";

function setup() {
  const target = new EventTarget();
  const keyboard = new Keyboard(target);
  const press = (code: string) => target.dispatchEvent(Object.assign(new Event("keydown"), { code }));
  const release = (code: string) => target.dispatchEvent(Object.assign(new Event("keyup"), { code }));
  const read = (): TickInput => {
    const input: TickInput = { ...NO_INPUT };
    keyboard.read(input);
    return input;
  };
  return { target, keyboard, press, release, read };
}

describe("Keyboard", () => {
  it("opposite keys cancel", () => {
    const { press, read } = setup();
    press("KeyA");
    press("KeyD");
    press("KeyW");
    press("KeyS");
    expect(read()).toMatchObject({ moveX: 0, moveY: 0 });
  });

  it("blur releases keys", () => {
    const { target, press, read } = setup();
    press("KeyD");
    press("KeyW");
    expect(read()).toMatchObject({ moveX: 1, moveY: 1 });
    target.dispatchEvent(new Event("blur"));
    expect(read()).toMatchObject({ moveX: 0, moveY: 0 });
  });

  it("arrows work like WASD", () => {
    const { press, release, read } = setup();
    press("ArrowLeft");
    press("ArrowUp");
    expect(read()).toMatchObject({ moveX: -1, moveY: 1 });
    release("ArrowLeft");
    release("ArrowUp");
    press("ArrowRight");
    press("ArrowDown");
    expect(read()).toMatchObject({ moveX: 1, moveY: -1 });
  });

  it("leaves the card alone", () => {
    const { press, keyboard } = setup();
    press("KeyW");
    const input: TickInput = { moveX: 0, moveY: 0, card: 2 };
    keyboard.read(input);
    expect(input.card).toBe(2);
  });
});
