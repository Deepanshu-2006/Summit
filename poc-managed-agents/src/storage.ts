import type { SqliteDatabase, SqliteExecutor, SqliteValue } from "@earendil-works/chord/sqlite";
import type { RawAccess } from "rivetkit/db";

/**
 * Creates an executor backed by a Rivet RawAccess database or transaction client.
 *
 * All operations execute asynchronously against Rivet's actor-scoped SQLite database.
 * No raw SQL deletes or filesystem operations are performed.
 */
function createSqliteExecutor(target: RawAccess, isReleased: () => boolean): SqliteExecutor {
	return {
		async exec(sql: string): Promise<void> {
			if (isReleased()) throw new Error("database_closed");
			await target.execute(sql);
		},
		async run(sql: string, ...params: SqliteValue[]): Promise<void> {
			if (isReleased()) throw new Error("database_closed");
			if (params.length > 0) {
				await target.execute(sql, ...params);
			} else {
				await target.execute(sql);
			}
		},
		async get<T extends object>(sql: string, ...params: SqliteValue[]): Promise<T | undefined> {
			if (isReleased()) throw new Error("database_closed");
			const rows = params.length > 0
				? await target.execute<T & Record<string, unknown>>(sql, ...params)
				: await target.execute<T & Record<string, unknown>>(sql);
			return rows[0] as T | undefined;
		},
		async all<T extends object>(sql: string, ...params: SqliteValue[]): Promise<T[]> {
			if (isReleased()) throw new Error("database_closed");
			const rows = params.length > 0
				? await target.execute<T & Record<string, unknown>>(sql, ...params)
				: await target.execute<T & Record<string, unknown>>(sql);
			return rows as T[];
		},
	};
}

/**
 * Adapts Rivet's actor-scoped `c.db` (RawAccess) to Chord's SqliteDatabase interface
 * required by Pi Durable's `SqliteStorage.open(db)`.
 *
 * Guarantees:
 * 1. Transactions use the transaction callback handle only to prevent cross-statement interleaving.
 * 2. `close()` releases the Pi Durable storage facade without closing the underlying Rivet-owned `c.db`.
 * 3. Does not use `any`, internal Rivet paths, or raw SQL deletes.
 */
export function createRivetSqliteDatabase(rawDb: RawAccess): SqliteDatabase {
	let released = false;
	const isReleased = () => released;

	const rootExecutor = createSqliteExecutor(rawDb, isReleased);

	return {
		exec: rootExecutor.exec,
		run: rootExecutor.run,
		get: rootExecutor.get,
		all: rootExecutor.all,
		async transaction<T>(callback: (transaction: SqliteExecutor) => Promise<T>): Promise<T> {
			if (released) throw new Error("database_closed");
			return await rawDb.transaction(async (txRaw) => {
				// Must use the transaction callback handle only within the transaction scope
				const txExecutor = createSqliteExecutor(txRaw, isReleased);
				return await callback(txExecutor);
			});
		},
		async close(): Promise<void> {
			// Mark storage released without closing Rivet-owned c.db
			released = true;
		},
	};
}
