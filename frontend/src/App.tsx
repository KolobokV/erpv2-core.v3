import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import "./styles/erp_shell.css";
import "./ux/sidePanelEngine.css";
import { ErpShell, type ErpNavItem } from "./components/layout/ErpShell";
import { SidePanelProvider } from "./components/ux/SidePanelEngine";
import { MoscowClock } from "./ui/time/MoscowClock";
import { t } from "./i18n/t";

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
import ReglementPage from "./pages/ReglementPage";
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
  { to: "/day", label: t("nav.day") },
  { to: "/tasks", label: t("nav.tasks") },
  { to: "/client-profile", label: t("nav.clients") },
  { to: "/documents", label: t("nav.documents") },
  { to: "/reglement", label: t("nav.reglement") },
];

function RightActions() {
  const clientId = getClientFromUrl();
  const hrefDay = clientId ? ("/day?client=" + encodeURIComponent(clientId)) : "/day";
  const hrefTasks = clientId ? ("/tasks?client=" + encodeURIComponent(clientId)) : "/tasks";

  return (
    <div className="erp-right">
      <MoscowClock />
      <div className="erp-right-actions">
<a className="erp-btn" href={hrefDay}>
        {t("nav.day")}
      </a>
      <a className="erp-btn" href={hrefTasks}>
        {t("nav.tasks")}
      </a>
      </div>
    </div>
  );}

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

          <Route path="/reglement" element={<ReglementPage />} />

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