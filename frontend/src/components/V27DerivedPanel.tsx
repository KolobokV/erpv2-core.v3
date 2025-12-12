import React from "react";
import { ReglementItemDerived, RiskItem } from "../v27/types";

export const V27DerivedPanel: React.FC<{
  title: string;
  clientId: string;
  derived: ReglementItemDerived[];
  risks: RiskItem[];
}> = ({ title, clientId, derived, risks }) => {
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground">
          client: <span className="font-mono">{clientId}</span> · derived: {derived.length} · risks: {risks.length}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 xl:grid-cols-2 gap-2">
        <div className="rounded-lg border p-2">
          <div className="text-xs text-muted-foreground">Derived obligations</div>
          {derived.length === 0 ? (
            <div className="mt-1 text-xs text-muted-foreground">No items</div>
          ) : (
            <div className="mt-1 space-y-1">
              {derived.slice(0, 8).map(it => (
                <div key={it.key} className="flex items-center justify-between gap-2">
                  <div className="text-xs">{it.title}</div>
                  <div className="text-[11px] text-muted-foreground">{it.source} · {it.periodicity}</div>
                </div>
              ))}
              {derived.length > 8 ? (
                <div className="text-[11px] text-muted-foreground">+{derived.length - 8} more</div>
              ) : null}
            </div>
          )}
        </div>

        <div className="rounded-lg border p-2">
          <div className="text-xs text-muted-foreground">Risk summary</div>
          {risks.length === 0 ? (
            <div className="mt-1 text-xs text-muted-foreground">No risks</div>
          ) : (
            <div className="mt-1 space-y-1">
              {risks.slice(0, 6).map(r => (
                <div key={r.key} className="flex items-center justify-between gap-2">
                  <div className="text-xs">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground">{r.kind} · S{r.severity}</div>
                </div>
              ))}
              {risks.length > 6 ? (
                <div className="text-[11px] text-muted-foreground">+{risks.length - 6} more</div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};