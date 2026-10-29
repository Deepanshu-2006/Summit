"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BRAND, NAV_DROPDOWNS, type NavDropdownItem } from "@/lib/brand";

/**
 * Geometric Brand Logo Mark for jetway
 * Custom forward-facing dual vector blades suggesting speed, velocity, and precision
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
        fillOpacity="0.4"
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
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 3 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="absolute top-full left-1/2 -translate-x-1/2 pt-3 z-50 w-[560px] pointer-events-auto"
        >
          <div className="bg-[#1D1D1D] border border-[#303030] rounded-[9px] shadow-xl shadow-black/40 p-5 overflow-hidden">
            <div className="grid grid-cols-2 gap-6">
              {dropdown.sections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-2.5">
                  <h4 className="type-meta font-mono uppercase text-text-muted tracking-wider text-[11px] font-medium px-2">
                    {section.title}
                  </h4>
                  <ul className="space-y-0.5 list-none p-0 m-0">
                    {section.items.map((item, iIdx) => (
                      <li key={iIdx}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className="group block p-2 rounded-[6px] hover:bg-[#252525] transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange"
                        >
                          <div className="text-[13.5px] font-medium text-[#F5F5F3] group-hover:text-accent-orange transition-colors duration-[160ms]">
                            {item.label}
                          </div>
                          <p className="text-[12px] text-text-muted group-hover:text-text-secondary mt-0.5 leading-snug line-clamp-1 transition-colors duration-[160ms]">
                            {item.description}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Optional Featured Callout */}
            {dropdown.featured && (
              <div className="mt-4 pt-3.5 border-t border-[#303030]/60 flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded-[4px] bg-accent-orange/15 border border-accent-orange/30 text-accent-orange font-mono text-[10px] font-medium">
                    {dropdown.featured.tag}
                  </span>
                  <span className="text-[12px] font-medium text-[#F5F5F3]">
                    {dropdown.featured.title}
                  </span>
                  <span className="text-[12px] text-text-muted hidden sm:inline">
                    — {dropdown.featured.description}
                  </span>
                </div>
                <Link
                  href={dropdown.featured.href}
                  onClick={onClose}
                  className="text-[12px] font-medium text-text-secondary hover:text-accent-orange transition-colors duration-[160ms] shrink-0"
                >
                  Explore →
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
}

function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
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
          className="fixed inset-x-0 top-[72px] bottom-0 bg-[#111111]/98 backdrop-blur-md z-40 lg:hidden overflow-y-auto border-t border-[#303030] flex flex-col justify-between p-5"
        >
          {/* Mobile Links */}
          <div className="space-y-2">
            {NAV_DROPDOWNS.map((item) => {
              const isExpanded = expandedSection === item.id;
              return (
                <div
                  key={item.id}
                  className="border-b border-[#303030]/50 pb-2"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(item.id)}
                    aria-expanded={isExpanded}
                    className="w-full flex items-center justify-between py-2.5 text-[15px] font-medium text-[#F5F5F3] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px] text-left"
                  >
                    <span>{item.label}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#B0B0AE] transition-transform duration-[160ms] ${
                        isExpanded ? "rotate-180 text-[#F5F5F3]" : ""
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
                        {item.sections.map((section, sIdx) => (
                          <div key={sIdx} className="space-y-1">
                            <span className="type-meta font-mono text-[10px] text-text-muted uppercase tracking-wider block">
                              {section.title}
                            </span>
                            {section.items.map((subItem, subIdx) => (
                              <Link
                                key={subIdx}
                                href={subItem.href}
                                onClick={onClose}
                                className="block py-1.5 text-[13px] text-[#B0B0AE] hover:text-[#F5F5F3] transition-colors duration-[160ms] focus-visible:outline-accent-orange"
                              >
                                {subItem.label}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {/* Direct Pricing Link */}
            <div className="border-b border-[#303030]/50 py-2.5">
              <Link
                href={BRAND.links.pricing}
                onClick={onClose}
                className="block text-[15px] font-medium text-[#F5F5F3] hover:text-accent-orange transition-colors duration-[160ms]"
              >
                Pricing
              </Link>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="pt-6 border-t border-[#303030] space-y-3 mt-4">
            <div className="flex items-center justify-between gap-4">
              <Link
                href={BRAND.links.docs}
                onClick={onClose}
                className="text-[13px] font-medium text-[#B0B0AE] hover:text-[#F5F5F3] transition-colors duration-[160ms]"
              >
                Documentation
              </Link>
              <Link
                href={BRAND.links.login}
                onClick={onClose}
                className="text-[13px] font-medium text-[#B0B0AE] hover:text-[#F5F5F3] transition-colors duration-[160ms]"
              >
                Sign in
              </Link>
            </div>

            <Link
              href={BRAND.links.signup}
              onClick={onClose}
              className="w-full h-[40px] px-4 rounded-[7px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[13px] font-semibold flex items-center justify-center transition-colors duration-[160ms]"
            >
              Get started
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Main Navbar Component for jetway
 */
export function Navbar() {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navContainerRef = useRef<HTMLElement>(null);
  const baseId = useId();

  // Scroll detection for sticky navbar background/border transition
  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 8);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
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

  const toggleDropdown = (id: string) => {
    setActiveDropdown((prev) => (prev === id ? null : id));
  };

  return (
    <header
      ref={navContainerRef}
      className={`sticky top-0 z-50 w-full h-[72px] transition-colors duration-[160ms] select-none ${
        isScrolled || isMobileOpen
          ? "bg-[#111111]/95 border-b border-[#303030] backdrop-blur-sm"
          : "bg-[#111111] border-b border-transparent"
      }`}
    >
      <div className="layout-container h-full flex items-center justify-between">
        {/* LEFT: Brand Lockup */}
        <div className="flex items-center shrink-0">
          <Link
            href={BRAND.links.home}
            className="flex items-center gap-[11px] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px]"
            aria-label={`${BRAND.name} home`}
          >
            <JetwayLogo className="w-5 h-5 shrink-0" />
            <span className="text-[20px] font-semibold text-[#F5F5F3] tracking-[-0.02em] font-sans lowercase">
              {BRAND.name}
            </span>
          </Link>
        </div>

        {/* CENTER: Primary Navigation (Desktop >= 1024px) */}
        <nav
          className="hidden lg:flex items-center gap-8 relative"
          aria-label="Main Navigation"
        >
          {NAV_DROPDOWNS.map((dropdown) => {
            const isOpen = activeDropdown === dropdown.id;
            const panelId = `${baseId}-dropdown-${dropdown.id}`;
            const buttonId = `${baseId}-trigger-${dropdown.id}`;

            return (
              <div key={dropdown.id} className="relative">
                <button
                  id={buttonId}
                  type="button"
                  onClick={() => toggleDropdown(dropdown.id)}
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  aria-controls={panelId}
                  className={`inline-flex items-center gap-1.5 text-[13.5px] font-medium transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px] ${
                    isOpen
                      ? "text-[#F5F5F3]"
                      : "text-[#B0B0AE] hover:text-[#F5F5F3]"
                  }`}
                >
                  <span>{dropdown.label}</span>
                  <ChevronDown
                    className={`w-3 h-3 transition-transform duration-[160ms] text-text-muted ${
                      isOpen ? "rotate-180 text-[#F5F5F3]" : ""
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
            className="text-[13.5px] font-medium text-[#B0B0AE] hover:text-[#F5F5F3] transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px]"
          >
            Pricing
          </Link>
        </nav>

        {/* RIGHT: Account Actions (Desktop >= 1024px) */}
        <div className="hidden lg:flex items-center gap-6 shrink-0">
          <Link
            href={BRAND.links.docs}
            className="text-[13px] font-medium text-[#B0B0AE] hover:text-[#F5F5F3] transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px]"
          >
            Documentation
          </Link>

          <Link
            href={BRAND.links.login}
            className="text-[13px] font-medium text-[#B0B0AE] hover:text-[#F5F5F3] transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px]"
          >
            Sign in
          </Link>

          <Link
            href={BRAND.links.signup}
            className="inline-flex items-center justify-center h-[40px] px-4 rounded-[7px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[13px] font-semibold transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange focus-visible:outline-offset-2"
          >
            Get started
          </Link>
        </div>

        {/* TABLET / MOBILE RIGHT CONTROLS (< 1024px) */}
        <div className="flex lg:hidden items-center gap-3">
          {/* Accessible primary CTA on tablets (>= 640px) */}
          <Link
            href={BRAND.links.signup}
            className="hidden sm:inline-flex items-center justify-center h-[38px] px-3.5 rounded-[7px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[13px] font-semibold transition-colors duration-[160ms]"
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
            className="inline-flex items-center justify-center w-9 h-9 rounded-[7px] text-[#B0B0AE] hover:text-[#F5F5F3] hover:bg-[#1D1D1D] border border-[#303030] transition-colors duration-[160ms] focus-visible:outline-2 focus-visible:outline-accent-orange"
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
      <MobileMenu isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)} />
    </header>
  );
}

export default Navbar;
