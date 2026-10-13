import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { platformRoot } from "./environment";

const destination = resolve(platformRoot, "../.env");
const example = readFileSync(resolve(platformRoot, "../.env.example"), "utf8");
const content = example
  .replace(
    /^WORKOS_COOKIE_PASSWORD=$/m,
    `WORKOS_COOKIE_PASSWORD=${randomBytes(32).toString("base64")}`,
  )
  .replace(/^PLATFORM_INTERNAL_KEY=$/m, `PLATFORM_INTERNAL_KEY=${randomBytes(32).toString("hex")}`);
try {
  writeFileSync(destination, content, { flag: "wx", mode: 0o600 });
  console.log(
    "Created workspace .env with two local secrets. Add provider credentials there. No secret values were printed.",
  );
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  console.log("Workspace .env already exists; left its contents unchanged.");
}
