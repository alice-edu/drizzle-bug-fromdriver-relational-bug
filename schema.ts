import { mysqlTable, int, customType } from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";
import { randomUUID } from "crypto";

// Custom type that formats UUID with hyphens
export const customUuid = (columnName: string) => {
  return customType<{
    data: string;
    driverData: Buffer;
  }>({
    dataType: () => "binary(16)",
    fromDriver: (value: Buffer): string => {
      const hex = value.toString("hex");
      console.log(`fromDriver called for ${columnName}:`, hex);
      // Format UUID with hyphens: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20),
      ].join("-");
    },
    toDriver: (value: string): Buffer => {
      return Buffer.from(value.replaceAll("-", ""), "hex");
    },
  })(columnName);
};

export const customUuidEntityId = (columnName: string) => {
  return customUuid(columnName)
    .notNull()
    .$default(() => randomUUID());
};

// Parent table
export const parent = mysqlTable("parent", {
  entityId: customUuidEntityId("entity_id"),
  name: int("name"),
});

// Child table with custom UUID
export const child = mysqlTable("child", {
  entityId: customUuidEntityId("entity_id"),
  parentId: customUuid("parent_id").notNull(),
  name: int("name"),
});

// Relations
export const parentRelations = relations(parent, ({ many }) => ({
  children: many(child),
}));

export const childRelations = relations(child, ({ one }) => ({
  parent: one(parent, {
    fields: [child.parentId],
    references: [parent.entityId],
  }),
}));
