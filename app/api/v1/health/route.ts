import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      service: "meridian-api",
      version: "1.0.0",
      region: "cdg-1 (Paris)",
      edge_routing: "anycast",
      uptime_seconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
        "x-jetway-service": "meridian-api",
        "x-jetway-region": "cdg-1",
        "x-jetway-env": "production",
      },
    }
  );
}
