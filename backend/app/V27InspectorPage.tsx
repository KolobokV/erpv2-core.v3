import React, { useMemo } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { getClientFromLocation } from "../v27/clientContext";
import { buildV27Bundle } from "../v27/bridge";
import { V27DerivedPanel } from "../components/V27DerivedPanel";

function asArray(x: any): any[] {
  if (!x) return [];
  if (Array.isArray(x)) return x;
  if (Array.isArray(x.items)) return x.items;
  if (Array.isArray(x.obligations)) return x.obligations;
  if (Array.isArray(x.derived)) return x.derived;
  return [];
}

function pickTitle(it: any): string {
  return (
    (typeof it?.title === "string" && it.title) ||
    (typeof it?.name === "string" && it.name) ||
    (typeof it?.label === "string" && it.label) ||
    (typeof it?.key === "string" && it.key) ||
    "Untitled"
  );
}

function pickCadence(it: any): string {
  return (
    (typeof it?.cadence === "string" && it.cadence) ||
    (typeof it?.period === "string" && it.period) ||
    (typeof it?.freq === "string" && it.freq) ||
    (typeof it?.schedule === "string" && it.schedule) ||
    ""
  );
}

function normalizeCadence(c: string): string {
  const s = (c || "").trim();
  if (!s) return "unspecified";
  return s.toLowerCase();
}

function makeSuggestedTitle(it: any): string {
  const base = pickTitle(it);
  const cad = normalizeCadence(pickCadence(it));
  if (cad && cad !== "unspecified") return base + " (" + cad + ")";
  return base;
}

export default function V27InspectorPage() {
  const loc = useLocation();
  const clientId = getClientFromLocation(loc);

  const bundle = useMemo(() => {
    if (!clientId) return null;
    return buildV27Bundle(clientId);
  }, [clientId]);

  if (!clientId) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-lg font-semibold">V27 Inspector</div>
          <div className="mt-1 text-sm text-gray-600">
            No client context. Add <span className="font-mono">?client=...</span> to the URL.
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <NavLink className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" to="/client-profile">
              Open Client Profile
            </NavLink>
            <a className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" href="/v27-inspector?client=ip_usn_dr">
              Demo: ip_usn_dr
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="text-lg font-semibold">V27 Inspector</div>
        <div className="mt-1 text-sm text-gray-600">Loading...</div>
      </div>
    );
  }

  const derivedItems = asArray(bundle.derived);
  const suggested = derivedItems.slice(0, 20).map((it, idx) => ({
    key: String(it?.key || it?.id || idx),
    title: makeSuggestedTitle(it),
    cadence: normalizeCadence(pickCadence(it)),
  }));

  const qClient = encodeURIComponent(bundle.clientId);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">V27 Inspector</div>
            <div className="mt-1 text-sm text-gray-600">
              Client: <span className="font-mono">{bundle.clientId}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <NavLink className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" to={"/client-profile?client=" + qClient}>
              Client Profile
            </NavLink>

            {/*
              IMPORTANT:
              Reglement route is "/" in App.tsx (no "/reglement" route).
              Keep client context by attaching query to "/".
            */}
            <NavLink className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" to={"/?client=" + qClient}>
              Reglement
            </NavLink>

            <NavLink className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" to={"/tasks?client=" + qClient}>
              Tasks
            </NavLink>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="p-4 border-b border-slate-200">
          <div className="text-base font-semibold">V27: suggested actions (read-only)</div>
          <div className="mt-1 text-sm text-slate-500">This is a proposal layer derived from profile obligations. No writes.</div>
        </div>

        <div className="p-4">
          {suggested.length === 0 ? (
            <div className="text-sm text-slate-500">No suggestions. Derived list is empty.</div>
          ) : (
            <div className="rounded-lg border border-slate-200">
              <div className="px-3 py-2 text-xs font-semibold border-b border-slate-200">Suggested tasks (top {suggested.length})</div>
              <div className="divide-y">
                {suggested.map((s) => (
                  <div key={s.key} className="px-3 py-2 flex items-center justify-between gap-3">
                    <div className="text-sm">{s.title}</div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">{s.cadence}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <V27DerivedPanel title="V27: derived obligations and risks (read-only)" clientId={bundle.clientId} derived={bundle.derived} risks={bundle.risks} />
    </div>
  );
}