import React from "react";

type PageShellProps = {
  title?: string;
  children: React.ReactNode;
};

export function PageShell(props: PageShellProps) {
  const { title, children } = props;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 16px 32px" }}>
        {title ? (
          <div
            style={{
              marginBottom: 14,
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(15,23,42,0.55)",
              letterSpacing: 0.2,
            }}
          >
            {title}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
