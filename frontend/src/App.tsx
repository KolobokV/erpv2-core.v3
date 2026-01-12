import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import "./styles/erp_shell.css";
import "./ux/sidePanelEngine.css";
import { ErpShell, type ErpNavItem } from "./components/layout/ErpShell";
import { SidePanelProvider } from "./components/ux/SidePanelEngine";

import TasksPage from "./pages/TasksPage";
import InternalProcessesPage from "./pages/InternalProcessesPage";
import ProcessCoveragePage from "./pages/ProcessCoveragePage";
import ClientCreatePage from "./pages/ClientCreatePage";
import OnboardingClientsPage from "./pages/OnboardingClientsPage";
import ClientProfilePage from "./pages/ClientProfilePage";
import ClientProfileEditPage from "./pages/ClientProfileEditPage";
import ControlEventsPage from "./pages/ControlEventsPage";
import InternalControlEventsStorePage from "./pages/InternalControlEventsStorePage";
import DocumentsPage from "./pages/DocumentsPage";
import ClientProcessOverviewPage from "./pages/ClientProcessOverviewPage";
import ProcessChainsDevPage from "./pages/ProcessChainsDevPage";
import ClientProcessStepPage from "./pages/ClientProcessStepPage";
import ClientControlEventPage from "./pages/ClientControlEventPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import DayDashboardPage from "./pages/DayDashboardPage";
import OnboardingStubPage from "./pages/OnboardingStubPage";
import AnalyticsPage from "./pages/AnalyticsPage";

function getClientFromUrl(): string | null {
  try {
    const u = new URL(window.location.href);
    const c = u.searchParams.get("client");
    return c && c.trim().length > 0 ? c.trim() : null;
  } catch {
    return null;
  }
}

const NAV: ErpNavItem[] = [
  { to: "/day", label: "\u0414\u0435\u043d\u044c" },
  { to: "/tasks", label: "\u0417\u0430\u0434\u0430\u0447\u0438" },
  { to: "/client-profile", label: "\u041a\u043b\u0438\u0435\u043d\u0442" },
  { to: "/internal-processes", label: "\u041f\u0440\u043e\u0446\u0435\u0441\u0441\u044b" },
  { to: "/process-coverage", label: "\u041f\u043e\u043a\u0440\u044b\u0442\u0438\u0435" },
  { to: "/control-events", label: "\u0421\u043e\u0431\u044b\u0442\u0438\u044f" },
  { to: "/documents", label: "\u0414\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u044b" },
  { to: "/client-process-overview", label: "\u041e\u0431\u0437\u043e\u0440" },
  { to: "/analytics", label: "Analytics" },
  { to: "/process-chains-dev", label: "DEV Chains" },
];

function RightActions() {
  const clientId = getClientFromUrl();
  const hrefDay = clientId ? ("/day?client=" + encodeURIComponent(clientId)) : "/day";
  const hrefTasks = clientId ? ("/tasks?client=" + encodeURIComponent(clientId)) : "/tasks";

  return (
    <>
      <a className="erp-btn" href={hrefDay}>
        {"\u0414\u0435\u043d\u044c"}
      </a>
      <a className="erp-btn" href={hrefTasks}>
        {"\u0417\u0430\u0434\u0430\u0447\u0438"}
      </a>
    </>
  );
}

function App() {
  const clientId = getClientFromUrl();

  return (
    <SidePanelProvider>
      <Router>
      <ErpShell
        title="ERPv2"
        subtitle="Workday v1"
        clientId={clientId}
        nav={NAV}
        right={<RightActions />}
      >
        <Routes>
          <Route path="/" element={<DayDashboardPage />} />
          <Route path="/day" element={<DayDashboardPage />} />

          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/task/:taskId" element={<TaskDetailPage />} />

          <Route path="/client-profile" element={<ClientProfilePage />} />
        <Route path="/client-profile/:id" element={<ClientProfilePage />} />
        <Route path="/client-profile/:id/edit" element={<ClientProfileEditPage />} />

          <Route path="/internal-processes" element={<InternalProcessesPage />} />
          <Route path="/process-coverage" element={<ProcessCoveragePage />} />

          <Route path="/analytics" element={<AnalyticsPage />} />

          <Route path="/control-events" element={<ControlEventsPage />} />
          <Route path="/internal-control-events-store" element={<InternalControlEventsStorePage />} />
          <Route path="/documents" element={<DocumentsPage />} />

          <Route path="/client-process-overview" element={<ClientProcessOverviewPage />} />
          <Route path="/client-process-overview/step/:stepId" element={<ClientProcessStepPage />} />
          <Route path="/client-process-overview/event/:eventId" element={<ClientControlEventPage />} />

          <Route path="/client-create" element={<ClientCreatePage />} />
<Route path="/process-chains-dev" element={<ProcessChainsDevPage />} />
          <Route path="/onboarding-clients" element={<OnboardingClientsPage />} />
        <Route path="/onboarding" element={<OnboardingStubPage />} />
</Routes>
      </ErpShell>
    </Router>
    </SidePanelProvider>
  );
}

export default App;