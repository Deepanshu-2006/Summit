"use client";

import React, { useEffect, useRef } from "react";
import { X, AlertTriangle } from "lucide-react";
import type { DashboardProject } from "@/lib/dashboard/types";

interface DeleteConfirmDialogProps {
  project: DashboardProject | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (projectId: string) => void;
}

export function DeleteConfirmDialog({
  project,
  isOpen,
  onClose,
  onConfirmDelete,
}: DeleteConfirmDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => deleteBtnRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

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
        className="w-full max-w-[420px] bg-[#141413] border border-[#262624] rounded-[12px] shadow-[0_24px_64px_rgba(0,0,0,0.85)] p-6 relative animate-in zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="w-9 h-9 rounded-[8px] bg-[#2A1818] border border-[#442424] flex items-center justify-center text-[#D77D7D] shrink-0">
            <AlertTriangle className="w-4 h-4" />
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

        <div>
          <h2 className="font-sans text-[17px] font-semibold text-[#FAF8F5] tracking-tight">
            Delete project?
          </h2>
          <p className="text-[13px] text-[#8E8C86] leading-relaxed mt-1.5">
            Are you sure you want to delete <span className="font-mono text-[#FAF8F5] font-semibold">{project.name}</span>? This will permanently remove its architecture blueprint and saved canvas nodes.
          </p>
        </div>

        <div className="pt-5 mt-5 border-t border-[#222220] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-[6px] text-[13px] text-[#A6A4A0] hover:text-[#FAF8F5] hover:bg-[#1E1E1C] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            ref={deleteBtnRef}
            type="button"
            onClick={() => {
              onConfirmDelete(project.id);
              onClose();
            }}
            className="h-9 px-4 rounded-[6px] bg-[#D77D7D] hover:bg-[#E58888] text-[#141413] text-[13px] font-semibold transition-all shadow-sm active:scale-[0.98] cursor-pointer"
          >
            Delete project
          </button>
        </div>
      </div>
    </div>
  );
}

