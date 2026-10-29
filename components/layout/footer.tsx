import React from "react";
import Link from "next/link";
import { ArrowUp, ExternalLink } from "lucide-react";
import { BRAND } from "@/lib/brand";

const CURRENT_YEAR = 2026;

function SummitLogo({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* West Ascent Blade (Muted Graphite) */}
      <path
        d="M3 20L9 8H12.5L6.5 20H3Z"
        fill="#B0B0AE"
        fillOpacity="0.45"
      />
      {/* Main Summit Spire with Archway Base (Burnt Orange) */}
      <path
        d="M9.5 20L15.5 3.5L21.5 20H17.5L15.5 13L13.5 20H9.5Z"
        fill="#D88762"
      />
      {/* High Snowline Glacial Apex (Warm Ivory) */}
      <path
        d="M15.5 3.5L17.5 9H13.5L15.5 3.5Z"
        fill="#F5F5F3"
      />
    </svg>
  );
}

export function Footer() {
  return (
    <footer
      className="w-full bg-[#111111] border-t border-border-subtle/80 text-text-primary pt-14 pb-12 sm:pt-16 sm:pb-14 select-none relative z-30"
      role="contentinfo"
      aria-label="Site footer"
    >
      <div className="layout-container w-full">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-14 pb-12 sm:pb-16 border-b border-border-subtle/60">
          
          {/* Brand Column (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px]"
              aria-label="Summit home"
            >
              <SummitLogo className="w-5 h-5 shrink-0" />
              <span className="text-[20px] font-semibold text-[#F5F5F3] tracking-[-0.02em] font-sans">
                {BRAND.name}
              </span>
            </Link>

            <p className="font-sans text-[14px] text-text-muted leading-relaxed max-w-sm">
              Developer infrastructure for getting from code to production.
            </p>

            <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-text-muted">
              <span className="w-2 h-2 rounded-full bg-semantic-success" />
              <span className="text-text-secondary">All systems operational</span>
              <span>•</span>
              <span>v1.4.2</span>
            </div>
          </div>

          {/* Product Navigation Anchors (4 cols) */}
          <div className="md:col-span-4 space-y-3">
            <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Platform & Features
            </h3>
            <ul className="space-y-2 list-none p-0 m-0 font-sans text-[13.5px]">
              <li>
                <Link
                  href="#deployment-experience"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Deployment Pipeline
                </Link>
              </li>
              <li>
                <Link
                  href="#product-experience"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Product Experience
                </Link>
              </li>
              <li>
                <Link
                  href="#platform-stack"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Application Stack
                </Link>
              </li>
              <li>
                <Link
                  href="#developer-experience"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Developer Experience
                </Link>
              </li>
              <li>
                <Link
                  href="#production-visibility"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Production Visibility
                </Link>
              </li>
              <li>
                <Link
                  href="#getting-started"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Getting Started Journey
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources & Open Source (3 cols) */}
          <div className="md:col-span-3 space-y-3">
            <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted">
              Source & Architecture
            </h3>
            <ul className="space-y-2 list-none p-0 m-0 font-sans text-[13.5px]">
              <li>
                <Link
                  href="https://github.com/Deepanshu-2006/jetway"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-text-secondary hover:text-accent-orange transition-colors"
                >
                  <span>GitHub Repository</span>
                  <ExternalLink className="w-3 h-3 text-text-muted" />
                </Link>
              </li>
              <li>
                <Link
                  href="#platform-stack"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Service Topology Model
                </Link>
              </li>
              <li>
                <Link
                  href="#final-cta"
                  className="text-text-secondary hover:text-text-primary transition-colors"
                >
                  Release Roadmap
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Back to Top */}
        <div className="pt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-[11px] text-text-muted">
          <div>
            © {CURRENT_YEAR} {BRAND.name}. All rights reserved.
          </div>

          <div className="flex items-center gap-6">
            <span className="text-text-muted">Built for code in motion</span>
            <Link
              href="#"
              className="inline-flex items-center gap-1.5 text-text-secondary hover:text-accent-orange transition-colors"
              aria-label="Back to top"
            >
              <span>Back to top</span>
              <ArrowUp className="w-3 h-3" />
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}

export default Footer;
