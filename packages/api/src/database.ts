import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Drizzle from "alchemy/Drizzle";
import * as Planetscale from "alchemy/Planetscale";
import * as Effect from "effect/Effect";

// Paths resolve from the stack's working directory (`apps/web`).
const root = "../../packages/api";

// One PlanetScale Postgres database with a branch per stage. Deploys regenerate
// migrations from the Drizzle schema and apply them to the branch.
export const Database = Effect.gen(function* () {
  const { stage } = yield* Alchemy.Stack;
  const schema = yield* Drizzle.Schema("Schema", {
    schema: `${root}/src/schema.ts`,
    out: `${root}/migrations`,
  });
  const database = yield* Planetscale.PostgresDatabase("Database", {
    region: { slug: "us-east" },
    clusterSize: "PS_10",
  });
  const branch = yield* Planetscale.PostgresBranch("Branch", {
    database,
    name: stage,
    migrations: schema,
  });
  const role = yield* Planetscale.PostgresRole("Role", {
    database,
    branch,
    inheritedRoles: ["postgres"],
  });
  return { database, branch, role };
});

// Hyperdrive pools connections at the edge. Local dev skips Hyperdrive, so it
// uses PlanetScale's pooled port instead.
export const Hyperdrive = Effect.gen(function* () {
  const { role } = yield* Database;
  return yield* Cloudflare.Hyperdrive.Connection("Hyperdrive", {
    origin: role.origin,
    dev: role.pooledOrigin,
    caching: { disabled: true },
  });
});
