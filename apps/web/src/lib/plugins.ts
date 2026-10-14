import { z } from "zod";

export const pluginRegistrationSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    document: z.string().max(250000).optional(),
    schemaUrl: z.string().url().max(2000).optional(),
    credentialEnv: z
      .string()
      .regex(/^CD80_PLUGIN_[A-Z0-9_]{1,90}$/)
      .refine(
        (value) => value !== "CD80_PLUGIN_CREDENTIAL_BINDINGS",
        "Reserved configuration variable",
      )
      .optional(),
  })
  .refine((value) => !!value.document !== !!value.schemaUrl, "Provide a document or schema URL");
export type PluginRegistration = z.infer<typeof pluginRegistrationSchema>;
export type PluginParameter = {
  name: string;
  location: "path" | "query" | "header" | "body";
  required: boolean;
  schema: Record<string, unknown>;
};
export type PluginOperation = {
  operationId: string;
  description: string;
  method: string;
  path: string;
  parameters: PluginParameter[];
  // Older stored operations inherit the plugin's authentication requirement.
  authenticated?: boolean;
};
export type RegisteredPlugin = {
  id: string;
  name: string;
  baseUrl: string;
  operations: PluginOperation[];
  authenticated: boolean;
};
export type StoredPlugin = RegisteredPlugin & {
  ownerId: string;
  credentialEnv?: string;
  auth?: { location: "header" | "query"; name: string; prefix: string };
};
