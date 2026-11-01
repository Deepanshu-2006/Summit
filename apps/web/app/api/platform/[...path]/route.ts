import { NextResponse } from "next/server";

const localBackendURL = "http://127.0.0.1:4000";
const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

async function forward(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendBaseURL =
    process.env.PLATFORM_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === "development" ? localBackendURL : undefined);
  if (!backendBaseURL) {
    return NextResponse.json(
      { error: "Backend API URL is not configured" },
      { status: 503 },
    );
  }

  try {
    const { path } = await context.params;
    if (path.length === 0 || path[0] !== "v1") {
      return NextResponse.json({ error: "Invalid API path" }, { status: 404 });
    }

    const backendURL = new URL(
      `/${path.map((segment) => encodeURIComponent(segment)).join("/")}`,
      backendBaseURL,
    );
    backendURL.search = new URL(request.url).search;

    const headers = new Headers({ Authorization: authorization });
    const contentType = request.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const idempotencyKey = request.headers.get("idempotency-key");
    if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);

    const response = await fetch(backendURL, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });
    const responseHeaders = new Headers();
    const responseType = response.headers.get("content-type");
    if (responseType) responseHeaders.set("content-type", responseType);
    responseHeaders.set("cache-control", "no-store");

    return new Response(await response.arrayBuffer(), {
      status: response.status,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "Backend API is unavailable" },
      { status: 503 },
    );
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: methods.join(", ") } });
}
