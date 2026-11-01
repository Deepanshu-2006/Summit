import { createClient } from "rivetkit/client";
import type { registry } from "./actor.js";

const endpoint = process.env.RIVET_ENDPOINT;
if (!endpoint) throw new Error("Set RIVET_ENDPOINT to the authenticated Rivet endpoint.");

const projectId = process.env.PROJECT_ID ?? "project-demo";
const deploymentId = process.env.DEPLOYMENT_ID ?? "deployment-demo";
const sessionId = process.env.SESSION_ID ?? "demo-session";

const client = createClient<typeof registry>({ endpoint });
const agent = client.managedAgent.getOrCreate([
	"summit-agent-v1",
	projectId,
	deploymentId,
	sessionId,
]);

try {
	await agent.createSession({ sessionId });
	const result = await agent.submit({
		sessionId,
		requestId: process.env.REQUEST_ID ?? crypto.randomUUID(),
		prompt: process.argv.slice(2).join(" ") || "Reply with a short greeting.",
	});
	console.log(JSON.stringify(result));
} finally {
	await client.dispose();
}
