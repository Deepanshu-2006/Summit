import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { afterAll, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { actorStoragePath, mockAgent, openAgentHarness } from "../src/harness.js";
import { assertSameRunInput, hashRunInput } from "../src/idempotency.js";

const scratch = await mkdtemp(join(tmpdir(), "summit-managed-agent-poc-"));

afterAll(async () => {
	await rm(scratch, { recursive: true, force: true });
});

describe("Pi Durable deployment Harness", () => {
	it("keeps concurrent conversations independent", async () => {
		const harness = await openAgentHarness(join(scratch, "independent.sqlite"));
		try {
			const alpha = await harness.createConversation({ ownership: { kind: "ownerless" }, agent: mockAgent }, BACKGROUND_CONTEXT);
			const beta = await harness.createConversation({ ownership: { kind: "ownerless" }, agent: mockAgent }, BACKGROUND_CONTEXT);
			const alphaRun = await alpha.submit({ type: "input", content: "alpha private text", requestId: "alpha-1" }, BACKGROUND_CONTEXT);
			const betaRun = await beta.submit({ type: "input", content: "beta private text", requestId: "beta-1" }, BACKGROUND_CONTEXT);
			await Promise.all([alphaRun.wait(BACKGROUND_CONTEXT), betaRun.wait(BACKGROUND_CONTEXT)]);

			const alphaTranscript = JSON.stringify(await alpha.entries({ order: "ascending" }, 100, undefined, BACKGROUND_CONTEXT));
			const betaTranscript = JSON.stringify(await beta.entries({ order: "ascending" }, 100, undefined, BACKGROUND_CONTEXT));
			expect(alpha.id).not.toBe(beta.id);
			expect(alphaTranscript).toContain("alpha private text");
			expect(alphaTranscript).not.toContain("beta private text");
			expect(betaTranscript).toContain("beta private text");
			expect(betaTranscript).not.toContain("alpha private text");
		} finally {
			await harness.close(BACKGROUND_CONTEXT);
		}
	});

	it("queues same-conversation follow-ups in admission order", async () => {
		const harness = await openAgentHarness(join(scratch, "ordering.sqlite"), 5);
		try {
			const conversation = await harness.createConversation({ ownership: { kind: "ownerless" }, agent: mockAgent }, BACKGROUND_CONTEXT);
			const first = await conversation.submit({ type: "input", content: "first queued input", requestId: "order-1" }, BACKGROUND_CONTEXT);
			await new Promise((resolve) => setTimeout(resolve, 50));
			const second = await conversation.submit({ type: "input", content: "second queued input", requestId: "order-2" }, BACKGROUND_CONTEXT);
			await Promise.all([first.wait(BACKGROUND_CONTEXT), second.wait(BACKGROUND_CONTEXT)]);
			const transcript = JSON.stringify(await conversation.entries({ order: "ascending" }, 100, undefined, BACKGROUND_CONTEXT));
			expect(transcript.indexOf("first queued input")).toBeLessThan(transcript.indexOf("second queued input"));
		} finally {
			await harness.close(BACKGROUND_CONTEXT);
		}
	}, 30000);

	it("deduplicates a request ID and preserves the original submission", async () => {
		const harness = await openAgentHarness(join(scratch, "idempotency.sqlite"));
		try {
			const conversation = await harness.createConversation({ ownership: { kind: "ownerless" }, agent: mockAgent }, BACKGROUND_CONTEXT);
			const request = { type: "input" as const, content: "one accepted request", requestId: "stable-request" };
			const first = await conversation.submit(request, BACKGROUND_CONTEXT);
			await first.wait(BACKGROUND_CONTEXT);
			const repeated = await conversation.submit(request, BACKGROUND_CONTEXT);
			expect(repeated.id).toBe(first.id);
			const transcript = await conversation.entries({ order: "ascending" }, 100, undefined, BACKGROUND_CONTEXT);
			expect(transcript.items.filter((entry) => entry.kind === "pi.user")).toHaveLength(1);
		} finally {
			await harness.close(BACKGROUND_CONTEXT);
		}
	});

	it("rejects reuse of an idempotency key with a different session or prompt", () => {
		const original = { sessionId: "session-a", prompt: "original" };
		expect(() => assertSameRunInput(hashRunInput(original), original)).not.toThrow();
		expect(() => assertSameRunInput(hashRunInput(original), { ...original, prompt: "changed" })).toThrow("idempotency_conflict");
		expect(() => assertSameRunInput(hashRunInput(original), { ...original, sessionId: "session-b" })).toThrow("idempotency_conflict");
		expect(hashRunInput({ sessionId: "session-a", prompt: "original" })).toBe(
			hashRunInput({ prompt: "original", sessionId: "session-a" }),
		);
	});

	it("derives separate local storage files for different project, deployment, and session actor keys", () => {
		const sessionA = actorStoragePath(scratch, ["summit-agent-v1", "project-a", "deployment-a", "session-1"]);
		const sessionB = actorStoragePath(scratch, ["summit-agent-v1", "project-a", "deployment-a", "session-2"]);
		const projectB = actorStoragePath(scratch, ["summit-agent-v1", "project-b", "deployment-a", "session-1"]);
		const deploymentB = actorStoragePath(scratch, ["summit-agent-v1", "project-a", "deployment-b", "session-1"]);
		expect(new Set([sessionA, sessionB, projectB, deploymentB]).size).toBe(4);
		expect(() => actorStoragePath(scratch, [])).toThrow("actor_key_invalid");
	});

	it("recovers conversation history after closing and reopening the SQLite Harness", async () => {
		const file = join(scratch, "restart.sqlite");
		const first = await openAgentHarness(file);
		const conversation = await first.createConversation({ ownership: { kind: "ownerless" }, agent: mockAgent }, BACKGROUND_CONTEXT);
		const conversationId = conversation.id;
		const submitted = await conversation.submit({ type: "input", content: "survives process restart", requestId: "restart-1" }, BACKGROUND_CONTEXT);
		await submitted.wait(BACKGROUND_CONTEXT);
		await first.close(BACKGROUND_CONTEXT);

		const restarted = await openAgentHarness(file);
		try {
			const recovered = await restarted.conversation(conversationId, BACKGROUND_CONTEXT);
			expect(recovered).toBeDefined();
			const transcript = JSON.stringify(await recovered!.entries({ order: "ascending" }, 100, undefined, BACKGROUND_CONTEXT));
			expect(transcript).toContain("survives process restart");
		} finally {
			await restarted.close(BACKGROUND_CONTEXT);
		}
	});
});
