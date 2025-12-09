import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";

import TasksPage from "./pages/TasksPage";
import InternalProcessesPage from "./pages/InternalProcessesPage";
import ProcessCoveragePage from "./pages/ProcessCoveragePage";
import ClientProfilePage from "./pages/ClientProfilePage";
import ControlEventsPage from "./pages/ControlEventsPage";
import InternalControlEventsStorePage from "./pages/InternalControlEventsStorePage";
import ClientProcessOverviewPage from "./pages/ClientProcessOverviewPage";
import ProcessChainsDevPage from "./pages/ProcessChainsDevPage";

import ClientProcessStepPage from "./pages/ClientProcessStepPage";
import ClientControlEventPage from "./pages/ClientControlEventPage";

function navLinkClass(isActive, accent) {
  const base = "px-2 py-1 rounded-md text-sm no-underline";
  if (isActive) {
    return base + " " + (accent ? "bg-emerald-600 text-white" : "bg-slate-900 text-white");
  }
  return base + " " + (accent ? "text-emerald-700" : "text-slate-700");
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-100">
        <header className="bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 py-3 flex gap-3">
            <NavLink to="/tasks" className={({isActive}) => navLinkClass(isActive)}>Tasks</NavLink>
            <NavLink to="/internal-processes" className={({isActive}) => navLinkClass(isActive)}>Internal processes</NavLink>
            <NavLink to="/process-coverage" className={({isActive}) => navLinkClass(isActive)}>Process coverage</NavLink>
            <NavLink to="/client-profile" className={({isActive}) => navLinkClass(isActive)}>Client profile</NavLink>
            <NavLink to="/control-events" className={({isActive}) => navLinkClass(isActive)}>Control events</NavLink>
            <NavLink to="/internal-control-events-store" className={({isActive}) => navLinkClass(isActive)}>Events store</NavLink>
            <NavLink to="/client-process-overview" className={({isActive}) => navLinkClass(isActive)}>Client overview</NavLink>
            <NavLink to="/process-chains-dev" className={({isActive}) => navLinkClass(isActive, true)}>Chains dev</NavLink>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-4">
          <Routes>
            <Route path="/" element={<TasksPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/internal-processes" element={<InternalProcessesPage />} />
            <Route path="/process-coverage" element={<ProcessCoveragePage />} />
            <Route path="/client-profile" element={<ClientProfilePage />} />
            <Route path="/control-events" element={<ControlEventsPage />} />
            <Route path="/internal-control-events-store" element={<InternalControlEventsStorePage />} />
            <Route path="/client-process-overview" element={<ClientProcessOverviewPage />} />

            <Route path="/client-process-overview/step/:id" element={<ClientProcessStepPage />} />
            <Route path="/client-process-overview/event/:id" element={<ClientControlEventPage />} />

            <Route path="/process-chains-dev" element={<ProcessChainsDevPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
