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
}

async function CanvasWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InfrastructureCanvas projectId={id} />;
}

export default function ProjectCanvasPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-[#0C0B0A] flex items-center justify-center text-[#8E8C86] font-mono text-[13px]">
          Loading canvas...
        </div>
      }
    >
      <CanvasWrapper params={params} />
    </Suspense>
  );
}
