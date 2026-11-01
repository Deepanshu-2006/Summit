import { actor, setup, type ActionContext } from "rivetkit";
import { db, type DatabaseProvider, type RawAccess } from "rivetkit/db";
import type { ConversationId, Harness } from "@earendil-works/pi-durable";
import { openAgentHarness, context, mockAgent } from "./harness.js";
import { assertSameRunInput, hashRunInput } from "./idempotency.js";

type ActorState = {
	conversationId?: ConversationId;
	requests: Record<string, { inputHash: string; result: { status: string; submissionId: string } }>;
};

type ActorVars = {
	harness: Harness;
	queue: Promise<void>;
	closed: boolean;
};

type ActionCtx = ActionContext<
	ActorState,
	undefined,
	undefined,
	ActorVars,
	undefined,
	DatabaseProvider<RawAccess>
>;

async function inActorOrder<T>(vars: ActorVars, operation: () => Promise<T>): Promise<T> {
	// This Promise chain orders calls only within the current session actor process. Summit's Go
	// outbox and durable deployment_queue_seq remain authoritative for deployment-wide
	// admission/FIFO across actors and for ordering across retries/restarts.
	// Validate crash-during-queue behavior against a supported Rivet Engine before relying on it.
	const previous = vars.queue;
	let release!: () => void;
	vars.queue = new Promise<void>((resolve) => {
		release = resolve;
	});
	await previous;
	try {
		return await operation();
	} finally {
		release();
	}
}

const createSession = (c: ActionCtx, input?: { sessionId?: string }) => inActorOrder(c.vars, async () => {
	// Key tuple: ["summit-agent-v1", projectId, deploymentId, sessionId]
	const keySessionId = c.key?.[3];
	if (input?.sessionId && keySessionId && input.sessionId !== keySessionId) {
		throw new Error("session_id_mismatch");
	}
	const sessionId = input?.sessionId ?? keySessionId ?? "default-session";
	if (c.state.conversationId) return { sessionId, conversationId: String(c.state.conversationId) };
	// Pi's ownerless value describes Pi task-tree ownership only. Summit user/project
	// authorization is enforced by Go before any actor action; it is not delegated to Pi.
	const conversation = await c.vars.harness.createConversation({ ownership: { kind: "ownerless" }, agent: mockAgent }, context);
	c.state.conversationId = conversation.id;
	return { sessionId, conversationId: String(conversation.id) };
});

const submit = (c: ActionCtx, input: { requestId: string; prompt: string; sessionId?: string }) => inActorOrder(c.vars, async () => {
	const keySessionId = c.key?.[3];
	if (input.sessionId && keySessionId && input.sessionId !== keySessionId) {
		throw new Error("session_id_mismatch");
	}
	const sessionId = input.sessionId ?? keySessionId ?? "default-session";
	const conversationId = c.state.conversationId;
	if (!conversationId) throw new Error("session_not_found");

	const inputHash = hashRunInput({ sessionId, prompt: input.prompt });
	const prior = c.state.requests[input.requestId];
	if (prior) assertSameRunInput(prior.inputHash, { sessionId, prompt: input.prompt });
	if (prior && prior.result.status !== "queued") return prior.result;
	if (!prior) {
		// Write ahead before submitting. After a process restart the same stable requestId
		// is resubmitted to Pi Durable, which deduplicates it; this recovery path still needs
		// validation with the supported Rivet runtime and durable Summit dispatch records.
		c.state.requests = {
			...c.state.requests,
			[input.requestId]: { inputHash, result: { status: "queued", submissionId: "" } },
		};
	}

	const conversation = await c.vars.harness.conversation(conversationId, context);
	if (!conversation) throw new Error("conversation_not_found");
	const submission = await conversation.submit({
		type: "input",
		content: input.prompt,
		requestId: input.requestId,
		whenBusy: "followUp",
	}, context);
	const submissionId = String(submission.id);
	// Persist Pi's stable submission ID before awaiting completion. A retry can return
	// this in-flight submission instead of losing its correlation while it is running.
	c.state.requests = {
		...c.state.requests,
		[input.requestId]: { inputHash, result: { status: "queued", submissionId } },
	};
	const settled = await submission.wait(context);
	const result = { status: settled.status, submissionId };
	c.state.requests = { ...c.state.requests, [input.requestId]: { inputHash, result } };
	return result;
});

const transcript = (c: ActionCtx, input?: { sessionId?: string }) => inActorOrder(c.vars, async () => {
	const keySessionId = c.key?.[3];
	if (input?.sessionId && keySessionId && input.sessionId !== keySessionId) {
		throw new Error("session_id_mismatch");
	}
	const conversationId = c.state.conversationId;
	if (!conversationId) throw new Error("session_not_found");
	const conversation = await c.vars.harness.conversation(conversationId, context);
	if (!conversation) throw new Error("conversation_not_found");
	const page = await conversation.entries({ order: "ascending" }, 200, undefined, context);
	// This action is for the authenticated Go adapter; Summit remains responsible for
	// authorizing transcript access before forwarding model messages to a user.
	return page.items.map((entry) => ({ kind: entry.kind, model: entry.model }));
});

const destroy = (c: ActionCtx) => inActorOrder(c.vars, async () => {
	c.destroy();
	return { destroyed: true };
});

const sleep = (c: ActionCtx) => inActorOrder(c.vars, async () => {
	c.sleep();
	return { sleeping: true };
});

const actions = { createSession, submit, transcript, destroy, sleep };

export const managedAgent = actor<
	ActorState,
	undefined,
	undefined,
	ActorVars,
	undefined,
	DatabaseProvider<RawAccess>,
	Record<never, never>,
	Record<never, never>,
	typeof actions
>({
	db: db(),
	state: {
		requests: {},
	},
	createVars: async (c) => {
		return {
			harness: await openAgentHarness(c.db),
			queue: Promise.resolve(),
			closed: false,
		};
	},
	actions,
	onSleep: async (c) => {
		if (!c.vars.closed) {
			c.vars.closed = true;
			await c.vars.harness.close(context);
		}
	},
	onDestroy: async (c) => {
		if (!c.vars.closed) {
			c.vars.closed = true;
			await c.vars.harness.close(context);
		}
	},
});

export const registry = setup({ use: { managedAgent } });
