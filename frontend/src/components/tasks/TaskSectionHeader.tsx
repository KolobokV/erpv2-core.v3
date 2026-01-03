import React from "react";

export function TaskSectionHeader({ title }: { title: string }) {
  return (
    <h2 style={{ marginTop: "24px", marginBottom: "8px" }}>
      {title}
    </h2>
  );
}