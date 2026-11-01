import { afterAll, describe, expect, it } from "vitest";
import { actor, setup } from "rivetkit";
import { db } from "rivetkit/db";
import { setupTest } from "rivetkit/test";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { SqliteStorage } from "@earendil-works/pi-durable/storage/sqlite";
import { createStorageConformance } from "@earendil-works/pi-durable/testing";
import { createRivetSqliteDatabase } from "../src/storage.js";
import { randomUUID } from "node:crypto";
import assert from "node:assert";

type ConformanceResult = {
	name: string;
	passed: boolean;
	error?: string;
};

const storageTestActor = actor({
	db: db(),
	actions: {
		/**
		 * Runs all 25 Pi Durable Storage conformance test cases against this actor's
		 * embedded, actor-scoped SQLite database (c.db).
		 */
		runConformanceSuite: async (c) => {
			let prefixSeq = 0;
			const suite = createStorageConformance({
				assertions: {
					ok(value: unknown, message?: string) {
						assert.ok(value, message);
					},
					strictEqual(actual: unknown, expected: unknown) {
						assert.strictEqual(actual, expected);
					},
					deepEqual(actual: unknown, expected: unknown) {
						assert.deepEqual(actual, expected);
					},
					partialDeepEqual(actual: unknown, expected: unknown) {
						const expObj = expected as Record<string, unknown>;
						const actObj = actual as Record<string, unknown>;
						for (const k of Object.keys(expObj)) {
							assert.deepEqual(actObj[k], expObj[k]);
						}
					},
					greaterThan(actual: number, expected: number) {
						assert.ok(actual > expected, `${actual} > ${expected}`);
					},
					async rejects(promise: Promise<unknown>, messageIncludes: string) {
						await assert.rejects(promise, (err: unknown) =>
							String(err).includes(messageIncludes),
						);
					},
				},
				withStorage: async (useStorage) => {
					prefixSeq++;
					const sqliteDb = createRivetSqliteDatabase(c.db);
					// Each conformance case gets an isolated table prefix within the actor DB,
					// avoiding cross-case collisions without issuing raw SQL DELETEs or DROP TABLEs.
					const storage = await SqliteStorage.open(sqliteDb, {
						prefix: `conf_${prefixSeq}_`,
					});
					try {
						await useStorage(storage);
					} finally {
						// Releases Pi storage facade; Rivet owns and preserves c.db
						await storage.close(BACKGROUND_CONTEXT);
					}
				},
			});

			const results: ConformanceResult[] = [];
			for (const testCase of suite) {
				try {
					await testCase.run();
					results.push({ name: testCase.name, passed: true });
				} catch (err: unknown) {
					results.push({ name: testCase.name, passed: false, error: String(err) });
				}
			}
			return results;
		},

		/**
		 * Verifies that the wrapper's transaction executes within transaction handles
		 * and that rollbacks restore previous state cleanly on actual c.db.
		 */
		testTransactionRollback: async (c) => {
			const sqliteDb = createRivetSqliteDatabase(c.db);
			await sqliteDb.exec("CREATE TABLE IF NOT EXISTS tx_test (id TEXT PRIMARY KEY, val TEXT)");
			await sqliteDb.run("INSERT INTO tx_test VALUES (?, ?)", "k1", "v1");

			let threw = false;
			try {
				await sqliteDb.transaction(async (tx) => {
					await tx.run("INSERT INTO tx_test VALUES (?, ?)", "k2", "v2");
					const row = await tx.get<{ id: string; val: string }>("SELECT * FROM tx_test WHERE id = ?", "k2");
					assert.strictEqual(row?.val, "v2");
					throw new Error("simulated_tx_abort");
				});
			} catch (err: unknown) {
				if (String(err).includes("simulated_tx_abort")) threw = true;
			}
			assert.strictEqual(threw, true);

			// k2 should be rolled back, k1 should persist
			const row2 = await sqliteDb.get<{ id: string; val: string }>("SELECT * FROM tx_test WHERE id = ?", "k2");
			assert.strictEqual(row2, undefined);

			const row1 = await sqliteDb.get<{ id: string; val: string }>("SELECT * FROM tx_test WHERE id = ?", "k1");
			assert.strictEqual(row1?.val, "v1");

			// Release Pi storage wrapper without closing Rivet-owned c.db
			await sqliteDb.close();

			// Confirm Rivet c.db is still open and functional
			const directRow = await c.db.execute("SELECT * FROM tx_test WHERE id = ?", "k1");
			assert.strictEqual(directRow.length, 1);

			return { rollbackVerified: true, rivetDbPersisted: true };
		},
	},
});

const storageTestRegistry = setup({ use: { storageTestActor } });

afterAll(async () => {
	await storageTestRegistry.shutdown();
});

describe("Pi Durable Storage integration and conformance over actual Rivet actor c.db", () => {
	it("executes all 25 Pi Durable Storage conformance test cases over actual Rivet actor c.db", async (c) => {
		const { client } = await setupTest(c, storageTestRegistry);
		const testActorHandle = client.storageTestActor.getOrCreate([
			"storage-conformance",
			randomUUID(),
		]);

		const results = await testActorHandle.runConformanceSuite();

		expect(results).toHaveLength(25);
		const failed = results.filter((r) => !r.passed);
		expect(failed).toEqual([]);
		expect(results.every((r) => r.passed)).toBe(true);
	}, 60000);

	it("verifies transactional rollback and c.db lifecycle preservation in the typed adapter", async (c) => {
		const { client } = await setupTest(c, storageTestRegistry);
		const testActorHandle = client.storageTestActor.getOrCreate([
			"storage-tx",
			randomUUID(),
		]);

		const res = await testActorHandle.testTransactionRollback();
		expect(res.rollbackVerified).toBe(true);
		expect(res.rivetDbPersisted).toBe(true);
	}, 60000);
});
