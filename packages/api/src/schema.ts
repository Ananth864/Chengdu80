import { defineRelations } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Edit tables here; `alchemy deploy` generates migration SQL into `../migrations`
// and applies it to the PlanetScale branch.
export const Users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const relations = defineRelations({ Users }, () => ({}));
