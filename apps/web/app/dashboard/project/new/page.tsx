import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";

export const metadata: Metadata = {
  title: "New Project · Summit",
  description:
    "Start building your cloud architecture on Summit from a GitHub repository, database, Docker image, or clean canvas.",
};

export default function NewProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-[#0A0A09] flex items-center justify-center text-[#8E8C86] font-mono text-[13px]">
          Loading...
        </div>
      }
    >
      <DashboardScreen initialNewProject={true} />
    </Suspense>
  );
}
