import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import TasksBoardPage from "./pages/TasksBoardPage";

const App = () => (
  <Router>
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-800 text-white px-4 py-3">
        <nav className="flex gap-2 text-sm">
          <NavLink to="/tasks" className="px-2 py-1 rounded-md bg-slate-900 text-white">Tasks</NavLink>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        <Routes>
          <Route path="/tasks" element={<TasksBoardPage />} />
          <Route path="*" element={<div>Home</div>} />
        </Routes>
      </main>
    </div>
  </Router>
);

export default App;