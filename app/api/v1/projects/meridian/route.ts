import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      id: "proj_meridian_01hn8y7",
      name: "Meridian Studio",
      slug: "meridian",
      status: "active",
      framework: "nextjs-ssr",
      version: "2.4.0",
      region: "cdg-1 (Paris)",
      edge_routing: "anycast",
      environments: [
        { name: "production", url: "https://meridian.jetway.app", live: true },
        { name: "staging", url: "https://staging-meridian.jetway.app", live: true },
        { name: "preview", url: "https://pr-42-meridian.jetway.app", live: false },
      ],
      services: {
        web: { status: "running", instances: 3, edge_response_ms: 12 },
        api: { status: "healthy", latency_ms: 18.4, auth: "mTLS" },
        database: { engine: "postgresql-16", pool: "active", connections: 12 },
        worker: { status: "active", queue_size: 0, active_jobs: 1 },
      },
      updated_at: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
        "x-jetway-service": "meridian-api",
        "x-jetway-project": "meridian",
      },
    }
  );
}
