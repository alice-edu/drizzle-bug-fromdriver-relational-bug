import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

async function main() {
  // Create connection using env vars (for docker)
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "root",
    database: process.env.DB_NAME || "drizzle_bug_test",
    port: parseInt(process.env.DB_PORT || "3308"),
  });

  const db = drizzle(connection, { schema, mode: "default" });

  // Create tables
  await connection.execute(`DROP TABLE IF EXISTS child`);
  await connection.execute(`DROP TABLE IF EXISTS parent`);
  await connection.execute(`
    CREATE TABLE parent (
      entity_id BINARY(16) NOT NULL PRIMARY KEY,
      name INT
    )
  `);
  await connection.execute(`
    CREATE TABLE child (
      entity_id BINARY(16) NOT NULL PRIMARY KEY,
      parent_id BINARY(16) NOT NULL,
      name INT,
      FOREIGN KEY (parent_id) REFERENCES parent(entity_id)
    )
  `);

  // Insert test data
  const parentId = "550e8400-e29b-41d4-a716-446655440000";
  const childId1 = "550e8400-e29b-41d4-a716-446655440001";
  const childId2 = "550e8400-e29b-41d4-a716-446655440002";

  await db.insert(schema.parent).values({
    entityId: parentId,
    name: 1,
  });

  await db.insert(schema.child).values([
    {
      entityId: childId1,
      parentId: parentId,
      name: 10,
    },
    {
      entityId: childId2,
      parentId: parentId,
      name: 20,
    },
  ]);

  console.log("\n=== Test 1: SQL-like select() query ===");
  const selectResult = await db
    .select()
    .from(schema.child)
    .where(eq(schema.child.parentId, parentId));

  console.log("Result:", JSON.stringify(selectResult, null, 2));
  console.log(
    "entityId type:",
    typeof selectResult[0].entityId,
    selectResult[0].entityId,
  );

  console.log("\n=== Test 2: Relational query with .with() ===");
  const relationalResult = await db.query.parent.findFirst({
    where: eq(schema.parent.entityId, parentId),
    with: {
      children: true,
    },
  });

  console.log("Result:", JSON.stringify(relationalResult, null, 2));
  if (relationalResult?.children?.[0]) {
    console.log(
      "child entityId type:",
      typeof relationalResult.children[0].entityId,
      relationalResult.children[0].entityId,
    );
  }

  await connection.end();
}

main().catch(console.error);
