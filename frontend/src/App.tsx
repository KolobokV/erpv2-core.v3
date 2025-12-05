import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";

import TasksDashboard from "./pages/TasksDashboard";
import ClientProfilePage from "./pages/ClientProfilePage";
import InternalProcessesPage from "./pages/InternalProcessesPage";
import ProcessCoveragePage from "./pages/ProcessCoveragePage";
import ControlEventsPage from "./pages/ControlEventsPage";

import InternalControlEventsPage from "./pages/InternalControlEventsPage";

const linkStyle = (isActive: boolean): React.CSSProperties => ({
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid #d1d5db",
  fontSize: 12,
  textDecoration: "none",
  marginLeft: 6,
  backgroundColor: isActive ? "#111827" : "#ffffff",
  color: isActive ? "#ffffff" : "#1f2933",
  display: "inline-block",
});

const App: React.FC = () => {
  return (
    <Router>
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f8fafc",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            backgroundColor: "#ffffff",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <div
            style={{
              maxWidth: 960,
              margin: "0 auto",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#111827",
                whiteSpace: "nowrap",
              }}
            >
              ERPv2 Control Panel
            </div>

            <nav style={{ display: "flex", alignItems: "center" }}>
              <NavLink to="/tasks" style={({ isActive }) => linkStyle(isActive)}>
                Tasks
              </NavLink>

              <NavLink
                to="/control-events"
                style={({ isActive }) => linkStyle(isActive)}
              >
                Control events
              </NavLink>

              <NavLink
                to="/internal-control-events-store"
                style={({ isActive }) => linkStyle(isActive)}
              >
                Control events store
              </NavLink>

              <NavLink
                to="/internal-processes"
                style={({ isActive }) => linkStyle(isActive)}
              >
                Internal processes
              </NavLink>

              <NavLink
                to="/client-profile"
                style={({ isActive }) => linkStyle(isActive)}
              >
                Client profile
              </NavLink>

              <NavLink
                to="/process-coverage"
                style={({ isActive }) => linkStyle(isActive)}
              >
                Process coverage
              </NavLink>
            </nav>
          </div>
        </header>

        <main
          style={{
            flex: 1,
            maxWidth: 960,
            width: "100%",
            margin: "0 auto",
            padding: "16px",
          }}
        >
          <Routes>
            <Route path="/" element={<Navigate to="/tasks" replace />} />

            <Route path="/tasks" element={<TasksDashboard />} />

            <Route path="/control-events" element={<ControlEventsPage />} />

            <Route
              path="/internal-control-events-store"
              element={<InternalControlEventsPage />}
            />

            <Route
              path="/internal-processes"
              element={<InternalProcessesPage />}
            />

            <Route path="/client-profile" element={<ClientProfilePage />} />

            <Route
              path="/process-coverage"
              element={<ProcessCoveragePage />}
            />

            {/* legacy */}
            <Route
              path="/internal"
              element={<Navigate to="/internal-processes" replace />}
            />
            <Route
              path="/client/:clientId"
              element={<Navigate to="/client-profile" replace />}
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
