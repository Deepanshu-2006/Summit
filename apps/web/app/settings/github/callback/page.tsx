import { Suspense } from "react";
import { redirect } from "next/navigation";

type GitHubCallbackPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// `searchParams` is runtime data, so it must be read inside a Suspense boundary
// (Cache Components) rather than in the page component itself.
async function GitHubCallbackRedirect({
  searchParams,
}: GitHubCallbackPageProps): Promise<never> {
  const params = await searchParams;
  const status = params.status === "success" ? "success" : "error";
  const query = new URLSearchParams({ github_setup: status });
  const errorCode = params.error_code;
  if (typeof errorCode === "string") query.set("github_error", errorCode);

  redirect(`/dashboard/project/new?${query.toString()}`);
}

export default function GitHubCallbackPage({ searchParams }: GitHubCallbackPageProps) {
  return (
    <Suspense fallback={null}>
      <GitHubCallbackRedirect searchParams={searchParams} />
    </Suspense>
  );
}
