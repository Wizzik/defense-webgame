import { AudioDataSchema, type AudioData } from "../../data/schema/audio";

export interface AudioGame {
  abilities: readonly { id: string; kind: string }[];
  heroes: readonly { id: string }[];
  enemies: readonly { id: string }[];
}

/** Parses audio data and checks coverage, cue references and files; throws one line per problem. */
export function validateAudio(raw: unknown, game: AudioGame, fileExists: (path: string) => boolean): AudioData {
  const parsed = AudioDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n"));
  }
  const data = parsed.data;
  const errors: string[] = [];
  const cueIds = new Set<string>();
  for (const cue of data.cues) {
    if (cueIds.has(cue.id)) errors.push(`duplicate cue ${cue.id}`);
    cueIds.add(cue.id);
    for (const file of cue.files) if (!fileExists(file)) errors.push(`cue ${cue.id}: missing file ${file}`);
  }
  const trackIds = new Set<string>();
  for (const track of data.tracks) {
    if (trackIds.has(track.id)) errors.push(`duplicate track ${track.id}`);
    trackIds.add(track.id);
    if (!fileExists(track.file)) errors.push(`track ${track.id}: missing file ${track.file}`);
  }
  const ref = (where: string, id: string | undefined, allowNone = false) => {
    if (id === undefined || (allowNone && id === "none")) return;
    if (!cueIds.has(id)) errors.push(`${where}: unknown cue ${id}`);
  };

  const abilityIds = new Set(game.abilities.map((a) => a.id));
  for (const a of game.abilities) {
    const entry = data.abilities[a.id];
    if (!entry) {
      errors.push(`ability ${a.id}: no sound (passives: cast none)`);
      continue;
    }
    if (a.kind === "passive" && (entry.cast !== "none" || entry.hit !== undefined)) {
      errors.push(`passive ${a.id}: must be cast none without hit`);
      continue;
    }
    ref(`ability ${a.id}.cast`, entry.cast, true);
    ref(`ability ${a.id}.hit`, entry.hit);
  }
  for (const id of Object.keys(data.abilities)) if (!abilityIds.has(id)) errors.push(`unknown ability ${id}`);

  const heroIds = new Set(game.heroes.map((h) => h.id));
  for (const h of game.heroes) {
    const entry = data.heroes[h.id];
    if (!entry) errors.push(`hero ${h.id}: no sound`);
    else {
      ref(`hero ${h.id}.attack`, entry.attack);
      ref(`hero ${h.id}.attackHit`, entry.attackHit);
    }
  }
  for (const id of Object.keys(data.heroes)) if (!heroIds.has(id)) errors.push(`unknown hero ${id}`);

  const enemyIds = new Set(game.enemies.map((e) => e.id));
  for (const e of game.enemies) {
    const entry = data.enemies[e.id];
    if (!entry) errors.push(`enemy ${e.id}: no sound`);
    else {
      ref(`enemy ${e.id}.death`, entry.death);
      ref(`enemy ${e.id}.attack`, entry.attack);
    }
  }
  for (const id of Object.keys(data.enemies)) if (!enemyIds.has(id)) errors.push(`unknown enemy ${id}`);

  for (const [sound, id] of Object.entries(data.sounds)) ref(`sound ${sound}`, id);

  if (data.music) {
    const { run, ...single } = data.music;
    for (const [slot, id] of [...Object.entries(single), ...run.map((id, i) => [`run.${i}`, id] as const)]) {
      if (!trackIds.has(id)) errors.push(`music ${slot}: unknown track ${id}`);
    }
  }

  if (errors.length > 0) throw new Error(errors.join("\n"));
  return data;
}
