import { describe, expect, it } from "vitest";
import { InputAction, NO_INPUT, type TickInput } from "../../sim";
import { Keyboard } from "./keyboard";

function setup() {
  const target = new EventTarget();
  const keyboard = new Keyboard(target);
  const press = (code: string, extra: object = {}) =>
    target.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { code }, extra));
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
    const input: TickInput = { moveX: 0, moveY: 0, card: 2, actions: 0 };
    keyboard.read(input);
    expect(input.card).toBe(2);
  });

  it("R, T and Space become actions once per press", () => {
    const { press, read } = setup();
    press("KeyR");
    press("KeyT");
    press("Space");
    expect(read().actions).toBe(InputAction.Ultimate | InputAction.ToggleAuto | InputAction.Dash);
    expect(read().actions).toBe(0);
  });

  it("a held key does not repeat its action", () => {
    const { press, read } = setup();
    press("Space");
    read();
    press("Space", { repeat: true });
    expect(read().actions).toBe(0);
  });

  it("blur clears pending actions", () => {
    const { target, press, read } = setup();
    press("KeyR");
    target.dispatchEvent(new Event("blur"));
    expect(read().actions).toBe(0);
  });

  it("ignores keys on buttons", () => {
    const { target, read } = setup();
    for (const tagName of ["BUTTON", "INPUT"]) {
      const event = Object.assign(new Event("keydown", { cancelable: true }), { code: "Space" });
      Object.defineProperty(event, "target", { value: { tagName } });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(read().actions).toBe(0);
  });

  it("prevents the default of Space and the action keys", () => {
    const { target } = setup();
    const event = Object.assign(new Event("keydown", { cancelable: true }), { code: "Space" });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
