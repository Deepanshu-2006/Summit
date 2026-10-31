import { Suspense } from "react";
import { Metadata } from "next";
import { InfrastructureCanvas } from "@/components/canvas/infrastructure-canvas";

export const metadata: Metadata = {
  title: "Summit Infrastructure Canvas",
  description:
    "Interactive node-based infrastructure canvas for building, configuring, and orchestrating cloud services on Summit.",
};

export default function NewProjectCanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-[#0C0B0A] flex items-center justify-center text-[#8E8C86] font-mono text-[13px]">
          Loading canvas...
        </div>
      }
    >
      <InfrastructureCanvas />
    </Suspense>
  );
}
