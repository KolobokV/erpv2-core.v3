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
import ReglementOverviewPage from "./pages/ReglementOverviewPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import DayDashboardPage from "./pages/DayDashboardPage";

function navLinkClass(isActive: boolean, accent?: boolean): string {
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
        <header className="bg-slate-800 text-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="font-semibold">ERPv2 Reglement</div>
            <nav className="flex flex-wrap gap-2">
              <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive, true)}>
                Reglement
              </NavLink>
              <NavLink to="/day" className={({ isActive }) => navLinkClass(isActive, true)}>
                Day
              </NavLink>
              <NavLink to="/tasks" className={({ isActive }) => navLinkClass(isActive)}>
                Tasks
              </NavLink>
              <NavLink
                to="/internal-processes"
                className={({ isActive }) => navLinkClass(isActive)}
              >
                Processes
              </NavLink>
              <NavLink
                to="/process-coverage"
                className={({ isActive }) => navLinkClass(isActive)}
              >
                Coverage
              </NavLink>
              <NavLink
                to="/client-profile"
                className={({ isActive }) => navLinkClass(isActive)}
              >
                Client profiles
              </NavLink>
              <NavLink
                to="/control-events"
                className={({ isActive }) => navLinkClass(isActive)}
              >
                Control events
              </NavLink>
              <NavLink
                to="/internal-control-events-store"
                className={({ isActive }) => navLinkClass(isActive)}
              >
                Events store
              </NavLink>
              <NavLink
                to="/client-process-overview"
                className={({ isActive }) => navLinkClass(isActive)}
              >
                Client overview
              </NavLink>
              <NavLink
                to="/process-chains-dev"
                className={({ isActive }) => navLinkClass(isActive, true)}
              >
                Chains dev
              </NavLink>
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-4">
          <Routes>
            <Route path="/" element={<ReglementOverviewPage />} />
            <Route path="/day" element={<DayDashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/task-detail" element={<TaskDetailPage />} />
            <Route path="/internal-processes" element={<InternalProcessesPage />} />
            <Route path="/process-coverage" element={<ProcessCoveragePage />} />
            <Route path="/client-profile" element={<ClientProfilePage />} />
            <Route path="/control-events" element={<ControlEventsPage />} />
            <Route
              path="/internal-control-events-store"
              element={<InternalControlEventsStorePage />}
            />
            <Route path="/client-process-overview" element={<ClientProcessOverviewPage />} />
            <Route
              path="/client-process-overview/step/:stepId"
              element={<ClientProcessStepPage />}
            />
            <Route
              path="/client-process-overview/event/:eventId"
              element={<ClientControlEventPage />}
            />
            <Route path="/process-chains-dev" element={<ProcessChainsDevPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
