import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Activate from "./pages/Activate";
import HRPanel from "./pages/hr/HRPanel";
import Login from "./pages/Login";
import Requests from "./pages/Requests";
import { Academy, Assistant, CourseView, Notifications, RequestDetail, RequestNew, Team } from "./pages/stubs";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/activate" element={<Activate />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/new" element={<RequestNew />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="team" element={<RequireAuth roles={["manager", "hr"]}><Team /></RequireAuth>} />
        <Route path="academy" element={<Academy />} />
        <Route path="academy/:id" element={<CourseView />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="hr" element={<RequireAuth roles={["hr"]}><HRPanel /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
