import { expect, test as base } from "@playwright/test";

/**
 * `test` with an automatic fixture: console errors and page errors fail the test that caused them.
 * A test that breaks something on purpose lists the errors it expects in `allowedConsoleErrors`
 * (patterns matched against the message text and the URL of the resource it names).
 */
export const test = base.extend<{ consoleErrors: string[]; allowedConsoleErrors: RegExp[] }>({
  allowedConsoleErrors: [[], { option: true }],
  consoleErrors: [
    async ({ page, allowedConsoleErrors }, use) => {
      const errors: string[] = [];
      const record = (text: string, url = ""): void => {
        if (!allowedConsoleErrors.some((pattern) => pattern.test(`${text} ${url}`))) errors.push(text);
      };
      page.on("console", (msg) => {
        if (msg.type() === "error") record(msg.text(), msg.location().url);
      });
      page.on("pageerror", (err) => record(err.message));
      await use(errors);
      expect(errors, "console and page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
