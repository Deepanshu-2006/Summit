import { createHash } from "node:crypto";

export type RunInput = { sessionId: string; prompt: string };

export function hashRunInput(input: RunInput): string {
	return createHash("sha256").update(JSON.stringify([input.sessionId, input.prompt])).digest("hex");
}

export function assertSameRunInput(existingHash: string, input: RunInput): void {
	if (existingHash !== hashRunInput(input)) {
		throw new Error("idempotency_conflict");
	}
}
