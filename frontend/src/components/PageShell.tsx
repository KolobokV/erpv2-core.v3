import React from "react";

type PageShellProps = {
  title?: string;
  children: React.ReactNode;
};

export function PageShell(props: PageShellProps) {
  const { title, children } = props;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        {title ? (
          <div style={{ marginBottom: 12, fontSize: 14, color: "#475569" }}>{title}</div>
        ) : null}
        {children}
      </div>
    </div>
  );
}