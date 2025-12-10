import React from "react";
import { BrowserRouter, Route, Routes, Link } from "react-router-dom";

import TasksPage from "./pages/TasksPage";
import InternalProcessesPage from "./pages/InternalProcessesPage";
import ProcessCoveragePage from "./pages/ProcessCoveragePage";
import ProcessChainsDevPage from "./pages/ProcessChainsDevPage";
import ClientProfilePage from "./pages/ClientProfilePage";
import ControlEventsPage from "./pages/ControlEventsPage";
import InternalControlEventsStorePage from "./pages/InternalControlEventsStorePage";
import ClientProcessOverviewPage from "./pages/ClientProcessOverviewPage";
import ClientControlEventPage from "./pages/ClientControlEventPage";
import ReglementOverviewPage from "./pages/ReglementOverviewPage";
import TaskDetailPage from "./pages/TaskDetailPage";

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
          <div className="text-sm font-semibold text-slate-900">
            ERPv2 • Reglement
          </div>
          <nav className="text-xs text-slate-700">
            <Link className="hover:underline" to="/reglement-overview">Reglement</Link>{" · "}
            <Link className="hover:underline" to="/tasks">Tasks</Link>{" · "}
            <Link className="hover:underline" to="/internal-processes">Processes</Link>{" · "}
            <Link className="hover:underline" to="/process-coverage">Coverage</Link>{" · "}
            <Link className="hover:underline" to="/process-chains-dev">Chains dev</Link>{" · "}
            <Link className="hover:underline" to="/client-profile">Client profiles</Link>{" · "}
            <Link className="hover:underline" to="/control-events">Control events</Link>{" · "}
            <Link className="hover:underline" to="/internal-control-events-store">Events store</Link>
          </nav>
        </header>

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<ReglementOverviewPage />} />
            <Route path="/reglement-overview" element={<ReglementOverviewPage />} />

            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/task-detail" element={<TaskDetailPage />} />

            <Route path="/internal-processes" element={<InternalProcessesPage />} />
            <Route path="/process-coverage" element={<ProcessCoveragePage />} />
            <Route path="/process-chains-dev" element={<ProcessChainsDevPage />} />

            <Route path="/client-profile" element={<ClientProfilePage />} />
            <Route path="/control-events" element={<ControlEventsPage />} />

            <Route path="/internal-control-events-store" element={<InternalControlEventsStorePage />} />

            <Route path="/client-process-overview" element={<ClientProcessOverviewPage />} />
            <Route path="/client-control-event" element={<ClientControlEventPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
