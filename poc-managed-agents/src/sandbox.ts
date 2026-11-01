export type SandboxRequest = {
	projectId: string;
	deploymentId: string;
	runId: string;
};

export type SandboxReference = {
	id: string;
};

export interface SandboxAdapter {
	create(request: SandboxRequest): Promise<SandboxReference>;
	destroy(reference: SandboxReference): Promise<void>;
}

export class DisabledSandboxAdapter implements SandboxAdapter {
	async create(): Promise<SandboxReference> {
		throw new Error("sandbox_execution_disabled");
	}

	async destroy(): Promise<void> {
		return;
	}
}
