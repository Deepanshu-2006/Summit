"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { DashboardProject } from "@/lib/dashboard/types";
import { describeApiError } from "@/lib/platform-api";

interface RenameProjectDialogProps {
  project: DashboardProject | null;
  isOpen: boolean;
  onClose: () => void;
  onRename: (projectId: string, newName: string) => Promise<void>;
}

export function RenameProjectDialog({
  project,
  isOpen,
  onClose,
  onRename,
}: RenameProjectDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset the form whenever the dialog opens for a project (state adjusted
  // during render rather than in an effect, per React's guidance).
  const openKey = isOpen && project ? project.id : null;
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  if (syncedKey !== openKey) {
    setSyncedKey(openKey);
    if (project && openKey) {
      setName(project.name);
      setError("");
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (!openKey) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
  }, [openKey]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, "-");

    if (!trimmed) {
      setError("Project name cannot be empty.");
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

    if (isSaving || !project) return;
    setIsSaving(true);
    try {
      await onRename(project.id, trimmed);
      onClose();
    } catch (err) {
      setError(describeApiError(err, "Could not rename this project."));
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && project && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none"
          onClick={(e) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
              onClose();
            }
          }}
        >
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[420px] bg-[#141413] border border-[#262624] rounded-[12px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-6 relative"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-sans text-[17px] font-semibold text-[#FAF8F5] tracking-tight">
                  Rename project
                </h2>
                <p className="text-[12.5px] text-[#8E8C86] mt-0.5">
                  Change the display identifier for this project.
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

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11.5px] font-mono uppercase tracking-wider text-[#8E8C86] mb-1.5">
                  Project Name
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
                    className={`w-full h-10 px-3 rounded-[6px] bg-[#181817] border text-[#FAF8F5] text-[13.5px] font-mono outline-none transition-colors ${
                      error
                        ? "border-[#D77D7D] focus:border-[#D77D7D]"
                        : "border-[#262624] group-hover:border-[#383834] focus:border-[#262624]"
                    }`}
                  />
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

              <div className="pt-3 border-t border-[#222220] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-[6px] text-[13px] text-[#A6A4A0] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-4 rounded-[6px] bg-[#E58B62] hover:bg-[#F29C75] disabled:opacity-60 disabled:cursor-not-allowed text-[#0C0B0A] text-[13px] font-semibold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
                >
                  {isSaving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

