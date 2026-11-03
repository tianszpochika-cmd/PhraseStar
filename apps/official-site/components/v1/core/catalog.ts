/** Static learning directions are editorial introductions, not published courses. */
export const directions = [
  { id: "daily-words", key: "words", group: "words", tone: "lilac", goal: "wordMemory" },
  { id: "clear-grammar", key: "grammar", group: "words", tone: "sage", goal: "sentence" },
  { id: "listening", key: "listening", group: "understand", tone: "apricot", goal: "listening" },
  { id: "reading", key: "reading", group: "understand", tone: "blue", goal: "reading" },
  { id: "speaking", key: "speaking", group: "express", tone: "lilac", goal: "speaking" },
  { id: "writing", key: "writing", group: "express", tone: "sage", goal: "writing" },
] as const;

export type Direction = (typeof directions)[number];
export type DirectionGroup = "all" | Direction["group"];

export function directionTextKey(direction: Direction, field: string) {
  return `official.v1.core.directions.${direction.key}.${field}`;
}
