import { Suspense } from "react";
import { Metadata } from "next";
import { NewProjectScreen } from "@/components/project-new/new-project-screen";

export const metadata: Metadata = {
  title: "New Project · Summit",
  description:
    "Start building your cloud architecture on Summit from a GitHub repository, database, Docker image, or clean canvas.",
};

export default function NewProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-[#0C0B0A] flex items-center justify-center text-[#8E8C86] font-mono text-[13px]">
          Loading...
        </div>
      }
    >
      <NewProjectScreen />
    </Suspense>
  );
}
