import { Metadata } from "next";
import { NewProjectScreen } from "@/components/project-new/new-project-screen";

export const metadata: Metadata = {
  title: "New Project — Summit",
  description:
    "Choose how to start your project: GitHub Repository, Database, Docker Image, or Empty Project on Summit.",
};

export default function NewProjectPage() {
  return <NewProjectScreen />;
}
