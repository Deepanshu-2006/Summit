import { NextResponse } from "next/server";
import { meridianStore } from "@/lib/meridian-store";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Request body must be valid JSON.",
          code: "INVALID_JSON",
        },
        { status: 400 }
      );
    }

    const { version, branch, commit, changelog } = body;

    const errors: string[] = [];
    if (!version || typeof version !== "string" || !/^\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?$/.test(version.trim())) {
      errors.push("Field 'version' must follow semantic versioning (e.g. '2.4.1' or '2.5.0-rc1').");
    }
    if (!branch || typeof branch !== "string" || branch.trim().length === 0) {
      errors.push("Field 'branch' (e.g. 'main', 'production') is required.");
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid Release Manifest",
          message: "Release specification failed verification.",
          errors,
        },
        { status: 400 }
      );
    }

    const release = meridianStore.addRelease({
      version: version.trim(),
      branch: branch.trim(),
      commit: typeof commit === "string" && commit.trim() ? commit.trim() : "8f3a21c",
      author: "Elena Rostova <elena@meridian.io>",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Release published to distributed edge mesh.",
        data: {
          ...release,
          changelog: typeof changelog === "string" ? changelog : "Automated CI/CD build deployment",
          traffic_allocation: "100%",
          edge_regions: ["cdg-1", "fra-1", "lhr-1", "iad-1", "nrt-1"],
        },
      },
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "x-jetway-release-id": release.id,
          "x-jetway-edge-status": "propagated",
        },
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: errorMsg,
      },
      { status: 500 }
    );
  }
}
