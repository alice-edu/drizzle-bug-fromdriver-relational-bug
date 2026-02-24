# Drizzle ORM Bug: fromDriver receives base64 strings in relational queries

## Bug Description

When using Drizzle's relational query API (`.query` with `.with()`), custom type `fromDriver` functions receive **base64-encoded strings** instead of raw `Buffer` values for nested/related data. This breaks custom type transformations that expect to work with Buffers.

## Expected Behavior

The `fromDriver` function should receive raw `Buffer` values from the database driver, regardless of which query syntax is used.

## Actual Behavior

- **SQL-like query (`.select()`)**: `fromDriver` receives `Buffer` values ✅
- **Relational query (`.with()`)**: `fromDriver` receives base64-encoded strings for nested relations ❌

This causes custom types that transform binary data (e.g., Buffer → formatted UUID string) to fail, as they receive already-serialized base64 strings like `"base64:type254:VQ6EAOKbQdSnFkRmVUQAAQ=="` instead of raw Buffers.

## Reproduction

This is a fully dockerized reproduction. No local setup required:

```bash
docker-compose up --build
```

The output will show:
1. **Test 1 (select query)**: `fromDriver` receives Buffer, returns formatted UUID
2. **Test 2 (relational query)**: `fromDriver` receives base64 string, returns malformed result

## Expected Output

Both queries should show `fromDriver` receiving hex strings (from Buffer.toString('hex')) and returning properly formatted UUIDs:

```
=== Test 1: SQL-like select() query ===
fromDriver called for entity_id: 550e8400e29b41d4a716446655440001
entityId type: string 550e8400-e29b-41d4-a716-446655440001

=== Test 2: Relational query with .with() ===
fromDriver called for entity_id: 550e8400e29b41d4a716446655440000
fromDriver called for entity_id: 550e8400e29b41d4a716446655440001
child entityId type: string 550e8400-e29b-41d4-a716-446655440001
```

## Actual Output

Test 1 works correctly, but Test 2 shows `fromDriver` receiving base64-encoded strings for child entities:

```
=== Test 1: SQL-like select() query ===
fromDriver called for entity_id: 550e8400e29b41d4a716446655440001
entityId type: string 550e8400-e29b-41d4-a716-446655440001

=== Test 2: Relational query with .with() ===
fromDriver called for entity_id: 550e8400e29b41d4a716446655440000  (parent - correct)
fromDriver called for entity_id: base64:type254:VQ6EAOKbQdSnFkRmVUQAAQ==  (child - WRONG!)
child entityId type: string base64:t-ype2-54:V-Q6EA-OKbQdSnFkRmVUQAAQ==
```

The relational query is passing already-serialized base64 strings to `fromDriver` instead of raw Buffer values.

## Root Cause

The relational query API appears to serialize Buffer values (via SuperJSON or similar) before passing them to `fromDriver` functions for nested relations. This breaks the contract that `fromDriver` should receive raw driver values (Buffers).

## Real-World Impact

In our production code, we use custom UUID types that convert MySQL `binary(16)` columns to formatted UUID strings with dashes. When using relational queries with `.with()`, the nested child entities have their Buffers pre-serialized to base64 strings before reaching `fromDriver`, resulting in malformed IDs like `"base64:t-ype2-54:V-Q6EA-OKbQdSnFkRmVUQAAQ=="` instead of proper UUIDs like `"550e8400-e29b-41d4-a716-446655440001"`.

This breaks:
- UUID validation (Zod schemas expect standard UUID format)
- API contracts (clients expect UUID strings, not base64)
- Any custom type that transforms binary data (encrypted fields, custom encodings, etc.)

## Workaround

Use `.select()` syntax instead of relational queries (`.query` with `.with()`) when custom types have `fromDriver` transformations.

## Environment

- Node.js: 22
- drizzle-orm: See package.json
- mysql2: See package.json
- Database: MySQL 8.0 (dockerized)
