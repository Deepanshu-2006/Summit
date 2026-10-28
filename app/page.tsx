import { Navbar } from "@/components/layout/navbar";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-bg-main text-text-primary">
      <Navbar />

      <main className="layout-container flex-1 flex flex-col justify-center py-16">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-semantic-success" />
            <span className="type-meta text-text-muted font-mono tracking-wide uppercase">
              Environment Initialized
            </span>
          </div>

          <h1 className="type-page text-text-primary mb-3">
            Design Foundation
          </h1>

          <p className="type-body text-text-secondary mb-6">
            Space Grotesk typography, Geist Mono code metrics, and the Dark Slate + Soft White + Burnt Orange design tokens are active.
          </p>

          <div className="p-4 rounded-card bg-surface-card border border-border-subtle">
            <div className="flex items-center justify-between type-meta text-text-muted mb-2">
              <span>Identity Verification</span>
              <span className="font-mono text-accent-orange">READY</span>
            </div>
            <code className="type-code text-text-primary block font-mono">
              --bg-main: #121416; --text-primary: #F1F0EC; --accent: #D88762;
            </code>
          </div>
        </div>
      </main>
    </div>
  );
}
