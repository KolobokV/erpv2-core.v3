import React, { useMemo } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { getClientFromLocation } from "../v27/clientContext";
import { buildV27Bundle } from "../v27/bridge";
import { V27DerivedPanel } from "../components/V27DerivedPanel";

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
            <a
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              href="/v27-inspector?client=ip_usn_dr"
            >
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
            <NavLink
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              to={"/client-profile?client=" + encodeURIComponent(bundle.clientId)}
            >
              Client Profile
            </NavLink>
            <NavLink
              className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
              to={"/reglement?client=" + encodeURIComponent(bundle.clientId)}
            >
              Reglement
            </NavLink>
          </div>
        </div>
      </div>

      <V27DerivedPanel
        title="V27: derived obligations and risks (read-only)"
        clientId={bundle.clientId}
        derived={bundle.derived}
        risks={bundle.risks}
      />
    </div>
  );
}