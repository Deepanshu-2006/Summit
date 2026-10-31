import { NextResponse } from "next/server";

const localBackendURL = "http://127.0.0.1:4000";

export async function POST(request: Request) {
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
    const backendURL = new URL("/v1/auth/profile", backendBaseURL);
    const backendResponse = await fetch(backendURL, {
      method: "POST",
      headers: { Authorization: authorization },
      cache: "no-store",
    });

    if (!backendResponse.ok) {
      return NextResponse.json(
        { error: "Profile sync failed" },
        { status: backendResponse.status },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "Backend API is unavailable" },
      { status: 503 },
    );
  }
}
