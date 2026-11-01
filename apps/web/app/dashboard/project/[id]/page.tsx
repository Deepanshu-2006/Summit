import { Suspense } from "react";
import { Metadata } from "next";
import { InfrastructureCanvas } from "@/components/canvas/infrastructure-canvas";

export const metadata: Metadata = {
  title: "Summit Infrastructure Canvas — Project Architecture",
  description:
    "Interactive node-based infrastructure canvas for building, configuring, and orchestrating cloud services on Summit.",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ deploy?: string | string[] }>;
}

async function CanvasWrapper({
  params,
  searchParams,
}: Pick<PageProps, "params" | "searchParams">) {
  const { id } = await params;
  const { deploy } = await searchParams;
  return <InfrastructureCanvas projectId={id} autoOpenDeploy={deploy === "1"} />;
}

export default function ProjectCanvasPage({ params, searchParams }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-[#0C0B0A] flex items-center justify-center text-[#8E8C86] font-mono text-[13px]">
          Loading canvas...
        </div>
      }
    >
      <CanvasWrapper params={params} searchParams={searchParams} />
    </Suspense>
  );
}
