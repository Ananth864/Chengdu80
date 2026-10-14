// Serialize safe JSON without invoking getters, toJSON methods, or inherited properties.
export function canonicalCapabilityJson(value: unknown, space?: number | string): string {
  const indent =
    typeof space === "number"
      ? " ".repeat(Math.min(10, Math.max(0, Math.trunc(space) || 0)))
      : (space ?? "").slice(0, 10);
  let nodes = 0;
  let characters = 0;
  const serialize = (current: unknown, depth: number): string => {
    if (++nodes > 100_000 || depth > 64) throw new Error("JSON exceeds structural bounds.");
    if (current === null || typeof current === "boolean") return JSON.stringify(current);
    if (typeof current === "number" && Number.isFinite(current)) return JSON.stringify(current);
    if (typeof current === "string") {
      characters += current.length;
      if (characters > 1_000_000) throw new Error("JSON exceeds character bound.");
      return JSON.stringify(current);
    }
    if (typeof current !== "object" || current === null) throw new Error("Expected safe JSON.");
    const array = Array.isArray(current);
    if (
      !array &&
      Object.getPrototypeOf(current) !== Object.prototype &&
      Object.getPrototypeOf(current) !== null
    )
      throw new Error("Expected plain JSON object.");
    const keys = Reflect.ownKeys(current).filter((key) => !(array && key === "length"));
    if (array && keys.length !== current.length) throw new Error("Expected dense JSON array.");
    const values = new Map<string, unknown>();
    for (const key of keys) {
      if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key))
        throw new Error("Unsafe JSON key.");
      if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= current.length))
        throw new Error("Invalid JSON array property.");
      const descriptor = Object.getOwnPropertyDescriptor(current, key)!;
      if (!descriptor.enumerable || !("value" in descriptor))
        throw new Error("Expected JSON data property.");
      characters += key.length;
      if (characters > 1_000_000) throw new Error("JSON exceeds character bound.");
      values.set(key, descriptor.value);
    }
    const ordered = array
      ? Array.from({ length: current.length }, (_, index) => String(index))
      : [...values.keys()].sort();
    const entries = ordered.map(
      (key) =>
        `${array ? "" : `${JSON.stringify(key)}:${indent ? " " : ""}`}${serialize(values.get(key), depth + 1)}`,
    );
    const [open, close] = array ? ["[", "]"] : ["{", "}"];
    if (!entries.length) return `${open}${close}`;
    return indent
      ? `${open}\n${indent.repeat(depth + 1)}${entries.join(`,\n${indent.repeat(depth + 1)}`)}\n${indent.repeat(depth)}${close}`
      : `${open}${entries.join(",")}${close}`;
  };
  return serialize(value, 0);
}
