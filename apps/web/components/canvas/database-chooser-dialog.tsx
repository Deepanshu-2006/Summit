"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Database,
  Check,
  ChevronDown,
  ArrowLeft,
  Server,
  Layers,
  Globe,
} from "lucide-react";

import { PostgresLogo, MongoLogo, RedisLogo } from "./database-logos";

export type DatabaseEngine = "postgres" | "mongodb" | "redis";

interface EngineOption {
  id: DatabaseEngine;
  name: string;
  description: string;
  metadata: string;
  port: number;
  infoRow: string;
  available: boolean;
  Icon: React.ComponentType<{ className?: string }>;
}

const DATABASE_OPTIONS: EngineOption[] = [
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Relational database",
    metadata: "SQL · Port 5432",
    port: 5432,
    infoRow: "PostgreSQL · connection injected as DATABASE_URL",
    available: true,
    Icon: PostgresLogo,
  },
  {
    id: "mongodb",
    name: "MongoDB",
    description: "Document database",
    metadata: "NoSQL · Port 27017",
    port: 27017,
    infoRow: "Coming soon",
    available: false,
    Icon: MongoLogo,
  },
  {
    id: "redis",
    name: "Redis",
    description: "In-memory data store",
    metadata: "Key-value · Port 6379",
    port: 6379,
    infoRow: "Redis · connection injected as REDIS_URL",
    available: true,
    Icon: RedisLogo,
  },
];

const DEMO_REGIONS = [
  "Asia Pacific (Mumbai)",
  "US East (N. Virginia)",
  "Europe (Frankfurt)",
];

const DEMO_MEMORY_SIZES = ["256 MB", "512 MB", "1 GB"];

export interface DatabaseChooserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (optionId: string, customData?: Record<string, unknown>) => void;
  onShowToast?: (message: string) => void;
}

export function DatabaseChooserDialog({
  isOpen,
  onClose,
  onConfirm,
  onShowToast,
}: DatabaseChooserDialogProps) {
  // Navigation Steps: 1 = Engine Selection, 2 = Engine Configuration
  const [step, setStep] = useState<1 | 2>(1);

  // Selected Engine
  const [selectedEngine, setSelectedEngine] = useState<DatabaseEngine>("postgres");

  // Form State — PostgreSQL
  const [pgDbName, setPgDbName] = useState("postgres-db");
  const [pgInitialDb, setPgInitialDb] = useState("app");
  const [pgUsername, setPgUsername] = useState("summit_user");
  const [pgRegion, setPgRegion] = useState(DEMO_REGIONS[0]);

  // Form State — MongoDB
  const [mongoServiceName, setMongoServiceName] = useState("mongodb");
  const [mongoDbName, setMongoDbName] = useState("app");
  const [mongoRegion, setMongoRegion] = useState(DEMO_REGIONS[0]);

  // Form State — Redis
  const [redisServiceName, setRedisServiceName] = useState("redis-cache");
  const [redisMemory, setRedisMemory] = useState(DEMO_MEMORY_SIZES[1]); // "512 MB"
  const [redisRegion, setRedisRegion] = useState(DEMO_REGIONS[0]);

  // Dropdown states
  const [isRegionDropdownOpen, setIsRegionDropdownOpen] = useState(false);
  const [isMemoryDropdownOpen, setIsMemoryDropdownOpen] = useState(false);

  // Reset step on modal open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setIsRegionDropdownOpen(false);
      setIsMemoryDropdownOpen(false);
    }
  }, [isOpen]);

  // Keyboard navigation: Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isRegionDropdownOpen) {
          setIsRegionDropdownOpen(false);
        } else if (isMemoryDropdownOpen) {
          setIsMemoryDropdownOpen(false);
        } else if (step === 2) {
          setStep(1);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, step, isRegionDropdownOpen, isMemoryDropdownOpen, onClose]);

  if (!isOpen) return null;

  const currentOption = DATABASE_OPTIONS.find((o) => o.id === selectedEngine) || DATABASE_OPTIONS[0];

  // Validation
  const isPgValid = pgDbName.trim().length > 0 && pgInitialDb.trim().length > 0 && pgUsername.trim().length > 0;
  const isMongoValid = mongoServiceName.trim().length > 0 && mongoDbName.trim().length > 0;
  const isRedisValid = redisServiceName.trim().length > 0;

  const isFormValid = !currentOption.available
    ? false
    : selectedEngine === "postgres"
      ? isPgValid
      : selectedEngine === "mongodb"
        ? isMongoValid
        : isRedisValid;

  // Handle final node addition to canvas
  const handleAddToCanvas = () => {
    if (!isFormValid) return;

    if (!currentOption.available) return;

    if (selectedEngine === "postgres") {
      onConfirm("database", {
        label: pgDbName.trim(),
        subType: "PostgreSQL",
        databaseEngine: "postgresql",
        port: 5432,
      });
    } else if (selectedEngine === "redis") {
      onConfirm("database", {
        label: redisServiceName.trim(),
        subType: "Redis",
        serviceType: "cache",
        databaseEngine: "redis",
        port: 6379,
      });
    }

    // Trigger toast
    if (onShowToast) {
      onShowToast("Database added to canvas");
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("summit:toast", {
          detail: { message: "Database added to canvas", type: "success" },
        })
      );
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-[2px] animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] bg-[#111110] border border-[#222220] rounded-[10px] shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden animate-in fade-in zoom-in-[0.99] duration-150"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="database-modal-title"
      >
        {/* ================= STEP 1: SELECT A DATABASE ================= */}
        {step === 1 && (
          <>
            {/* Minimal Header */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-[#A09E98]" />
                <div>
                  <h3
                    id="database-modal-title"
                    className="font-sans text-[14px] font-medium text-[#F1F0ED] tracking-tight leading-none"
                  >
                    Add a database
                  </h3>
                  <p className="font-sans text-[11.5px] text-[#77756F] mt-1">
                    Choose an engine for your application.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-[#77756F] hover:text-[#F1F0ED] p-1 rounded transition-colors cursor-pointer"
                title="Close (Esc)"
                aria-label="Close dialog"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Step 1 Content: Clean Vertical List of 3 Selectable Engines */}
            <div className="px-5 pt-2 pb-3 flex flex-col flex-1">
              <div className="space-y-1">
                {DATABASE_OPTIONS.map((option) => {
                  const isSelected = option.available && selectedEngine === option.id;
                  const { Icon } = option;
                  return (
                    <div
                      key={option.id}
                      role="button"
                      aria-disabled={!option.available}
                      onClick={() => {
                        if (option.available) setSelectedEngine(option.id);
                      }}
                      className={`group relative flex items-center justify-between px-3.5 py-3 rounded-[5px] transition-colors duration-150 ${
                        option.available ? "cursor-pointer" : "cursor-not-allowed opacity-55"
                      } ${
                        isSelected
                          ? "bg-[#181817] text-[#F1F0ED]"
                          : option.available
                            ? "bg-transparent hover:bg-[#181817]/60 text-[#DCDAD5]"
                            : "bg-transparent text-[#8E8C86]"
                      }`}
                    >
                      {/* Left: Compact Icon + Name & Description */}
                      <div className="flex items-center gap-3 min-w-0 pr-3">
                        <Icon className="w-4 h-4 shrink-0" />
                        <div className="min-w-0">
                          <span
                            className={`font-sans text-[13px] truncate transition-colors ${
                              isSelected
                                ? "font-medium text-[#F1F0ED]"
                                : "text-[#C9C7C2] group-hover:text-[#F1F0ED]"
                            }`}
                          >
                            {option.name}
                          </span>
                          <p className="font-sans text-[11px] text-[#77756F] group-hover:text-[#8E8C86] truncate mt-0.5">
                            {option.description}
                          </p>
                        </div>
                      </div>

                      {/* Right: Technical Metadata Label & Selection Indicator */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-mono text-[10.5px] text-[#77756F] group-hover:text-[#A09E98]">
                          {option.available ? option.metadata : "Coming soon"}
                        </span>

                        <div className="w-3.5 h-3.5 flex items-center justify-center">
                          {isSelected && (
                            <Check className="w-3 h-3 text-[#E58B62]" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 1 Footer */}
            <div className="px-5 py-3 border-t border-[#222220] flex items-center justify-between shrink-0">
              <div className="text-[11.5px] text-[#77756F] font-sans">
                {selectedEngine ? (
                  <span className="text-[#A09E98] flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-[#E58B62]" />
                    <span>1 engine selected</span>
                  </span>
                ) : (
                  <span>Select one engine</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 rounded-[5px] text-[#A09E98] hover:text-[#F1F0ED] text-[12px] font-sans transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!currentOption.available}
                  onClick={() => {
                    if (currentOption.available) setStep(2);
                  }}
                  className="px-3.5 py-1.5 rounded-[5px] bg-[#E58B62] hover:bg-[#F0A17B] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#E58B62] text-[#0B0B0A] font-sans font-medium text-[12px] transition-colors cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </div>
          </>
        )}

        {/* ================= STEP 2: CONFIGURE THE DATABASE ================= */}
        {step === 2 && (
          <>
            {/* Header */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <currentOption.Icon className="w-4 h-4 shrink-0" />
                <div>
                  <h3 className="font-sans text-[14px] font-medium text-[#F1F0ED] tracking-tight leading-none">
                    Configure {currentOption.name}
                  </h3>
                  <p className="font-sans text-[11.5px] text-[#77756F] mt-1">
                    {selectedEngine === "postgres"
                      ? "Relational database cluster settings."
                      : selectedEngine === "mongodb"
                      ? "Document database instance settings."
                      : "In-memory key-value data store settings."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="text-[#77756F] hover:text-[#F1F0ED] p-1 rounded transition-colors cursor-pointer"
                title="Close (Esc)"
                aria-label="Close dialog"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Step 2 Form Content */}
            <div className="px-5 py-4 space-y-3.5 flex-1 overflow-y-auto max-h-[380px]">
              {/* Compact Informational Row */}
              <div className="px-3 py-2 rounded-[5px] bg-[#181817] border border-[#222220] flex items-center justify-between font-mono text-[11px] text-[#A09E98]">
                <span>{currentOption.infoRow}</span>
                <span className="text-[10px] text-[#77756F]">Default Engine</span>
              </div>

              {/* Form Fields: PostgreSQL */}
              {selectedEngine === "postgres" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider">
                      Database Name
                    </label>
                    <div className="relative group bg-[#181817] border border-[#222220] rounded-[5px] overflow-hidden transition-colors">
                      <input
                        type="text"
                        value={pgDbName}
                        onChange={(e) => setPgDbName(e.target.value)}
                        placeholder="postgres-db"
                        className="w-full bg-transparent px-3 py-1.5 text-[12px] font-mono text-[#F1F0ED] placeholder:text-[#55534E] outline-none border-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                        style={{ outline: "none", boxShadow: "none", border: "none" }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E58B62] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
                    </div>
                    {!pgDbName.trim() && (
                      <p className="text-[10.5px] text-[#D77D7D] font-sans">
                        Database name is required.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider">
                      Initial Database
                    </label>
                    <div className="relative group bg-[#181817] border border-[#222220] rounded-[5px] overflow-hidden transition-colors">
                      <input
                        type="text"
                        value={pgInitialDb}
                        onChange={(e) => setPgInitialDb(e.target.value)}
                        placeholder="app"
                        className="w-full bg-transparent px-3 py-1.5 text-[12px] font-mono text-[#F1F0ED] placeholder:text-[#55534E] outline-none border-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                        style={{ outline: "none", boxShadow: "none", border: "none" }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E58B62] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider">
                      Username
                    </label>
                    <div className="relative group bg-[#181817] border border-[#222220] rounded-[5px] overflow-hidden transition-colors">
                      <input
                        type="text"
                        value={pgUsername}
                        onChange={(e) => setPgUsername(e.target.value)}
                        placeholder="summit_user"
                        className="w-full bg-transparent px-3 py-1.5 text-[12px] font-mono text-[#F1F0ED] placeholder:text-[#55534E] outline-none border-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                        style={{ outline: "none", boxShadow: "none", border: "none" }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E58B62] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
                    </div>
                  </div>

                  {/* Region Select */}
                  <div className="space-y-1">
                    <label className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider">
                      Region
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsRegionDropdownOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-[5px] bg-[#181817] hover:bg-[#1f1f1d] border border-[#222220] text-left transition-colors cursor-pointer"
                        aria-expanded={isRegionDropdownOpen}
                      >
                        <div className="flex items-center gap-2 font-mono text-[12px] text-[#F1F0ED]">
                          <Globe className="w-3 h-3 text-[#77756F]" />
                          <span>{pgRegion}</span>
                        </div>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-[#77756F] transition-transform duration-150 ${
                            isRegionDropdownOpen ? "rotate-180 text-[#F1F0ED]" : ""
                          }`}
                        />
                      </button>

                      {isRegionDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-[#181817] border border-[#242424] rounded-[6px] shadow-2xl py-1 overflow-hidden animate-in fade-in duration-100">
                          {DEMO_REGIONS.map((r) => (
                            <div
                              key={r}
                              onClick={() => {
                                setPgRegion(r);
                                setIsRegionDropdownOpen(false);
                              }}
                              className={`flex items-center justify-between px-3 py-1.5 text-[12px] font-mono cursor-pointer transition-colors ${
                                pgRegion === r
                                  ? "bg-[#201A17] text-[#E58B62]"
                                  : "text-[#DCDAD5] hover:bg-[#202020] hover:text-[#F1F0ED]"
                              }`}
                            >
                              <span>{r}</span>
                              {pgRegion === r && (
                                <Check className="w-3 h-3 text-[#E58B62]" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Fields: MongoDB */}
              {selectedEngine === "mongodb" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider">
                      Service Name
                    </label>
                    <div className="relative group bg-[#181817] border border-[#222220] rounded-[5px] overflow-hidden transition-colors">
                      <input
                        type="text"
                        value={mongoServiceName}
                        onChange={(e) => setMongoServiceName(e.target.value)}
                        placeholder="mongodb"
                        className="w-full bg-transparent px-3 py-1.5 text-[12px] font-mono text-[#F1F0ED] placeholder:text-[#55534E] outline-none border-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                        style={{ outline: "none", boxShadow: "none", border: "none" }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E58B62] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
                    </div>
                    {!mongoServiceName.trim() && (
                      <p className="text-[10.5px] text-[#D77D7D] font-sans">
                        Service name is required.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider">
                      Database Name
                    </label>
                    <div className="relative group bg-[#181817] border border-[#222220] rounded-[5px] overflow-hidden transition-colors">
                      <input
                        type="text"
                        value={mongoDbName}
                        onChange={(e) => setMongoDbName(e.target.value)}
                        placeholder="app"
                        className="w-full bg-transparent px-3 py-1.5 text-[12px] font-mono text-[#F1F0ED] placeholder:text-[#55534E] outline-none border-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                        style={{ outline: "none", boxShadow: "none", border: "none" }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E58B62] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
                    </div>
                  </div>

                  {/* Region Select */}
                  <div className="space-y-1">
                    <label className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider">
                      Region
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsRegionDropdownOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-[5px] bg-[#181817] hover:bg-[#1f1f1d] border border-[#222220] text-left transition-colors cursor-pointer"
                        aria-expanded={isRegionDropdownOpen}
                      >
                        <div className="flex items-center gap-2 font-mono text-[12px] text-[#F1F0ED]">
                          <Globe className="w-3 h-3 text-[#77756F]" />
                          <span>{mongoRegion}</span>
                        </div>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-[#77756F] transition-transform duration-150 ${
                            isRegionDropdownOpen ? "rotate-180 text-[#F1F0ED]" : ""
                          }`}
                        />
                      </button>

                      {isRegionDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-[#181817] border border-[#242424] rounded-[6px] shadow-2xl py-1 overflow-hidden animate-in fade-in duration-100">
                          {DEMO_REGIONS.map((r) => (
                            <div
                              key={r}
                              onClick={() => {
                                setMongoRegion(r);
                                setIsRegionDropdownOpen(false);
                              }}
                              className={`flex items-center justify-between px-3 py-1.5 text-[12px] font-mono cursor-pointer transition-colors ${
                                mongoRegion === r
                                  ? "bg-[#201A17] text-[#E58B62]"
                                  : "text-[#DCDAD5] hover:bg-[#202020] hover:text-[#F1F0ED]"
                              }`}
                            >
                              <span>{r}</span>
                              {mongoRegion === r && (
                                <Check className="w-3 h-3 text-[#E58B62]" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Fields: Redis */}
              {selectedEngine === "redis" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider">
                      Service Name
                    </label>
                    <div className="relative group bg-[#181817] border border-[#222220] rounded-[5px] overflow-hidden transition-colors">
                      <input
                        type="text"
                        value={redisServiceName}
                        onChange={(e) => setRedisServiceName(e.target.value)}
                        placeholder="redis-cache"
                        className="w-full bg-transparent px-3 py-1.5 text-[12px] font-mono text-[#F1F0ED] placeholder:text-[#55534E] outline-none border-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                        style={{ outline: "none", boxShadow: "none", border: "none" }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E58B62] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
                    </div>
                    {!redisServiceName.trim() && (
                      <p className="text-[10.5px] text-[#D77D7D] font-sans">
                        Service name is required.
                      </p>
                    )}
                  </div>

                  {/* Memory Size */}
                  <div className="space-y-1">
                    <label className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider">
                      Memory Size
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsMemoryDropdownOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-[5px] bg-[#181817] hover:bg-[#1f1f1d] border border-[#222220] text-left transition-colors cursor-pointer"
                        aria-expanded={isMemoryDropdownOpen}
                      >
                        <div className="flex items-center gap-2 font-mono text-[12px] text-[#F1F0ED]">
                          <Layers className="w-3 h-3 text-[#77756F]" />
                          <span>{redisMemory}</span>
                        </div>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-[#77756F] transition-transform duration-150 ${
                            isMemoryDropdownOpen ? "rotate-180 text-[#F1F0ED]" : ""
                          }`}
                        />
                      </button>

                      {isMemoryDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-[#181817] border border-[#242424] rounded-[6px] shadow-2xl py-1 overflow-hidden animate-in fade-in duration-100">
                          {DEMO_MEMORY_SIZES.map((m) => (
                            <div
                              key={m}
                              onClick={() => {
                                setRedisMemory(m);
                                setIsMemoryDropdownOpen(false);
                              }}
                              className={`flex items-center justify-between px-3 py-1.5 text-[12px] font-mono cursor-pointer transition-colors ${
                                redisMemory === m
                                  ? "bg-[#201A17] text-[#E58B62]"
                                  : "text-[#DCDAD5] hover:bg-[#202020] hover:text-[#F1F0ED]"
                              }`}
                            >
                              <span>{m}</span>
                              {redisMemory === m && (
                                <Check className="w-3 h-3 text-[#E58B62]" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Region Select */}
                  <div className="space-y-1">
                    <label className="block font-mono text-[10.5px] text-[#77756F] uppercase tracking-wider">
                      Region
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsRegionDropdownOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-[5px] bg-[#181817] hover:bg-[#1f1f1d] border border-[#222220] text-left transition-colors cursor-pointer"
                        aria-expanded={isRegionDropdownOpen}
                      >
                        <div className="flex items-center gap-2 font-mono text-[12px] text-[#F1F0ED]">
                          <Globe className="w-3 h-3 text-[#77756F]" />
                          <span>{redisRegion}</span>
                        </div>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-[#77756F] transition-transform duration-150 ${
                            isRegionDropdownOpen ? "rotate-180 text-[#F1F0ED]" : ""
                          }`}
                        />
                      </button>

                      {isRegionDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-[#181817] border border-[#242424] rounded-[6px] shadow-2xl py-1 overflow-hidden animate-in fade-in duration-100">
                          {DEMO_REGIONS.map((r) => (
                            <div
                              key={r}
                              onClick={() => {
                                setRedisRegion(r);
                                setIsRegionDropdownOpen(false);
                              }}
                              className={`flex items-center justify-between px-3 py-1.5 text-[12px] font-mono cursor-pointer transition-colors ${
                                redisRegion === r
                                  ? "bg-[#201A17] text-[#E58B62]"
                                  : "text-[#DCDAD5] hover:bg-[#202020] hover:text-[#F1F0ED]"
                              }`}
                            >
                              <span>{r}</span>
                              {redisRegion === r && (
                                <Check className="w-3 h-3 text-[#E58B62]" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2 Footer */}
            <div className="px-5 py-3 border-t border-[#222220] flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-[5px] text-[#A09E98] hover:text-[#F1F0ED] text-[12px] font-sans transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1 rounded-[5px] text-[#A09E98] hover:text-[#F1F0ED] text-[12px] font-sans transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!isFormValid}
                  onClick={handleAddToCanvas}
                  className="px-3.5 py-1.5 rounded-[5px] bg-[#E58B62] hover:bg-[#F0A17B] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#E58B62] text-[#0B0B0A] font-sans font-medium text-[12px] transition-colors cursor-pointer"
                >
                  Add to canvas
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

