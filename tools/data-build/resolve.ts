import {
  DATA_FIELDS,
  type DataField,
  type ExportAbility,
  type ExportLevel,
  type ExportValue,
  LEVEL_FIELDS,
  type LevelField,
  type ParamSpec,
} from "./load";

/**
 * Per-level numbers of one param. A null or missing export value takes the value of the level
 * before; on level 1 it gives 0. `{ design: [...] }` values are used as written.
 */
export function resolveParam(exp: ExportAbility, spec: ParamSpec, levels: number): number[] {
  if (isDesignSpec(spec)) return [...spec.design];
  const read = levelReader(spec);
  const values: number[] = [];
  for (let i = 0; i < levels; i++) {
    const value = read(exp.per_level[i]);
    if (value === null || value === undefined) {
      values.push(i === 0 ? 0 : values[i - 1]);
    } else if (typeof value === "number") {
      values.push(value);
    } else {
      throw new Error(`${String(spec)} on level ${i + 1} is not a number: ${JSON.stringify(value)}`);
    }
  }
  return values;
}

function isDesignSpec(spec: unknown): spec is { design: number[] } {
  return typeof spec === "object" && spec !== null && Array.isArray((spec as { design?: unknown }).design);
}

const isDataField = (spec: unknown): spec is DataField => (DATA_FIELDS as readonly unknown[]).includes(spec);
const isLevelField = (spec: unknown): spec is LevelField => (LEVEL_FIELDS as readonly unknown[]).includes(spec);

function levelReader(spec: unknown): (level: ExportLevel | undefined) => ExportValue {
  if (isDataField(spec)) return (level) => level?.[spec]?.value;
  if (isLevelField(spec)) return (level) => level?.[spec];
  throw new Error(
    `unknown param source ${JSON.stringify(spec)}; ` +
      `use DataA to DataI, ${LEVEL_FIELDS.join(", ")} or { design: [...] }`,
  );
}
