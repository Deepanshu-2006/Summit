import { redirect } from "next/navigation";

type GitHubCallbackPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GitHubCallbackPage({
  searchParams,
}: GitHubCallbackPageProps) {
  const params = await searchParams;
  const status = params.status === "success" ? "success" : "error";
  const query = new URLSearchParams({ github_setup: status });
  const errorCode = params.error_code;
  if (typeof errorCode === "string") query.set("github_error", errorCode);

  redirect(`/dashboard/project/new?${query.toString()}`);
}
