import { z } from "zod";

export const SourceId = z.string().regex(/^[A-Za-z0-9]{4}$/);
export const Slug = z.string().regex(/^[a-z][a-z0-9-]*$/);
export const LocalizedText = z.object({ en: z.string().min(1), cs: z.string().min(1) });
