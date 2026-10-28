import { Navbar } from "@/components/layout/navbar";
import { StoryShell } from "@/components/home/story/story-shell";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-main text-text-primary selection:bg-accent-orange/25 selection:text-text-primary">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <StoryShell />
      </main>
    </div>
  );
}
