import ts from "typescript";
import { z } from "zod";
import {
  capabilityPlanSchema,
  capabilityContractSchemas,
  type CapabilityPlan,
} from "@web-starter/capabilities";
import {
  generateCapabilityTypeScript,
  runCapabilityPlan,
  type CapabilityRunResult,
} from "@web-starter/capabilities/runtime";
import { simulationContractSchemas } from "../../../../packages/capabilities/src/definitions";

// Only the structural JSON Schema forms used by the trusted contracts are supported.
// Refinements (lengths, bounds, etc.) remain enforced by the runtime's Zod schemas.
function schemaDeclaration(schema: z.ZodType, name: string): string {
  const root = z.toJSONSchema(schema);
  const definitions = root.$defs ?? {};
  const names = new Map(Object.keys(definitions).map((key, i) => [key, `${name}Definition${i}`]));
  function typeOf(node: z.core.JSONSchema._JSONSchema): string {
    if (typeof node === "boolean") throw new Error("Unsupported boolean contract schema.");
    if (node.$ref) {
      const alias = names.get(node.$ref.replace(/^#\/\$defs\//, ""));
      if (!alias) throw new Error(`Unsupported contract reference: ${node.$ref}`);
      return alias;
    }
    if (Object.hasOwn(node, "const")) return JSON.stringify(node.const);
    if (node.enum) return node.enum.map((value) => JSON.stringify(value)).join(" | ");
    const union = node.anyOf ?? node.oneOf;
    if (union) return union.map((value) => `(${typeOf(value)})`).join(" | ");
    switch (node.type) {
      case "string":
      case "number":
      case "boolean":
      case "null":
        return node.type;
      case "integer":
        return "number";
      case "array":
        if (!node.items || Array.isArray(node.items)) break;
        return `Array<${typeOf(node.items)}>`;
      case "object": {
        const properties = Object.entries(node.properties ?? {}).map(
          ([key, value]) =>
            `${JSON.stringify(key)}${node.required?.includes(key) ? "" : "?"}: ${typeOf(value)};`,
        );
        if (typeof node.additionalProperties === "object")
          properties.push(`[key: string]: ${typeOf(node.additionalProperties)};`);
        else if (node.additionalProperties !== false)
          throw new Error("Unsupported open contract object.");
        return `{ ${properties.join(" ")} }`;
      }
    }
    throw new Error("Unsupported contract schema; update the capability compiler.");
  }
  return [
    ...Object.entries(definitions).map(
      ([key, value]) => `type ${names.get(key)} = ${typeOf(value)};`,
    ),
    `export type ${name} = ${typeOf(root)};`,
  ].join("\n");
}

export function compileCapabilityProgram(plan: CapabilityPlan): {
  typescript: string;
  run(inputs: Record<string, unknown>): Promise<CapabilityRunResult>;
} {
  // Never accept source from a release, model, or caller. JSON data is serialized by
  // the platform-owned generator; the resulting wrapper owns its plan snapshot.
  const typescript = generateCapabilityTypeScript(plan);
  const sourcePath = "/capability-compiler/generated.ts";
  const declarationsPath = "/capability-compiler/contracts.d.ts";
  const contractDeclarations = Object.entries(capabilityContractSchemas).map(([id, schema], i) => ({
    id,
    name: `SimulationContract${i}`,
    declaration: schemaDeclaration(schema, `SimulationContract${i}`),
  }));
  const declarations = `
declare module "@web-starter/capabilities" {
  ${schemaDeclaration(capabilityPlanSchema, "CapabilityPlan")}
  ${contractDeclarations.map((entry) => entry.declaration).join("\n")}
   export type CapabilityContractValues = {
     ${contractDeclarations.map((entry) => `${JSON.stringify(entry.id)}: ${entry.name};`).join("\n")}
   };
   export type SimulationContractValues = Pick<CapabilityContractValues, ${Object.keys(
     simulationContractSchemas,
   )
     .map((id) => JSON.stringify(id))
     .join(" | ")}>;
}
declare module "@web-starter/capabilities/runtime" {
  import type { CapabilityPlan } from "@web-starter/capabilities";
  export interface CapabilityRunResult {
    results: Record<string, unknown>;
    outputs: Record<string, unknown>;
    provenance: { simulated: boolean; unverified: boolean; warning: string };
  }
  export function runCapabilityPlan(plan: CapabilityPlan, inputs: Record<string, unknown>): Promise<CapabilityRunResult>;
}
`;
  const options: ts.CompilerOptions = {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    lib: ["lib.es2022.d.ts"],
    types: [],
    noEmitOnError: true,
    noUncheckedSideEffectImports: true,
  };
  const files = new Map([
    [sourcePath, typescript],
    [declarationsPath, declarations],
  ]);
  const host = ts.createCompilerHost(options);
  // Declarations are virtual, so deployed code never resolves workspace .ts files
  // or ambient @types. Disk reads are restricted to TypeScript's own libraries.
  const libraryDirectory = ts.getDefaultLibFilePath(options).replace(/[^/\\]+$/, "");
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  const isLibrary = (path: string) =>
    path.startsWith(libraryDirectory) &&
    /^lib\.[\w.-]+\.d\.ts$/.test(path.slice(libraryDirectory.length));
  host.readFile = (path) => files.get(path) ?? (isLibrary(path) ? readFile(path) : undefined);
  host.fileExists = (path) => files.has(path) || (isLibrary(path) && fileExists(path));
  host.getSourceFile = (path, languageVersion) => {
    const text = host.readFile(path);
    return text === undefined ? undefined : ts.createSourceFile(path, text, languageVersion);
  };
  const program = ts.createProgram([sourcePath, declarationsPath], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length)
    throw new Error(
      `Capability TypeScript compilation failed:\n${diagnostics
        .map((diagnostic) => {
          const position =
            diagnostic.file && diagnostic.start !== undefined
              ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
              : undefined;
          return `TS${diagnostic.code}${position ? ` (${position.line + 1}:${position.character + 1})` : ""}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
        })
        .join("\n")}`,
    );

  // Emit the same source checked above as CommonJS solely to bind its imports.
  // This is not a sandbox: only deterministic platform-generated code reaches it.
  const emitted = ts.transpileModule(typescript, {
    compilerOptions: { target: options.target, module: ts.ModuleKind.CommonJS },
    fileName: sourcePath,
    reportDiagnostics: true,
  });
  if (emitted.diagnostics?.length || !emitted.outputText)
    throw new Error("Capability TypeScript emission failed.");
  const exports: {
    runGenerated?: (inputs: Record<string, unknown>) => Promise<CapabilityRunResult>;
  } = {};
  const requireRegistered = (name: string) => {
    if (name !== "@web-starter/capabilities/runtime")
      throw new Error(`Unregistered capability module: ${name}`);
    return Object.freeze({ runCapabilityPlan });
  };
  // oxlint-disable-next-line typescript/no-implied-eval -- Only checked, platform-generated source is executable.
  new Function("require", "exports", emitted.outputText)(requireRegistered, exports);
  if (typeof exports.runGenerated !== "function")
    throw new Error("Compiled capability wrapper did not export runGenerated.");
  return { typescript, run: exports.runGenerated };
}
