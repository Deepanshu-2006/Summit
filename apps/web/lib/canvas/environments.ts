/**
 * Environment selection for the canvas. Production exists by default.
 * A preferred value may be an environment id (URL `?env=`) or its name.
 */

export type EnvironmentRef = { id: string; name: string; type: string };

export function environmentStorageKey(projectId: string): string {
  return `summit:selected-environment:${projectId}`;
}

export function pickEnvironmentId(
  environments: EnvironmentRef[],
  preferred: string | null | undefined,
): string | null {
  if (environments.length === 0) return null;
  if (preferred) {
    const match = environments.find(
      (environment) => environment.id === preferred || environment.name === preferred,
    );
    if (match) return match.id;
  }
  const production = environments.find(
    (environment) => environment.type === "production" || environment.name === "production",
  );
  return (production ?? environments[0]).id;
}

export function resolveEnvironmentId(
  environments: EnvironmentRef[],
  selected: string | null | undefined,
): string | null {
  if (!selected) return null;
  const match = environments.find(
    (environment) => environment.id === selected || environment.name === selected,
  );
  return match?.id ?? null;
}

export function servicesInEnvironment<T extends { environment_id: string }>(
  services: T[],
  environmentId: string | null,
): T[] {
  if (!environmentId) return services;
  return services.filter((service) => service.environment_id === environmentId);
}
