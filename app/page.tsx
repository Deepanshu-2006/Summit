import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { MountainTrail } from "@/components/home/mountain-trail";
import { Hero } from "@/components/home/hero";
import { DeploymentExperience } from "@/components/home/deployment-experience";
import { ProductExperience } from "@/components/home/product-experience";
import { ApplicationStack } from "@/components/home/application-stack";
import { DeveloperExperience } from "@/components/home/developer-experience";
import { ProductionVisibility } from "@/components/home/production-visibility";
import { GettingStarted } from "@/components/home/getting-started";
import { FinalCta } from "@/components/home/final-cta";
import { AmbientBackground } from "@/components/layout/ambient-background";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-main text-text-primary selection:bg-accent-orange/25 selection:text-text-primary relative">
      <AmbientBackground />
      <Navbar />
      <main className="flex-1 flex flex-col relative z-10">
        <MountainTrail />
        <Hero />
        <DeploymentExperience />
        <ProductExperience />
        <ApplicationStack />
        <DeveloperExperience />
        <ProductionVisibility />
        <GettingStarted />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
