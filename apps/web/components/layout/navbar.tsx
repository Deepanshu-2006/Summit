"use client";

import React, { useState, useEffect, useRef, useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Menu, X, ArrowRight, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BRAND, NAV_DROPDOWNS, type NavDropdownItem } from "@/lib/brand";
import { usePreloader } from "@/components/layout/preloader-context";
import { useAuth } from "@/components/auth/auth-context";

/**
 * Geometric Brand Logo Mark for Summit
 * Dynamic ascending alpine spire with negative-space mountain chasm and razor-sharp snowline apex
 */
export function SummitLogo({ className = "w-5 h-5" }: { className?: string }) {
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
        fill="#8E8C86"
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

/**
 * Minimal Desktop Dropdown Panel
 * Compact, quiet, and typographic — free of AI template clutter, oversized cards, and badge spam.
 */
interface DropdownPanelProps {
  dropdown: NavDropdownItem;
  isOpen: boolean;
  onClose: () => void;
  panelId: string;
}

function DropdownPanel({ dropdown, isOpen, onClose, panelId }: DropdownPanelProps) {
  const alignClass =
    dropdown.id === "product"
      ? "left-0 sm:left-[-16px]"
      : dropdown.id === "resources"
      ? "right-0 sm:right-[-16px] left-auto"
      : "left-1/2 -translate-x-1/2";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id={panelId}
          role="region"
          aria-label={`${dropdown.label} sub-navigation`}
          initial={{ opacity: 0, y: 6, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.985 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className={`absolute top-full pt-2 z-50 w-[390px] pointer-events-auto ${alignClass}`}
        >
          <div className="bg-[#131312]/96 border border-[#262624] rounded-[10px] shadow-2xl shadow-black/80 p-3.5 backdrop-blur-xl">
            {/* Minimal 2-Column Grid */}
            <div className="grid grid-cols-2 gap-3">
              {dropdown.sections.map((section, sIdx) => (
                <div key={sIdx} className="space-y-0.5">
                  <span className="font-mono uppercase text-[#666460] tracking-wider text-[9.5px] px-2 mb-1 block font-medium">
                    {section.title}
                  </span>

                  <ul className="space-y-0.5 list-none p-0 m-0">
                    {section.items.map((item, iIdx) => (
                      <li key={iIdx}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className="group block px-2 py-1.5 rounded-[6px] hover:bg-[#1E1E1C] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-accent-orange"
                        >
                          <div className="text-[12.5px] font-medium text-[#ECEBE6] group-hover:text-accent-orange transition-colors">
                            {item.label}
                          </div>
                          <p className="text-[11px] text-[#7A7874] group-hover:text-[#9B9994] mt-0.5 leading-normal transition-colors">
                            {item.description}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Quiet, Single-Line Bottom Note */}
            {dropdown.featured && (
              <div className="mt-2.5 pt-2 border-t border-[#20201E] px-2 flex items-center justify-between text-[11px]">
                <span className="text-[#666460] truncate max-w-[260px]">
                  {dropdown.featured.title}
                </span>
                <Link
                  href={dropdown.featured.href}
                  onClick={onClose}
                  className="text-accent-orange hover:underline font-mono text-[10.5px] shrink-0 ml-2"
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
  const { user, openAuthModal, signOut } = useAuth();
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<string | null>("product");

  const handleSignIn = (e: React.MouseEvent) => {
    e.preventDefault();
    onClose();
    openAuthModal({ mode: "signin" });
  };

  const handleGetStarted = (e: React.MouseEvent) => {
    e.preventDefault();
    onClose();
    if (user) {
      router.push(BRAND.links.workspace);
    } else {
      openAuthModal({ mode: "signup", redirectTo: BRAND.links.workspace });
    }
  };

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? null : id));
  };

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
          className="fixed inset-x-0 top-[72px] bottom-0 bg-[#111111]/98 backdrop-blur-xl z-40 lg:hidden overflow-y-auto border-t border-[#262624] flex flex-col justify-between p-5"
        >
          {/* Mobile Nav Links */}
          <div className="space-y-1">
            {NAV_DROPDOWNS.map((item) => {
              const isExpanded = expandedSection === item.id;
              return (
                <div key={item.id} className="border-b border-[#222220] pb-2">
                  <button
                    type="button"
                    onClick={() => toggleSection(item.id)}
                    aria-expanded={isExpanded}
                    className="w-full flex items-center justify-between py-2 text-[14px] font-medium text-[#F5F5F3] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px] text-left"
                  >
                    <span>{item.label}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#7A7874] transition-transform duration-[160ms] ${
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
                        className="pl-2 space-y-2 pt-1 pb-2 overflow-hidden"
                      >
                        {item.sections.map((section, sIdx) => (
                          <div key={sIdx} className="space-y-1">
                            <span className="font-mono text-[9px] text-[#666460] uppercase tracking-wider block">
                              {section.title}
                            </span>
                            {section.items.map((subItem, subIdx) => (
                              <Link
                                key={subIdx}
                                href={subItem.href}
                                onClick={onClose}
                                className="block py-1 text-[12.5px] text-[#A0A09C] hover:text-[#F5F5F3] transition-colors duration-[150ms] focus-visible:outline-accent-orange"
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

            <div className="border-b border-[#222220] py-2">
              <Link
                href={BRAND.links.pricing}
                onClick={onClose}
                className="block text-[14px] font-medium text-[#F5F5F3] hover:text-accent-orange transition-colors duration-[150ms]"
              >
                Pricing
              </Link>
            </div>

            <div className="border-b border-[#222220] py-2">
              <Link
                href={BRAND.links.docs}
                onClick={onClose}
                className="block text-[14px] font-medium text-[#F5F5F3] hover:text-accent-orange transition-colors duration-[150ms]"
              >
                Documentation
              </Link>
            </div>
          </div>

          {/* Bottom Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#222220] mt-4">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  signOut();
                }}
                className="h-[40px] px-4 rounded-[7px] border border-[#3A3A38] bg-[#1E1E1C] hover:bg-[#282826] text-[#D77D7D] text-[13px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                className="h-[40px] px-4 rounded-[7px] border border-[#3A3A38] bg-[#1E1E1C] hover:bg-[#282826] text-[#F5F5F3] text-[13px] font-medium flex items-center justify-center transition-colors cursor-pointer"
              >
                Sign in
              </button>
            )}

            <button
              type="button"
              onClick={handleGetStarted}
              className="h-[40px] px-4 rounded-[7px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[13px] font-semibold flex items-center justify-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition-colors cursor-pointer"
            >
              <span>Get started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Main Navbar Component for Summit
 * Boundary-free integration over the mountain backdrop with zero separation line.
 */
export function Navbar() {
  const { isHeroActive } = usePreloader();
  const { user, openAuthModal, signOut } = useAuth();
  const router = useRouter();

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navContainerRef = useRef<HTMLElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const baseId = useId();

  const handleSignIn = (e: React.MouseEvent) => {
    e.preventDefault();
    openAuthModal({ mode: "signin" });
  };

  const handleGetStarted = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMobileOpen(false);
    router.push(BRAND.links.workspace);
  };

  // Close user dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isUserMenuOpen]);

  // Scroll detection for navbar background transition
  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 16);
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

  // Dropdown hover helpers with exit debounce
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
    }, 180);
  };

  const toggleDropdown = (id: string) => {
    setActiveDropdown((prev) => (prev === id ? null : id));
  };

  return (
    <header
      ref={navContainerRef}
      className={`fixed top-0 left-0 right-0 z-50 w-full h-[72px] transition-all duration-500 select-none ${
        !isHeroActive ? "opacity-0 pointer-events-none -translate-y-2" : "opacity-100 pointer-events-auto translate-y-0"
      } ${
        isScrolled || isMobileOpen
          ? "bg-[#111111]/88 backdrop-blur-md shadow-lg shadow-black/40"
          : "bg-transparent border-none"
      }`}
      style={{
        transitionProperty: "opacity, transform, background-color, border-color, box-shadow",
        transitionDuration: "500ms",
        transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
        background:
          isScrolled || isMobileOpen
            ? undefined
            : "linear-gradient(to bottom, rgba(17, 17, 17, 0.45) 0%, rgba(17, 17, 17, 0.15) 60%, transparent 100%)",
      }}
    >
      <div className="layout-container h-full flex items-center justify-between">
        {/* =============================================================
            LEFT: Brand Lockup for Summit with Interesting Logo
            ============================================================= */}
        <div className="flex items-center shrink-0">
          <Link
            href={BRAND.links.home}
            className="group flex items-center gap-[10px] focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px]"
            aria-label={`${BRAND.name} home`}
          >
            <div className="transition-transform duration-200 group-hover:scale-105">
              <SummitLogo className="w-5 h-5 shrink-0" />
            </div>
            <span className="text-[20px] font-semibold text-[#F5F5F3] tracking-[-0.025em] font-sans">
              {BRAND.name}
            </span>
          </Link>
        </div>

        {/* =============================================================
            CENTER: Primary Desktop Navigation (>= 1024px)
            Minimal, quiet, typographic dropdowns
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
            RIGHT: Documentation, Prominent Sign In Button & Primary CTA
            ============================================================= */}
        <div className="hidden lg:flex items-center gap-3.5 shrink-0">
          <Link
            href={BRAND.links.docs}
            className="text-[13.5px] font-medium text-[#B0B0AE] hover:text-[#F5F5F3] transition-colors duration-[150ms] px-2 py-1.5 focus-visible:outline-2 focus-visible:outline-accent-orange rounded-[6px]"
          >
            Docs
          </Link>

          {/* User Profile or Sign In Button */}
          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="inline-flex items-center gap-2 h-[38px] px-3 rounded-[7px] bg-[#1E1E1C]/85 hover:bg-[#282826] border border-[#3A3A38] text-[12.5px] font-mono text-[#FAF8F5] transition-colors cursor-pointer"
              >
                <div className="w-5 h-5 rounded-full bg-accent-orange/20 text-accent-orange text-[10px] flex items-center justify-center font-bold">
                  {user.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <span className="max-w-[110px] truncate">{user.email?.split("@")[0]}</span>
                <ChevronDown className="w-3 h-3 text-[#8E8C86]" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-44 bg-[#141413] border border-[#282826] rounded-[8px] shadow-xl py-1 z-50 animate-in fade-in duration-100">
                  <div className="px-3 py-1.5 border-b border-[#222220]">
                    <p className="font-mono text-[10px] text-[#70706C] truncate">Signed in as</p>
                    <p className="font-mono text-[11px] text-[#FAF8F5] truncate">{user.email}</p>
                  </div>
                  <Link
                    href={BRAND.links.workspace}
                    onClick={() => setIsUserMenuOpen(false)}
                    className="block px-3 py-1.5 text-[12px] font-sans text-[#FAF8F5] hover:bg-[#1E1E1C]"
                  >
                    Open Workspace
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      signOut();
                    }}
                    className="w-full text-left px-3 py-1.5 text-[12px] font-sans text-[#D77D7D] hover:bg-[#1E1E1C] flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              className="inline-flex items-center justify-center h-[38px] px-4 rounded-[7px] bg-[#1E1E1C]/85 hover:bg-[#282826] border border-[#3A3A38] hover:border-[#52524D] text-[#F5F5F3] hover:text-white text-[13px] font-medium transition-all duration-150 shadow-sm focus-visible:outline-2 focus-visible:outline-accent-orange cursor-pointer"
            >
              Sign in
            </button>
          )}

          {/* Primary CTA Button */}
          <button
            type="button"
            onClick={handleGetStarted}
            className="group inline-flex items-center justify-center gap-1.5 h-[38px] px-4 rounded-[7px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[13px] font-semibold transition-all duration-[150ms] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] focus-visible:outline-2 focus-visible:outline-accent-orange focus-visible:outline-offset-2 cursor-pointer"
          >
            <span>Get started</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* =============================================================
            TABLET / MOBILE RIGHT CONTROLS (< 1024px)
            ============================================================= */}
        <div className="flex lg:hidden items-center gap-2.5">
          {/* Visible Sign In on tablets (>= 640px) */}
          {user ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="hidden sm:inline-flex items-center justify-center h-[36px] px-3.5 rounded-[7px] border border-[#3A3A38] bg-[#1E1E1C]/85 hover:bg-[#282826] text-[#D77D7D] text-[12px] font-medium transition-colors cursor-pointer"
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              className="hidden sm:inline-flex items-center justify-center h-[36px] px-3.5 rounded-[7px] border border-[#3A3A38] bg-[#1E1E1C]/85 hover:bg-[#282826] text-[#F5F5F3] hover:text-white text-[12.5px] font-medium transition-colors cursor-pointer"
            >
              Sign in
            </button>
          )}

          {/* Primary CTA on tablets */}
          <button
            type="button"
            onClick={handleGetStarted}
            className="inline-flex items-center justify-center h-[36px] px-3.5 rounded-[7px] bg-[#D88762] hover:bg-[#E39A76] text-[#111111] text-[12.5px] font-semibold transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] cursor-pointer"
          >
            Get started
          </button>

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
      />
    </header>
  );
}

export default Navbar;
