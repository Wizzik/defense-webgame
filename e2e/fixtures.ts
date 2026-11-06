import { expect, test as base } from "@playwright/test";

/** `test` with an automatic fixture: console errors and page errors fail the test that caused them. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));
      await use(errors);
      expect(errors, "console and page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
