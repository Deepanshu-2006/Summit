import { Suspense } from "react";
import { Metadata } from "next";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";

export const metadata: Metadata = {
  title: "Projects · Summit Cloud Infrastructure",
  description: "Your projects, services, and infrastructure in one place.",
};

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen bg-[#0C0B0A] flex items-center justify-center text-[#8E8C86] font-mono text-[13px]">
          Loading dashboard...
        </div>
      }
    >
      <DashboardScreen />
    </Suspense>
  );
}

