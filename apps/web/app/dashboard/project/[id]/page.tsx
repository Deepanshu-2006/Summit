import { Metadata } from "next";
import { InfrastructureCanvas } from "@/components/canvas/infrastructure-canvas";

export const metadata: Metadata = {
  title: "Summit Infrastructure Canvas — Project Architecture",
  description:
    "Interactive node-based infrastructure canvas for building, configuring, and orchestrating cloud services on Summit.",
};

export default function ProjectCanvasPage() {
  return <InfrastructureCanvas />;
}

