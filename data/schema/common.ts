import { z } from "zod";

export const Slug = z.string().regex(/^[a-z][a-z0-9-]*$/);
export const LocalizedText = z.object({ en: z.string().min(1), cs: z.string().min(1) }).strict();
