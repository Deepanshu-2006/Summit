import { NextResponse } from "next/server";
import { meridianStore, ResourceItem } from "@/lib/meridian-store";

export async function GET() {
  const resources = meridianStore.getResources();
  return NextResponse.json(
    {
      data: resources,
      total: resources.length,
      project: "meridian",
      environment: "production",
      retrieved_at: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, max-age=0",
        "x-jetway-service": "meridian-api",
      },
    }
  );
}

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

    const { name, type, tier } = body;

    // Validation
    const errors: string[] = [];
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      errors.push("Field 'name' (string) is required.");
    }
    const validTypes = ["database", "key-value", "storage", "compute", "certificate"];
    if (!type || typeof type !== "string" || !validTypes.includes(type.toLowerCase())) {
      errors.push(`Field 'type' must be one of: ${validTypes.join(", ")}.`);
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: "Validation Error",
          message: "Resource specification is invalid.",
          errors,
        },
        { status: 400 }
      );
    }

    // Provision new resource in in-memory store
    const createdResource = meridianStore.addResource({
      name: name.trim(),
      type: type.toLowerCase() as ResourceItem["type"],
      tier: typeof tier === "string" && tier.trim() ? tier.trim() : "standard-compute",
      region: "cdg-1 (Paris)",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Resource provisioned successfully.",
        data: createdResource,
      },
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          "x-jetway-resource-id": createdResource.id,
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
