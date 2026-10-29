"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Menu,
  X,
  Search,
  Terminal,
  Cpu,
  Database,
  Layers,
  BookOpen,
  Activity,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BRAND, NAV_DROPDOWNS, type NavDropdownItem } from "@/lib/brand";
import { CommandMenu } from "@/components/layout/command-menu";

/**
 * Geometric Brand Logo Mark for Jetway
 * Custom forward-facing dual vector blades suggesting supersonic velocity and precision
 */
function JetwayLogo({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Trailing guide blade in muted tone */}
      <path
        d="M3 4.5L10.5 12L3 19.5H7.5L15 12L7.5 4.5H3Z"
        fill="#B0B0AE"
        fillOpacity="0.45"
      />
      {/* Leading supersonic speed blade in burnt orange */}
      <path
        d="M10 4.5L17.5 12L10 19.5H14.5L22 12L14.5 4.5H10Z"
        fill="#D88762"
      />
    </svg>
  );
}

/**
 * Section icon helper mapping title to appropriate iconography
 */
function getSectionIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("compute") || t.includes("deploy")) return Terminal;
  if (t.includes("data") || t.includes("storage")) return Database;
  if (t.includes("use case") || t.includes("solutions")) return Layers;
  if (t.includes("team") || t.includes("platform") || t.includes("workflow")) return Cpu;
  if (t.includes("learn") || t.includes("build") || t.includes("doc")) return BookOpen;
  if (t.includes("trust") || t.includes("status")) return Activity;
  return Terminal;
}

/**
 * Shared Desktop Dropdown Menu Panel
 */
interface DropdownPanelProps {
  dropdown: NavDropdownItem;
  isOpen: boolean;
  onClose: () => void;
  panelId: string;
}

function DropdownPanel({ dropdown, isOpen, onClose, panelId }: DropdownPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={panelId}
          role="region"
          aria-label={`${dropdown.label} sub-navigation`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50 w-[580px] pointer-events-auto"
        >
          <div className="relative bg-[#161615]/96 border border-[#2E2E2C] rounded-[10px] shadow-2xl shadow-black/70 p-5 overflow-hidden backdrop-blur-xl before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-accent-orange/35 before:to-transparent">
            <div className="grid grid-cols-2 gap-6">
              {dropdown.sections.map((section, sIdx) => {
                const SectionIcon = getSectionIcon(section.title);
                return (
                  <div key={sIdx} className="space-y-2.5">
                    <div className="flex items-center gap-1.5 px-2">
                      <SectionIcon className="w-3.5 h-3.5 text-accent-orange/80" />
                      <h4 className="font-mono uppercase text-text-muted tracking-wider text-[10.5px] font-medium">
                        {section.title}
                      </h4>
                    </div>
                    <ul className="space-y-0.5 list-none p-0 m-0">
                      {section.items.map((item, iIdx) => (
                        <li key={iIdx}>
                          <Link
                            href={item.href}
                            onClick={onClose}
                            className="group block p-2 rounded-[7px] hover:bg-[#222220] transition-colors duration-[150ms] focus-visible:outline-2 focus-visible:outline-accent-orange"
                          >
                            <div className="text-[13px] font-medium text-[#F5F5F3] group-hover:text-accent-orange transition-colors duration-[150ms] flex items-center justify-between">
                              <span>{item.label}</span>
                              <ArrowRight className="w-3 h-3 text-transparent group-hover:text-accent-orange transition-all -translate-x-1 group-hover:translate-x-0 opacity-0 group-hover:opacity-100" />
                            </div>
                            <p className="text-[11.5px] text-text-muted group-hover:text-[#A0A09C] mt-0.5 leading-snug line-clamp-1 transition-colors duration-[150ms]">
                              {item.description}
                            </p>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* Optional Featured Callout */}
            {dropdown.featured && (
              <div className="mt-4 pt-3.5 border-t border-[#2B2B28] flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-accent-orange/15 border border-accent-orange/30 text-accent-orange font-mono text-[9.5px] font-medium">
                    {dropdown.featured.tag}
                  </span>
                  <span className="text-[12px] font-medium text-[#F5F5F3]">
                    {dropdown.featured.title}
                  </span>
                  <span className="text-[11.5px] text-text-muted hidden sm:inline">
                    — {dropdown.featured.description}
                  </span>
                </div>
                <Link
                  href={dropdown.featured.href}
                  onClick={onClose}
                  className="text-[12px] font-medium text-text-secondary hover:text-accent-orange transition-colors duration-[150ms] shrink-0 flex items-center gap-1"
                >
                  <span>Explore</span>
                  <span>→</span>
                </Link>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Mobile Drawer Menu
 */
interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSearch: () => void;
}

function MobileMenu({ isOpen, onClose, onOpenSearch }: MobileMenuProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("product");

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="mobile-navigation"
          data-lenis-prevent
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation menu"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="fixed inset-x-0 top-[72px] bottom-0 bg-[#111111]/98 backdrop-blur-xl z-40 lg:hidden overflow-y-auto border-t border-[#2B2B28] flex flex-col justify-between p-5"
        >
          <div className="space-y-3">
            {/* Mobile Search Button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSearch();
              }}
              className="w-full flex items-center justify-between h-[38px] px-3 rounded-[7px] bg-[#1A1A18] border border-[#2F2F2C] text-[#8E8C86] text-[13px] font-sans"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-accent-orange" />
                <span>Search docs & platform...</span>
              </div>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#242422] border border-[#343431] text-[#8E8C86]">
                ⌘K
              </kbd>
            </button>

            {/* Mobile Nav Accordion Links */}
            <div className="space-y-1 pt-2">
              {NAV_DROPDOWNS.map((item) => {
                const isExpanded = expandedSection === item.id;
                return (
                  <div key={item.id} className="border-b border-[#282826] pb-2">
                    <button
                      type="button"
                      onClick={() => toggleSection(item.id)}
                      aria-expanded={isExpanded}
                      className="w-full flex items-center justify-between py-2.5 text-[15px] font-medium text-[#F5F5F3] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px] text-left"
                    >
                      <span>{item.label}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#8E8C86] transition-transform duration-[160ms] ${
                          isExpanded ? "rotate-180 text-accent-orange" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="pl-2 space-y-3 pt-1 pb-2 overflow-hidden"
                        >
                          {item.sections.map((section, sIdx) => {
                            const SectionIcon = getSectionIcon(section.title);
                            return (
                              <div key={sIdx} className="space-y-1">
                                <span className="flex items-center gap-1.5 font-mono text-[9.5px] text-accent-orange/90 uppercase tracking-wider">
                                  <SectionIcon className="w-3 h-3" />
                                  <span>{section.title}</span>
                                </span>
                                {section.items.map((subItem, subIdx) => (
                                  <Link
                                    key={subIdx}
                                    href={subItem.href}
                                    onClick={onClose}
                                    className="block py-1.5 text-[13px] text-[#A0A09C] hover:text-[#F5F5F3] transition-colors duration-[150ms] focus-visible:outline-accent-orange"
                                  >
                                    {subItem.label}
                                  </Link>
                                ))}
                              </div>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Direct Pricing Link */}
              <div className="border-b border-[#282826] py-2.5">
                <Link
                  href={BRAND.links.pricing}
                  onClick={onClose}
                  className="block text-[15px] font-medium text-[#F5F5F3] hover:text-accent-orange transition-colors duration-[150ms]"
                >
                  Pricing
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-5 border-t border-[#282826] space-y-3 mt-4">
            <div className="flex items-center justify-between gap-4">
              <Link
                href={BRAND.links.docs}
                onClick={onClose}
                className="text-[13px] font-medium text-[#A0A09C] hover:text-[#F5F5F3] transition-colors duration-[150ms]"
              >
                Documentation
              </Link>
              <Link
                href={BRAND.links.login}
                onClick={onClose}
                className="text-[13px] font-medium text-[#A0A09C] hover:text-[#F5F5F3] transition-colors duration-[150ms]"
              >
                Sign in
              </Link>
            </div>

            <Link
              href={BRAND.links.signup}
              onClick={onClose}
              className="w-full h-[42px] px-4 rounded-[7px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[13.5px] font-semibold flex items-center justify-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition-colors duration-[150ms]"
            >
              <span>Get started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Main Navbar Component for Jetway
 * Integrates directly into the hero mountain backdrop with continuous transparency
 * at the top of the viewport, transitioning into frosted glassmorphism on scroll.
 */
export function Navbar() {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const navContainerRef = useRef<HTMLElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const baseId = useId();

  // Scroll detection for sticky navbar background/border transition
  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 16);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Global keyboard shortcut for Command/Search (Cmd+K / Ctrl+K)
  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        navContainerRef.current &&
        !navContainerRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    }
    if (activeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [activeDropdown]);

  // Handle Escape key to close active dropdown or mobile drawer
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (activeDropdown) {
          setActiveDropdown(null);
        }
        if (isMobileOpen) {
          setIsMobileOpen(false);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeDropdown, isMobileOpen]);

  // Dropdown hover helpers with slight exit debounce for effortless mouse traversal
  const handleMouseEnter = (id: string) => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setActiveDropdown(id);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 200);
  };

  const toggleDropdown = (id: string) => {
    setActiveDropdown((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <header
        ref={navContainerRef}
        className={`fixed top-0 left-0 right-0 z-50 w-full h-[72px] transition-all duration-300 select-none ${
          isScrolled || isMobileOpen
            ? "bg-[#111111]/88 border-b border-[#2B2B28] backdrop-blur-md shadow-lg shadow-black/40"
            : "bg-transparent border-b border-white/[0.05]"
        }`}
        style={{
          background:
            isScrolled || isMobileOpen
              ? undefined
              : "linear-gradient(to bottom, rgba(17, 17, 17, 0.45) 0%, rgba(17, 17, 17, 0.15) 60%, transparent 100%)",
        }}
      >
        <div className="layout-container h-full flex items-center justify-between">
          {/* =============================================================
              LEFT: Brand Lockup & System Status Beacon
              ============================================================= */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href={BRAND.links.home}
              className="group flex items-center gap-[10px] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px]"
              aria-label={`${BRAND.name} home`}
            >
              <div className="transition-transform duration-200 group-hover:scale-105">
                <JetwayLogo className="w-5 h-5 shrink-0" />
              </div>
              <span className="text-[20px] font-semibold text-[#F5F5F3] tracking-[-0.025em] font-sans lowercase">
                {BRAND.name}
              </span>
            </Link>

            {/* Edge Network Live Indicator Pill */}
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#1A1A18]/80 border border-[#2E2E2A] text-[10.5px] font-mono text-text-muted hover:border-accent-orange/40 transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-semantic-success animate-pulse" />
              <span>v2.4 · live</span>
            </div>
          </div>

          {/* =============================================================
              CENTER: Primary Desktop Navigation (>= 1024px)
              Effortless hover + click toggle with smooth glass cards
              ============================================================= */}
          <nav
            className="hidden lg:flex items-center gap-7 relative"
            aria-label="Main Navigation"
          >
            {NAV_DROPDOWNS.map((dropdown) => {
              const isOpen = activeDropdown === dropdown.id;
              const panelId = `${baseId}-dropdown-${dropdown.id}`;
              const buttonId = `${baseId}-trigger-${dropdown.id}`;

              return (
                <div
                  key={dropdown.id}
                  className="relative"
                  onMouseEnter={() => handleMouseEnter(dropdown.id)}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    id={buttonId}
                    type="button"
                    onClick={() => toggleDropdown(dropdown.id)}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    aria-controls={panelId}
                    className={`inline-flex items-center gap-1.5 py-1.5 text-[13.5px] font-medium transition-colors duration-[150ms] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px] ${
                      isOpen
                        ? "text-[#F5F5F3]"
                        : "text-[#B0B0AE] hover:text-[#F5F5F3]"
                    }`}
                  >
                    <span>{dropdown.label}</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-[160ms] text-text-muted ${
                        isOpen ? "rotate-180 text-accent-orange" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {/* Dropdown Card */}
                  <DropdownPanel
                    dropdown={dropdown}
                    isOpen={isOpen}
                    onClose={() => setActiveDropdown(null)}
                    panelId={panelId}
                  />
                </div>
              );
            })}

            {/* Direct Pricing Link */}
            <Link
              href={BRAND.links.pricing}
              className="text-[13.5px] font-medium text-[#B0B0AE] hover:text-[#F5F5F3] transition-colors duration-[150ms] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px]"
            >
              Pricing
            </Link>
          </nav>

          {/* =============================================================
              RIGHT: Global Search, Documentation, Sign In & Primary CTA
              ============================================================= */}
          <div className="hidden lg:flex items-center gap-4 shrink-0">
            {/* Quick Command / Search Trigger (⌘K) */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search documentation and platform features (Cmd+K)"
              className="inline-flex items-center gap-2 h-[34px] px-2.5 rounded-[6px] bg-[#181816]/70 hover:bg-[#222220] border border-[#2D2D2A] hover:border-[#42423E] text-text-muted hover:text-[#F5F5F3] text-[12px] font-mono transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent-orange"
            >
              <Search className="w-3.5 h-3.5 text-text-muted" />
              <span>Search...</span>
              <kbd className="text-[10px] bg-[#242422] px-1.5 py-0.5 rounded border border-[#363632] text-text-muted font-sans font-medium">
                ⌘K
              </kbd>
            </button>

            <Link
              href={BRAND.links.docs}
              className="text-[13px] font-medium text-[#B0B0AE] hover:text-[#F5F5F3] transition-colors duration-[150ms] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px]"
            >
              Docs
            </Link>

            <Link
              href={BRAND.links.login}
              className="text-[13px] font-medium text-[#B0B0AE] hover:text-[#F5F5F3] transition-colors duration-[150ms] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px]"
            >
              Sign in
            </Link>

            <Link
              href={BRAND.links.signup}
              className="group inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-[7px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[13px] font-semibold transition-all duration-[150ms] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] focus-visible:outline-2 focus-visible:outline-accent-orange focus-visible:outline-offset-2"
            >
              <span>Get started</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* =============================================================
              TABLET / MOBILE RIGHT CONTROLS (< 1024px)
              ============================================================= */}
          <div className="flex lg:hidden items-center gap-2.5">
            {/* Search icon trigger on mobile */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              aria-label="Search"
              className="inline-flex items-center justify-center w-9 h-9 rounded-[7px] text-[#B0B0AE] hover:text-[#F5F5F3] hover:bg-[#1D1D1B] border border-[#2E2E2A] transition-colors duration-[150ms]"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Primary CTA on tablets (>= 640px) */}
            <Link
              href={BRAND.links.signup}
              className="hidden sm:inline-flex items-center justify-center h-[36px] px-3.5 rounded-[7px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[12.5px] font-semibold transition-colors duration-[150ms] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
            >
              Get started
            </Link>

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMobileOpen((prev) => !prev)}
              aria-expanded={isMobileOpen}
              aria-controls="mobile-navigation"
              aria-label={isMobileOpen ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex items-center justify-center w-9 h-9 rounded-[7px] text-[#B0B0AE] hover:text-[#F5F5F3] hover:bg-[#1D1D1B] border border-[#2E2E2A] transition-colors duration-[150ms] focus-visible:outline-2 focus-visible:outline-accent-orange"
            >
              {isMobileOpen ? (
                <X className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Menu className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        <MobileMenu
          isOpen={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          onOpenSearch={() => setIsSearchOpen(true)}
        />
      </header>

      {/* Global Interactive Command / Search Palette (⌘K) */}
      <CommandMenu
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}

export default Navbar;
