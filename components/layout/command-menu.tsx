"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Search,
  Terminal,
  Cpu,
  Database,
  Layers,
  BookOpen,
  Activity,
  ArrowRight,
  X,
  Zap,
} from "lucide-react";
import { BRAND } from "@/lib/brand";

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const COMMAND_ITEMS: CommandItem[] = [
  // Quick Actions
  {
    id: "action-deploy",
    title: "New Deployment",
    subtitle: "Push repository to global edge containers",
    category: "Quick Actions",
    href: BRAND.links.signup,
    icon: Zap,
    badge: "Action",
  },
  {
    id: "action-docs",
    title: "Open Documentation",
    subtitle: "Guides, CLI reference, and architecture recipes",
    category: "Quick Actions",
    href: BRAND.links.docs,
    icon: BookOpen,
  },
  {
    id: "action-status",
    title: "System Status & Edge Health",
    subtitle: "Real-time telemetry and regional latency",
    category: "Quick Actions",
    href: "/status",
    icon: Activity,
    badge: "99.99%",
  },

  // Products
  {
    id: "prod-deployments",
    title: "Instant Deployments",
    subtitle: "Zero-config Git push to globally distributed containers",
    category: "Products & Compute",
    href: "/product/deployments",
    icon: Terminal,
    badge: "v2.4",
  },
  {
    id: "prod-gpus",
    title: "Serverless GPUs",
    subtitle: "On-demand H100 & A100 inference with fast cold starts",
    category: "Products & Compute",
    href: "/product/gpus",
    icon: Cpu,
    badge: "GPU",
  },
  {
    id: "prod-microservices",
    title: "Microservices & RPC Mesh",
    subtitle: "Encrypted private mesh networking with internal DNS",
    category: "Products & Compute",
    href: "/product/microservices",
    icon: Layers,
  },
  {
    id: "prod-postgres",
    title: "Managed Postgres",
    subtitle: "Autoscaling relational databases with point-in-time recovery",
    category: "Products & Compute",
    href: "/product/postgres",
    icon: Database,
  },

  // Solutions
  {
    id: "sol-fullstack",
    title: "Full-Stack Web Applications",
    subtitle: "Optimized runtime for Next.js, Remix, Astro, and SvelteKit",
    category: "Solutions",
    href: "/solutions/full-stack",
    icon: Layers,
  },
  {
    id: "sol-ai",
    title: "AI & Model Serving",
    subtitle: "Run custom PyTorch, vLLM, and Ollama inference endpoints",
    category: "Solutions",
    href: "/solutions/ai-inference",
    icon: Cpu,
  },
  {
    id: "sol-platform",
    title: "Platform Engineering",
    subtitle: "Self-service internal developer platforms with RBAC",
    category: "Solutions",
    href: "/solutions/platform-engineering",
    icon: Terminal,
  },
];

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandMenu({ isOpen, onClose }: CommandMenuProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items based on query
  const filtered = COMMAND_ITEMS.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const activeIndex = selectedIndex < filtered.length ? selectedIndex : 0;

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  // Keyboard navigation inside menu
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? Math.max(0, filtered.length - 1) : prev - 1
        );
      } else if (e.key === "Enter" && filtered[activeIndex]) {
        e.preventDefault();
        window.location.href = filtered[activeIndex].href;
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filtered, activeIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>("[data-active='true']");
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command search"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 sm:px-6"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-[580px] bg-[#161615]/98 border border-[#30302E] rounded-[12px] shadow-2xl shadow-black/80 overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#2B2B28]">
          <Search className="w-4 h-4 text-[#8E8C86] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search platform features..."
            className="w-full bg-transparent text-[14px] text-[#F5F5F3] placeholder-[#777570] focus:outline-none font-sans"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedIndex(0);
              }}
              className="text-[#8E8C86] hover:text-[#F5F5F3] p-1 rounded hover:bg-[#252523]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="text-[10.5px] font-mono px-1.5 py-0.5 rounded bg-[#242422] border border-[#343431] text-[#8E8C86]">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 divide-y divide-[#242422]/60"
        >
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[#777570] font-sans">
              No matching commands or features found for &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === activeIndex;
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  data-active={isSelected}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`group flex items-center justify-between p-2.5 rounded-[8px] transition-all duration-100 ${
                    isSelected
                      ? "bg-[#242422] text-[#F5F5F3]"
                      : "text-[#B0B0AE] hover:bg-[#1E1E1C]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-[6px] flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-accent-orange/15 text-accent-orange"
                          : "bg-[#20201E] text-[#8E8C86] group-hover:text-[#F5F5F3]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[13px] font-medium truncate ${
                            isSelected ? "text-[#F5F5F3]" : "text-[#D5D4CF]"
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.badge && (
                          <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-accent-orange/10 border border-accent-orange/25 text-accent-orange">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#777570] truncate mt-0.5">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#666460]">
                      {item.category}
                    </span>
                    <ArrowRight
                      className={`w-3.5 h-3.5 transition-transform ${
                        isSelected
                          ? "text-accent-orange translate-x-0.5"
                          : "text-transparent"
                      }`}
                    />
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2 bg-[#121211] border-t border-[#262624] flex items-center justify-between text-[11px] font-mono text-[#777570]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#20201E] border border-[#2D2D2A] text-[9.5px]">
                ↑↓
              </kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#20201E] border border-[#2D2D2A] text-[9.5px]">
                ↵
              </kbd>
              <span>select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-[#20201E] border border-[#2D2D2A] text-[9.5px]">
                esc
              </kbd>
              <span>close</span>
            </span>
          </div>
          <span className="text-[10.5px] text-[#8E8C86]">
            Jetway Edge Network
          </span>
        </div>
      </div>
    </div>
  );
}
