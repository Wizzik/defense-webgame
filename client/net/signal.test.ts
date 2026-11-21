import { describe, expect, it } from "vitest";
import { parseSignal } from "./signal";

describe("parseSignal", () => {
  it("reads host:port", () => {
    expect(parseSignal("localhost:9000")).toEqual({ host: "localhost", port: 9000, secure: false });
    expect(parseSignal("10.0.0.2:443")).toEqual({ host: "10.0.0.2", port: 443, secure: false });
  });

  it.each([null, "", "localhost", "localhost:0", "localhost:70000", "evil.com/x:80", "a:b", "http://a:1"])(
    "rejects %s", (value) => {
      expect(parseSignal(value)).toBeNull();
    },
  );
});
