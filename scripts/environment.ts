import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const platformRoot = fileURLToPath(new URL("..", import.meta.url).href);
export function configuredEnvironment() {
  const values = { ...process.env };
  for (const file of [
    resolve(platformRoot, "apps/web/.env"),
    resolve(platformRoot, ".env"),
    resolve(platformRoot, "../.env"),
  ]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match?.[1] && match[2]) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  return values;
}
