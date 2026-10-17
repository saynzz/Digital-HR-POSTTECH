import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Activate from "./pages/Activate";
import HRPanel from "./pages/hr/HRPanel";
import Login from "./pages/Login";
import Requests from "./pages/Requests";
import Academy from "./pages/Academy";
import Assistant from "./pages/Assistant";
import CourseView from "./pages/CourseView";
import TrackView from "./pages/TrackView";
import Rewards from "./pages/Rewards";
import Notifications from "./pages/Notifications";
import RequestDetail from "./pages/RequestDetail";
import RequestNew from "./pages/RequestNew";
import Team from "./pages/Team";

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
        <Route path="academy/tracks/:id" element={<TrackView />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="academy/:id" element={<CourseView />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="hr" element={<RequireAuth roles={["hr"]}><HRPanel /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
