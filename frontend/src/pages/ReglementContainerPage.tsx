import React, { useMemo, useState } from "react";
import ReglementOverviewPage from "./ReglementOverviewPage";
import ReglementPage from "./ReglementPage";

type Mode = "overview" | "day";

const ReglementContainerPage: React.FC = () => {
  const [mode, setMode] = useState<Mode>("overview");
  const [selectedClient, setSelectedClient] = useState<string>("");

  function openDayForClient(clientCode: string) {
    setSelectedClient(clientCode);
    setMode("day");
  }

  const breadcrumb = useMemo(() => {
    const items: { label: string; onClick?: () => void }[] = [];

    items.push({
      label: "Reglement",
      onClick: () => {
        setMode("overview");
        setSelectedClient("");
      },
    });

    if (mode === "day") {
      if (selectedClient) {
        items.push({
          label: selectedClient,
          onClick: () => {
            setMode("day");
          },
        });
      }

      items.push({
        label: "Day",
      });
    }

    return items;
  }, [mode, selectedClient]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">

        {/* Breadcrumb */}
        <nav className="text-sm text-slate-600 flex items-center gap-2">
          {breadcrumb.map((b, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-400">/</span>}
              {b.onClick ? (
                <button
                  type="button"
                  onClick={b.onClick}
                  className="hover:underline text-slate-700"
                >
                  {b.label}
                </button>
              ) : (
                <span className="text-slate-500">{b.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Header + mode switch */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {mode === "overview" ? "Reglement overview" : "Reglement day"}
            </h1>
            <div className="mt-1 text-sm text-slate-600">
              Overview is period-based. Day is action-based (next action, tasks, risk).
            </div>
          </div>

          <div className="inline-flex rounded-lg bg-white ring-1 ring-slate-200 p-1">
            <button
              type="button"
              onClick={() => setMode("overview")}
              className={
                "px-3 py-1 text-sm rounded-md " +
                (mode === "overview"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100")
              }
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setMode("day")}
              className={
                "px-3 py-1 text-sm rounded-md " +
                (mode === "day"
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 hover:bg-slate-100")
              }
            >
              Day
            </button>
          </div>
        </div>

        {mode === "overview" && (
          <ReglementOverviewPage onOpenClient={openDayForClient} />
        )}

        {mode === "day" && (
          <ReglementPage
            initialClient={selectedClient}
            onClientPicked={(c) => setSelectedClient(c)}
          />
        )}
      </div>
    </div>
  );
};

export default ReglementContainerPage;