// Starter options for `bun run init`. Paths are relative to the repo root.

const webPackage = "apps/web/package.json";

export const groups = ["backend", "auth", "ai"] as const;

export type Option = {
  group: (typeof groups)[number];
  label: string;
  paths: string[];
  deps: Record<string, string[]>;
  catalog: string[];
  scripts: string[];
};

// Each group keeps at most one option. The first option in a group is the interactive default.
export const options = {
  convex: {
    group: "backend",
    label: "Convex",
    paths: ["packages/backend", "apps/web/src/components/convex-status.tsx"],
    deps: { [webPackage]: ["@convex-dev/react-query", "@web-starter/backend", "convex"] },
    catalog: ["convex"],
    scripts: ["dev:server", "dev:setup", "codegen"],
  },
  drizzle: {
    group: "backend",
    label: "Effect v4 + Drizzle on PlanetScale Postgres via Hyperdrive",
    paths: [
      "packages/api",
      "apps/web/src/components/db-status.tsx",
      "apps/web/src/integrations/api.ts",
      "apps/web/src/routes/api/rpc.tsx",
    ],
    deps: { [webPackage]: ["@web-starter/api"] },
    catalog: [],
    scripts: [],
  },
  workos: {
    group: "auth",
    label: "WorkOS AuthKit",
    paths: [
      "apps/web/src/routes/api/auth",
      "apps/web/src/routes/auth-error.tsx",
      "apps/web/src/routes/sign-out.tsx",
      "apps/web/src/integrations/auth/workos.tsx",
    ],
    deps: { [webPackage]: ["@workos/authkit-tanstack-react-start"] },
    catalog: ["@workos/authkit-tanstack-react-start"],
    scripts: [],
  },
  clerk: {
    group: "auth",
    label: "Clerk",
    paths: ["apps/web/src/routes/auth", "apps/web/src/integrations/auth/clerk.tsx"],
    deps: { [webPackage]: ["@clerk/tanstack-react-start"] },
    catalog: ["@clerk/tanstack-react-start"],
    scripts: [],
  },
  ai: {
    group: "ai",
    label: "TanStack AI chat route",
    paths: ["apps/web/src/routes/ai.tsx", "apps/web/src/routes/api/ai"],
    deps: { [webPackage]: ["@tanstack/ai", "@tanstack/ai-openai", "@tanstack/ai-react"] },
    catalog: [],
    scripts: [],
  },
} satisfies Record<string, Option>;

export type OptionName = keyof typeof options;

export const optionNames = Object.keys(options) as OptionName[];
export const isOption = (name: string): name is OptionName => name in options;
