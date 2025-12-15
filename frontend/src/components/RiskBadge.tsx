import React from "react";
import { RiskItem } from "../v27/types";

export const RiskBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <span className="ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
      Risk: {count}
    </span>
  );
};

export const RiskList: React.FC<{ risks: RiskItem[] }> = ({ risks }) => {
  if (!risks || risks.length === 0) {
    return <div className="text-sm text-muted-foreground">No risks detected</div>;
  }

  return (
    <div className="space-y-2">
      {risks.map(r => (
        <div key={r.key} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="font-medium text-sm">{r.title}</div>
            <div className="text-xs text-muted-foreground">
              {r.kind} · S{r.severity}
            </div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{r.details}</div>
        </div>
      ))}
    </div>
  );
};
