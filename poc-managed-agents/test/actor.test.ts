import { afterAll, describe, expect, it } from "vitest";
import { setupTest } from "rivetkit/test";
import { randomUUID } from "node:crypto";
import { registry } from "../src/actor.js";

afterAll(async () => {
	await registry.shutdown();
});

describe("Managed Agent Rivet Actor integration", () => {
	it("isolates sessions across distinct Rivet session actors within the same deployment", async (c) => {
		const { client } = await setupTest(c, registry);
		const deploymentId = `dep-iso-${randomUUID()}`;

		const key1 = [
			"summit-agent-v1",
			"project-isolation",
			deploymentId,
			"session-alpha",
		];
		const key2 = [
			"summit-agent-v1",
			"project-isolation",
			deploymentId,
			"session-beta",
		];

		// Each session gets its own Rivet Actor with a versioned 4-element key tuple
		// and independent actor-scoped SQLite database (c.db)
		const session1 = client.managedAgent.getOrCreate(key1);
		const session2 = client.managedAgent.getOrCreate(key2);

		const s1 = await session1.createSession({ sessionId: "session-alpha" });
		const s2 = await session2.createSession({ sessionId: "session-beta" });

		expect(s1.sessionId).toBe("session-alpha");
		expect(s2.sessionId).toBe("session-beta");
		expect(s1.conversationId).toBeDefined();
		expect(s2.conversationId).toBeDefined();

		const [run1, run2] = await Promise.all([
			session1.submit({
				sessionId: "session-alpha",
				requestId: `req-alpha-${randomUUID()}`,
				prompt: "hello alpha only",
			}),
			session2.submit({
				sessionId: "session-beta",
				requestId: `req-beta-${randomUUID()}`,
				prompt: "hello beta only",
			}),
		]);

		expect(run1.status).toBe("done");
		expect(run2.status).toBe("done");
		expect(run1.submissionId).toBeDefined();
		expect(run2.submissionId).toBeDefined();

		const t1 = JSON.stringify(await session1.transcript({ sessionId: "session-alpha" }));
		const t2 = JSON.stringify(await session2.transcript({ sessionId: "session-beta" }));
		expect(t1.length).toBeGreaterThan(0);
		expect(t2.length).toBeGreaterThan(0);
		expect(t1).toContain("hello alpha only");
		expect(t1).not.toContain("hello beta only");
		expect(t2).toContain("hello beta only");
		expect(t2).not.toContain("hello alpha only");
	}, 60000);

	it("enforces idempotent requests and detects input conflicts within a session actor", async (c) => {
		const { client } = await setupTest(c, registry);
		const deploymentId = `dep-idem-${randomUUID()}`;
		const agent = client.managedAgent.getOrCreate([
			"summit-agent-v1",
			"project-idempotency",
			deploymentId,
			"session-idem",
		]);

		await agent.createSession({ sessionId: "session-idem" });

		const stableRequestId = `req-idem-${randomUUID()}`;

		// First submission
		const initial = await agent.submit({
			sessionId: "session-idem",
			requestId: stableRequestId,
			prompt: "replayed prompt",
		});
		expect(initial.status).toBe("done");
		const transcriptBeforeReplay = await agent.transcript({ sessionId: "session-idem" });

		// Identical resubmission returns same result and submissionId
		const repeated = await agent.submit({
			sessionId: "session-idem",
			requestId: stableRequestId,
			prompt: "replayed prompt",
		});
		expect(repeated.status).toBe(initial.status);
		expect(repeated.submissionId).toBe(initial.submissionId);
		expect(await agent.transcript({ sessionId: "session-idem" })).toEqual(transcriptBeforeReplay);

		// Conflicting resubmission with changed prompt throws idempotency conflict
		await expect(
			agent.submit({
				sessionId: "session-idem",
				requestId: stableRequestId,
				prompt: "tampered prompt",
			}),
		).rejects.toThrow();

		// Conflicting resubmission with mismatched session throws conflict
		await expect(
			agent.submit({
				sessionId: "session-other",
				requestId: stableRequestId,
				prompt: "replayed prompt",
			}),
		).rejects.toThrow();

		// Submit to uninitialized session fails
		const uninitAgent = client.managedAgent.getOrCreate([
			"summit-agent-v1",
			"project-idempotency",
			deploymentId,
			"session-uninit",
		]);
		await expect(
			uninitAgent.submit({
				sessionId: "session-uninit",
				requestId: `req-missing-${randomUUID()}`,
				prompt: "should fail",
			}),
		).rejects.toThrow();
	}, 60000);

	it("destroys one session actor and verifies survivor actor remains functional while target is not_found", async (c) => {
		const { client } = await setupTest(c, registry);
		const deploymentId = `dep-destroy-${randomUUID()}`;
		const keyTarget = [
			"summit-agent-v1",
			"project-destroy",
			deploymentId,
			"session-target",
		];
		const keySurvivor = [
			"summit-agent-v1",
			"project-destroy",
			deploymentId,
			"session-survivor",
		];

		const target = client.managedAgent.getOrCreate(keyTarget);
		const survivor = client.managedAgent.getOrCreate(keySurvivor);

		await target.createSession({ sessionId: "session-target" });
		await survivor.createSession({ sessionId: "session-survivor" });

		const [targetRun, survivorRun] = await Promise.all([
			target.submit({
				sessionId: "session-target",
				requestId: `req-target-1-${randomUUID()}`,
				prompt: "target doomed transcript",
			}),
			survivor.submit({
				sessionId: "session-survivor",
				requestId: `req-survivor-1-${randomUUID()}`,
				prompt: "survivor safe transcript",
			}),
		]);

		expect(targetRun.status).toBe("done");
		expect(survivorRun.status).toBe("done");

		// Destroy the target session actor via public Rivet actor action API
		const destroyRes = await target.destroy();
		expect(destroyRes).toEqual({ destroyed: true });

		// Wait briefly for engine to complete actor teardown
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Target actor cannot be queried via get() once destroyed, returning not_found
		await expect(
			client.managedAgent
				.get(keyTarget, { signal: AbortSignal.timeout(30000) })
				.transcript({ sessionId: "session-target" }),
		).rejects.toThrow(/not_found|does not exist|destroyed/i);

		// Survivor actor remains fully functional and its transcript is unaffected
		const survivorFollowUp = await survivor.submit({
			sessionId: "session-survivor",
			requestId: `req-survivor-2-${randomUUID()}`,
			prompt: "survivor follow-up input",
		});
		expect(survivorFollowUp.status).toBe("done");

		const survivorTranscript = JSON.stringify(
			await survivor.transcript({ sessionId: "session-survivor" }),
		);
		expect(survivorTranscript).toContain("survivor safe transcript");
		expect(survivorTranscript).toContain("survivor follow-up input");
		expect(survivorTranscript).not.toContain("target doomed transcript");
	}, 60000);

	it("recovers an actor and previously acknowledged transcript across actor sleep and wake over c.db", async (c) => {
		const { client } = await setupTest(c, registry);
		const deploymentId = `dep-rec-${randomUUID()}`;
		const key = [
			"summit-agent-v1",
			"project-recovery",
			deploymentId,
			"session-recovery",
		];

		const agent = client.managedAgent.getOrCreate(key);
		const s1 = await agent.createSession({ sessionId: "session-recovery" });
		expect(s1.sessionId).toBe("session-recovery");
		expect(s1.conversationId).toBeDefined();

		const requestId1 = `req-rec-1-${randomUUID()}`;
		const run1 = await agent.submit({
			sessionId: "session-recovery",
			requestId: requestId1,
			prompt: "persisted transcript message 1",
		});
		expect(run1.status).toBe("done");

		const t1 = JSON.stringify(await agent.transcript({ sessionId: "session-recovery" }));
		expect(t1).toContain("persisted transcript message 1");

		// Sleep the session actor via public Rivet actor action API (c.sleep())
		// This invokes onSleep, gracefully closes the Pi Harness, and unloads actor in-memory state.
		const sleepRes = await agent.sleep();
		expect(sleepRes).toEqual({ sleeping: true });

		// The pinned test client exposes no sleep-completion event. Allow its asynchronous
		// onSleep lifecycle callback to close Pi storage before the next request wakes the actor.
		await new Promise((resolve) => setTimeout(resolve, 500));

		// Resolve existing actor using get() (not getOrCreate) to verify existing actor identity and c.db storage persist
		const recoveredAgent = client.managedAgent.get(key);
		const recoveredTranscript = JSON.stringify(
			await recoveredAgent.transcript({ sessionId: "session-recovery" }),
		);
		expect(recoveredTranscript).toContain("persisted transcript message 1");

		// Verify request idempotency survived sleep and recovery
		const replayedRun1 = await recoveredAgent.submit({
			sessionId: "session-recovery",
			requestId: requestId1,
			prompt: "persisted transcript message 1",
		});
		expect(replayedRun1.status).toBe(run1.status);
		expect(replayedRun1.submissionId).toBe(run1.submissionId);

		// Verify input conflict detection still rejects tampered prompt for the same requestId after recovery
		await expect(
			recoveredAgent.submit({
				sessionId: "session-recovery",
				requestId: requestId1,
				prompt: "tampered prompt after recovery",
			}),
		).rejects.toThrow();

		// Submit follow-up run on the recovered actor to verify createVars re-opened Pi Harness over c.db cleanly
		const run2 = await recoveredAgent.submit({
			sessionId: "session-recovery",
			requestId: `req-rec-2-${randomUUID()}`,
			prompt: "follow-up message after recovery",
		});
		expect(run2.status).toBe("done");

		const updatedTranscript = JSON.stringify(
			await recoveredAgent.transcript({ sessionId: "session-recovery" }),
		);
		expect(updatedTranscript).toContain("persisted transcript message 1");
		expect(updatedTranscript).toContain("follow-up message after recovery");
	}, 60000);
});
