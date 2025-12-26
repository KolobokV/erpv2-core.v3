import { createBrowserRouter } from "react-router-dom";

import DayDashboardPage from "./pages/DayDashboardPage";
import TasksPage from "./pages/TasksPage";
import ClientsPage from "./pages/ClientsPage";
import ProcessesPage from "./pages/ProcessesPage";

export const router = createBrowserRouter([
  { path: "/", element: <DayDashboardPage /> },
  { path: "/day", element: <DayDashboardPage /> },
  { path: "/tasks", element: <TasksPage /> },
  { path: "/clients", element: <ClientsPage /> },
  { path: "/processes", element: <ProcessesPage /> }
]);