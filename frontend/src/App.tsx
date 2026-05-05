import { BrowserRouter, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./layouts/AppShell";
import GenerateProblems from "./pages/GenerateProblems";
import Home from "./pages/Home";
import Login from "./pages/Login";
import ProblemDetail from "./pages/ProblemDetail";
import ProblemList from "./pages/ProblemList";
import Profile from "./pages/Profile";
import QuizMode from "./pages/QuizMode";
import Settings from "./pages/Settings";
import Stats from "./pages/Stats";
import WrongNotes from "./pages/WrongNotes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth pages (no AppShell) */}
        <Route path="/login" element={<Login />} />

        {/* App shell wraps all app pages */}
        <Route element={<AppShell />}>
          {/* Publicly accessible */}
          <Route path="/" element={<Home />} />
          <Route path="/problems" element={<ProblemList />} />
          <Route path="/problems/:id" element={<ProblemDetail />} />
          <Route path="/quiz" element={<QuizMode />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/wrong-notes" element={<WrongNotes />} />
          <Route path="/stats" element={<Stats />} />

          {/* Requires login */}
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/generate" element={<GenerateProblems />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
