import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("icariam_records", {
  ownerId: text("owner_id").notNull(),
  accountId: text("account_id").notNull(),
  kind: text("kind").notNull(),
  recordId: text("record_id").notNull(),
  data: text("data").notNull(),
  revision: integer("revision").notNull().default(1),
  updatedAt: text("updated_at").notNull(),
}, t => [primaryKey({columns:[t.ownerId,t.accountId,t.kind,t.recordId]})]);
export const history = sqliteTable("icariam_history", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  accountId: text("account_id").notNull(),
  kind: text("kind").notNull(),
  recordId: text("record_id").notNull(),
  revision: integer("revision").notNull(),
  data: text("data").notNull(),
  savedAt: text("saved_at").notNull(),
});
