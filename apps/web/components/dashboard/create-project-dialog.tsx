"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Sparkles, Layout, Server, Compass, AlertCircle } from "lucide-react";
import type {
  ProjectEnvironment,
  DashboardProject,
} from "@/lib/dashboard/types";

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: Omit<DashboardProject, "id" | "updatedAt" | "createdAt">) => void;
}

export function CreateProjectDialog({
  isOpen,
  onClose,
  onCreate,
}: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [environment, setEnvironment] = useState<ProjectEnvironment>("production");
  const [template, setTemplate] = useState<"fullstack" | "api" | "empty">("fullstack");
  const [error, setError] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus input and reset errors on open
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setEnvironment("production");
      setTemplate("fullstack");
      setError("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle Escape key and outside click
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, "-");

    if (!trimmed) {
      setError("Project name is required.");
      inputRef.current?.focus();
      return;
    }

    if (trimmed.length < 2) {
      setError("Project name must be at least 2 characters.");
      inputRef.current?.focus();
      return;
    }

    if (!/^[a-z0-9-_]+$/.test(trimmed)) {
      setError("Only lowercase letters, numbers, hyphens, and underscores are allowed.");
      inputRef.current?.focus();
      return;
    }

    // Determine type & icon based on template
    let type = "Next.js Application";
    let icon: DashboardProject["icon"] = "layout";
    let servicesCount = 3;

    if (template === "api") {
      type = "Go API Service";
      icon = "server";
      servicesCount = 2;
    } else if (template === "empty") {
      type = "Infrastructure Architecture";
      icon = "layout";
      servicesCount = 0;
    }

    onCreate({
      name: trimmed,
      description: description.trim() || `${type} deployment on Summit platform.`,
      environment,
      status: "active",
      type,
      icon,
      servicesCount,
      branch: "main",
      region: "us-east-1",
      template,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-[500px] bg-[#141413] border border-[#262624] rounded-[12px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-6 relative animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-sans text-[18px] font-semibold text-[#FAF8F5] tracking-tight">
              Create project
            </h2>
            <p className="text-[13px] text-[#8E8C86] mt-0.5">
              Give your infrastructure a home.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-[5px] flex items-center justify-center text-[#75736D] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Name Field */}
          <div>
            <label className="block text-[12px] font-mono uppercase tracking-wider text-[#8E8C86] mb-1.5">
              Project Name <span className="text-[#E58B62]">*</span>
            </label>
            <div className="relative group">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError("");
                }}
                placeholder="my-project"
                className={`w-full h-10 px-3 rounded-[6px] bg-[#181817] border text-[#FAF8F5] text-[13.5px] font-mono outline-none transition-colors ${
                  error
                    ? "border-[#D77D7D] focus:border-[#D77D7D]"
                    : "border-[#262624] group-hover:border-[#383834] focus:border-[#262624]"
                }`}
              />
              {/* Summit Underline Highlight on Focus */}
              {!error && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E58B62] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
              )}
            </div>
            {error && (
              <p className="flex items-center gap-1.5 text-[12px] text-[#D77D7D] mt-1.5 font-mono">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          {/* Environment Selector */}
          <div>
            <label className="block text-[12px] font-mono uppercase tracking-wider text-[#8E8C86] mb-1.5">
              Environment
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "production", label: "Production", dot: "bg-emerald-500" },
                  { id: "staging", label: "Staging", dot: "bg-sky-500" },
                  { id: "development", label: "Development", dot: "bg-amber-500" },
                ] as const
              ).map((env) => (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => setEnvironment(env.id)}
                  className={`h-9 px-3 rounded-[6px] border text-[12px] font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    environment === env.id
                      ? "bg-[#1E1E1C] border-[#E58B62]/60 text-[#FAF8F5] shadow-sm"
                      : "bg-[#181817] border-[#262624] text-[#8E8C86] hover:text-[#FAF8F5] hover:border-[#333330]"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${env.dot}`} />
                  <span>{env.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Description Field (Optional) */}
          <div>
            <label className="block text-[12px] font-mono uppercase tracking-wider text-[#8E8C86] mb-1.5">
              Description <span className="text-[#666560] font-sans lowercase">(optional)</span>
            </label>
            <div className="relative group">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Next.js frontend with PostgreSQL cluster"
                className="w-full h-10 px-3 rounded-[6px] bg-[#181817] border border-[#262624] group-hover:border-[#383834] text-[#FAF8F5] text-[13px] font-sans outline-none transition-colors"
              />
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#E58B62] scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200 ease-out origin-left pointer-events-none" />
            </div>
          </div>

          {/* Starter Architecture Template */}
          <div>
            <label className="block text-[12px] font-mono uppercase tracking-wider text-[#8E8C86] mb-1.5">
              Starter Architecture
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTemplate("fullstack")}
                className={`p-3 rounded-[6px] border text-left transition-colors cursor-pointer ${
                  template === "fullstack"
                    ? "bg-[#1E1E1C] border-[#E58B62]/60 shadow-sm"
                    : "bg-[#181817] border-[#262624] hover:border-[#333330]"
                }`}
              >
                <Layout
                  className={`w-4 h-4 mb-2 ${
                    template === "fullstack" ? "text-[#E58B62]" : "text-[#75736D]"
                  }`}
                />
                <div className="text-[12.5px] font-medium text-[#FAF8F5] leading-tight">
                  Full-Stack
                </div>
                <div className="text-[11px] font-mono text-[#8E8C86] mt-0.5">
                  Next.js + Postgres
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTemplate("api")}
                className={`p-3 rounded-[6px] border text-left transition-colors cursor-pointer ${
                  template === "api"
                    ? "bg-[#1E1E1C] border-[#E58B62]/60 shadow-sm"
                    : "bg-[#181817] border-[#262624] hover:border-[#333330]"
                }`}
              >
                <Server
                  className={`w-4 h-4 mb-2 ${
                    template === "api" ? "text-[#E58B62]" : "text-[#75736D]"
                  }`}
                />
                <div className="text-[12.5px] font-medium text-[#FAF8F5] leading-tight">
                  API Gateway
                </div>
                <div className="text-[11px] font-mono text-[#8E8C86] mt-0.5">
                  Go + Redis Cache
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTemplate("empty")}
                className={`p-3 rounded-[6px] border text-left transition-colors cursor-pointer ${
                  template === "empty"
                    ? "bg-[#1E1E1C] border-[#E58B62]/60 shadow-sm"
                    : "bg-[#181817] border-[#262624] hover:border-[#333330]"
                }`}
              >
                <Compass
                  className={`w-4 h-4 mb-2 ${
                    template === "empty" ? "text-[#E58B62]" : "text-[#75736D]"
                  }`}
                />
                <div className="text-[12.5px] font-medium text-[#FAF8F5] leading-tight">
                  Empty Canvas
                </div>
                <div className="text-[11px] font-mono text-[#8E8C86] mt-0.5">
                  Blank blueprint
                </div>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#222220] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-[6px] text-[13px] text-[#A6A4A0] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4 rounded-[6px] bg-[#E58B62] hover:bg-[#F29C75] text-[#0C0B0A] text-[13px] font-semibold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
            >
              Create project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

