import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai";
import { fauxAssistantMessage, fauxProvider } from "@earendil-works/pi-ai/providers/faux";
import { createRegistry, Harness, type Storage } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { SqliteStorage } from "@earendil-works/pi-durable/storage/sqlite";
import type { RawAccess } from "rivetkit/db";
import { createRivetSqliteDatabase } from "./storage.js";
import { mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

const context = BACKGROUND_CONTEXT;

function createMockModels(tokensPerSecond: number) {
	let faux: ReturnType<typeof fauxProvider>;
	const answer = ({ messages }: { messages: Array<{ role: string; content: unknown }> }) => {
		// Refill after consumption so sequential runs don't exhaust a one-shot mock queue.
		faux.appendResponses([answer]);
		const last = messages.at(-1);
		const text = last?.role === "user"
			? typeof last.content === "string"
				? last.content
				: Array.isArray(last.content)
					? last.content.map((block) => (typeof block === "object" && block !== null && "text" in block ? String(block.text) : "")).join("")
					: "input"
			: "input";
		return fauxAssistantMessage(`mock:${text}`);
	};
	faux = fauxProvider({ provider: "summit-poc", tokensPerSecond });
	// Seed capacity for parallel requests whose factories have not run and refilled yet.
	faux.setResponses(Array.from({ length: 128 }, () => answer));
	const models = createModels();
	models.setProvider(faux.provider);
	return models;
}

/**
 * Opens a Pi Durable Harness backed either by an actor-scoped Rivet `c.db` (RawAccess)
 * or by a standalone Node SQLite database file path.
 */
export async function openAgentHarness(storageOrDb: string | RawAccess, tokensPerSecond = 1000): Promise<Harness> {
	let storage: Storage;
	if (typeof storageOrDb === "string") {
		await mkdir(dirname(storageOrDb), { recursive: true });
		storage = await openNodeSqliteStorage(storageOrDb);
	} else {
		const sqliteDb = createRivetSqliteDatabase(storageOrDb);
		storage = await SqliteStorage.open(sqliteDb);
	}
	const harness = await Harness.open(storage, {
		models: createMockModels(tokensPerSecond),
		registry: createRegistry(),
	}, context);
	harness.resume();
	return harness;
}

export const mockAgent = { model: { provider: "summit-poc", modelId: "faux-1" } };

/**
 * Derives a deterministic SQLite storage path from an actor key tuple.
 *
 * NOTE: Reconciled for Gate 1. This function is no longer used by the Rivet Actor runtime,
 * which now uses actor-scoped embedded `c.db` owned by Rivet. Retained for standalone Node SQLite tests.
 */
export function actorStoragePath(storageDir: string, actorKey: readonly string[]): string {
	if (!Array.isArray(actorKey) || actorKey.length !== 4 || actorKey.some((part) => !part)) {
		throw new Error("actor_key_invalid");
	}
	const identity = createHash("sha256").update(JSON.stringify(actorKey)).digest("hex");
	return join(storageDir, `${identity}.sqlite`);
}

/**
 * Purges standalone filesystem SQLite files (.sqlite, -wal, -shm).
 *
 * NOTE: Reconciled for Gate 1. This function is no longer used by the Rivet Actor runtime.
 * Under Rivet actor `db: db()`, the actor SQLite database is managed and destroyed by Rivet
 * upon `c.destroy()`, with no raw SQL DELETE SQL or shared filesystem files needed.
 * Retained for standalone Node test fixtures.
 */
export async function purgeActorStorage(storagePath: string): Promise<void> {
	await rm(storagePath, { force: true });
	await rm(`${storagePath}-wal`, { force: true });
	await rm(`${storagePath}-shm`, { force: true });
}

export { context, createRivetSqliteDatabase };
