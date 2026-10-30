import React from "react";

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full min-h-screen bg-[#F7F5F0] text-[#1C1A17]">
      {children}
    </div>
  );
}
