import { Navbar } from "@/components/layout/navbar";
import { Hero } from "@/components/home/hero";
import { DeploymentExperience } from "@/components/home/deployment-experience";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-main text-text-primary selection:bg-accent-orange/25 selection:text-text-primary">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Hero />
        <DeploymentExperience />
      </main>
    </div>
  );
}
