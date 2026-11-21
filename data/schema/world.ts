import { z } from "zod";
import { LocalizedText, Slug } from "./common";

/** One world of the ladder (design/worlds.yaml); its place in the list is its number, 1-based. */
export const WorldSchema = z.object({
  id: Slug,
  name: LocalizedText,
  /** One sentence shown under the world's card. */
  blurb: LocalizedText,
  /** Card colour, a lowercase hex. */
  color: z.string().regex(/^#[0-9a-f]{6}$/, "expected a lowercase hex colour like #1f3a44"),
  /** False: playable with the look of world 1 and marked "coming soon". */
  ready: z.boolean(),
}).strict();
export type World = z.infer<typeof WorldSchema>;
