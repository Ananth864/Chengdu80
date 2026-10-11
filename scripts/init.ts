// One-shot starter setup: `bun run init` asks for one option per group, or pass the
// options directly (`bun run init convex clerk ai`, `bun run init core` for none).
// Unpicked options are deleted from disk, package.json files, env examples, and docs.
// The script deletes itself when it finishes.
//
// Shared files mark option code with line comments:
//   // @if convex workos   kept only when every listed term holds
//   // @if auth|ai         `|` means any; group names (backend, auth) mean any option in it
//   // @if convex !auth    `!` negates
//   // @endif
// `{/* */}`, `<!-- -->`, and `#` comment styles work too. Files left empty are deleted.
//
// The template is a working app for the default pick (the first option in each group).
// Code for any other pick is commented out with `//` or `#`, and gets uncommented when kept.
// Markdown is never commented: docs describe every option until init runs.
// `@if template` blocks describe this script and are always removed.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { createInterface } from "node:readline/promises";

import { groups, isOption, optionNames, options, type Option, type OptionName } from "./options";

const root = join(import.meta.dirname, "..");
async function pickOptions(args: string[]): Promise<Set<OptionName>> {
  if (args.length > 0) {
    const unknown = args.filter((arg) => arg !== "core" && !isOption(arg));
    if (unknown.length > 0) {
      throw new Error(
        `Unknown option: ${unknown.join(", ")}. Choose from: ${optionNames.join(", ")}, core`,
      );
    }
    const picked = args.filter(isOption);
    for (const group of groups) {
      const clash = picked.filter((name) => options[name].group === group);
      if (clash.length > 1) throw new Error(`Pick one ${group} option, got: ${clash.join(", ")}`);
    }
    return new Set(picked);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const picked = new Set<OptionName>();
  for (const group of groups) {
    const names = optionNames.filter((name) => options[name].group === group);
    const list = [...names.map((name) => `${name} (${options[name].label})`), "none"].join(" / ");
    let answer = "";
    let choice: OptionName | undefined;
    while (answer !== "none" && !choice) {
      answer =
        (await rl.question(`${group}: ${list} [${names[0]}] `)).trim() || (names[0] ?? "none");
      choice = names.find((name) => name === answer);
    }
    if (choice) picked.add(choice);
  }
  const dropped = optionNames.filter((name) => !picked.has(name));
  const confirmed =
    dropped.length === 0 ||
    /^y/i.test((await rl.question(`Delete ${dropped.join(", ")} from this repo? (y/N) `)).trim());
  rl.close();
  if (!confirmed) process.exit(1);
  return picked;
}

// Marker conditions can name a group to mean any option in it, e.g. `@if auth`.
function withGroups(picked: Iterable<OptionName>): ReadonlySet<string> {
  const names = [...picked];
  return new Set([...names, ...names.map((name) => options[name].group)]);
}

const defaults = withGroups(
  groups.flatMap((group) => optionNames.find((name) => options[name].group === group) ?? []),
);

const markerPattern = /^\s*(?:\/\/|#|\{\/\*|<!--)\s*@(if|endif)\b(.*)$/;

// Evaluates `@if` conditions: every space-separated term must hold.
// A term is `name`, `!name`, or alternatives like `workos|clerk`.
function holds(condition: string, picked: ReadonlySet<string>) {
  const terms = condition.match(/[!a-z|]+/g) ?? [];
  return terms.every((term) =>
    term.startsWith("!")
      ? !picked.has(term.slice(1))
      : term.split("|").some((name) => picked.has(name)),
  );
}

function applyMarkers(source: string, picked: ReadonlySet<string>, uncomment: boolean) {
  const output: string[] = [];
  // Each open block records whether it is kept and whether its lines are commented out.
  const stack: { keep: boolean; commented: boolean }[] = [];

  for (const line of source.split("\n")) {
    const marker = line.match(markerPattern);
    if (marker?.[1] === "if") {
      const condition = marker[2] ?? "";
      stack.push({ keep: holds(condition, picked), commented: !holds(condition, defaults) });
      continue;
    }
    if (marker?.[1] === "endif") {
      stack.pop();
      continue;
    }
    if (!stack.every((block) => block.keep)) continue;
    const commented = uncomment && stack.some((block) => block.commented);
    output.push(commented ? line.replace(/^(\s*)(?:\/\/|#) ?/, "$1") : line);
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n");
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
    .filter((path) => !/(^|\/)(node_modules|\.git|dist|\.alchemy|_generated)\//.test(path));
}

type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: { catalog?: Record<string, string> };
};

function editJson(path: string, edit: (json: PackageJson) => void) {
  const file = join(root, path);
  const json: PackageJson = JSON.parse(readFileSync(file, "utf8"));
  edit(json);
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
}

const picked = await pickOptions(process.argv.slice(2));
const active = withGroups(picked);

for (const name of optionNames.filter((name) => !picked.has(name))) {
  const option: Option = options[name];
  for (const path of option.paths) rmSync(join(root, path), { recursive: true, force: true });
  for (const [path, deps] of Object.entries(option.deps)) {
    if (!existsSync(join(root, path))) continue;
    editJson(path, (json) => {
      for (const dep of deps) {
        delete json.dependencies?.[dep];
        delete json.devDependencies?.[dep];
      }
    });
  }
  editJson("package.json", (json) => {
    for (const dep of option.catalog) delete json.workspaces?.catalog?.[dep];
    for (const script of option.scripts) delete json.scripts?.[script];
  });
}

rmSync(join(root, "scripts"), { recursive: true, force: true });
editJson("package.json", (json) => {
  delete json.scripts?.init;
});

for (const path of listFiles(root)) {
  const file = join(root, path);
  const source = readFileSync(file, "utf8");
  if (!source.includes("@if ")) continue;
  const result = applyMarkers(source, active, !path.endsWith(".md"));
  if (result.trim() === "") rmSync(file);
  else writeFileSync(file, result);
}

// Deleting option files can leave folders like `routes/api` empty; deepest first.
for (const dir of readdirSync(root, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(entry.parentPath, entry.name))
  .filter((dir) => !/(^|\/)(node_modules|\.git)(\/|$)/.test(relative(root, dir)))
  .sort((a, b) => b.length - a.length)) {
  if (readdirSync(dir).length === 0) rmSync(dir, { recursive: true });
}

spawnSync("bun", ["install"], { cwd: root, stdio: "inherit" });
spawnSync("bun", ["x", "vp", "fmt", "--write"], { cwd: root, stdio: "inherit" });

console.log(
  `\nKept: ${["core", ...picked].join(", ")}. Run \`bun run check\` and \`bun run build\` to verify.`,
);
