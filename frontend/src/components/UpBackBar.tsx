import React from "react";

type UpBackBarProps = {
  title: string;
  onUp?: () => void;
  onBack?: () => void;
  right?: React.ReactNode;
};

function btnStyle(): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#0f172a",
    cursor: "pointer"
  };
}

export function UpBackBar(props: UpBackBarProps) {
  const { title, onUp, onBack, right } = props;

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        justifyContent: "space-between",
        padding: 12,
        borderBottom: "1px solid #e2e8f0",
        position: "sticky",
        top: 0,
        background: "#ffffff",
        zIndex: 5
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
        {onUp ? <button onClick={onUp} style={btnStyle()}>Up</button> : null}
        {onBack ? <button onClick={onBack} style={btnStyle()}>Back</button> : null}

        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {title}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {right ?? null}
      </div>
    </div>
  );
}