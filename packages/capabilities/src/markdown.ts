import { capabilityPlanSchema, validateCapabilityPlan } from "./plans";
import type { CapabilityPlan } from "./plans";

const MAX_MARKDOWN = 1_000_000;
const marker = "cd80-capabilities-v1";

export function exportCapabilityMarkdown(plan: CapabilityPlan, prose = ""): string {
  const parsed = capabilityPlanSchema.parse(plan);
  const validation = validateCapabilityPlan(parsed);
  if (!validation.valid) throw new Error(validation.issues.map((i) => i.message).join("\n"));
  if (prose.includes(marker)) throw new Error("Prose must not contain a capability block marker.");
  const result = `${prose}${prose ? "\n\n" : ""}\`\`\`${marker}\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n`;
  if (result.length > MAX_MARKDOWN) throw new Error("Markdown exceeds size bound.");
  parseCapabilityMarkdown(result);
  return result;
}

export function parseCapabilityMarkdown(text: string): { plan: CapabilityPlan; prose: string } {
  if (text.length > MAX_MARKDOWN) throw new Error("Markdown exceeds size bound.");
  // A line-based fence scanner avoids accepting a capability block nested in another fence.
  const lines = text.split(/\r?\n/);
  let fence: { char: string; length: number; capability: boolean } | undefined;
  let body: string[] = [];
  const blocks: string[] = [];
  let offset = 0;
  let start = 0;
  let end = 0;
  let blockStart = 0;
  for (const line of lines) {
    const next =
      offset +
      line.length +
      (text.slice(offset + line.length, offset + line.length + 2) === "\r\n" ? 2 : 1);
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (!fence) {
      if (!opening) {
        offset = next;
        continue;
      }
      const delimiter = opening[1]!;
      const info = opening[2]!.trim();
      if (info.includes("cd80-capabilities") && (delimiter !== "```" || info !== marker))
        throw new Error("Invalid versioned capability fence.");
      fence = { char: delimiter[0]!, length: delimiter.length, capability: info === marker };
      if (fence.capability) blockStart = offset;
      body = [];
    } else if (
      opening &&
      opening[1]![0] === fence.char &&
      opening[1]!.length >= fence.length &&
      !opening[2]!.trim()
    ) {
      if (fence.capability) {
        if (opening[1] !== "```")
          throw new Error("Capability block must use exactly three backticks.");
        blocks.push(body.join("\n"));
        start = blockStart;
        end = Math.min(next, text.length);
      }
      fence = undefined;
    } else if (fence.capability) body.push(line);
    offset = next;
  }
  if (fence?.capability || blocks.length !== 1)
    throw new Error("Expected exactly one complete cd80-capabilities-v1 JSON block.");
  const plan = capabilityPlanSchema.parse(JSON.parse(blocks[0]!));
  const validation = validateCapabilityPlan(plan);
  if (!validation.valid) throw new Error(validation.issues.map((i) => i.message).join("\n"));
  // Preserve surrounding prose byte-for-byte, including separators and line endings.
  return { plan, prose: text.slice(0, start) + text.slice(end) };
}
