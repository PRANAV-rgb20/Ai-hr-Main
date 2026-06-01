import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Login from './pages/Login';
import Layout from './components/Layout/Layout';
import ProtectedRoute, { roleHome } from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';

import AdminDashboard from './pages/dashboards/AdminDashboard';
import ManagerDashboard from './pages/dashboards/ManagerDashboard';
import RecruiterDashboard from './pages/dashboards/RecruiterDashboard';
import EmployeeDashboard from './pages/dashboards/EmployeeDashboard';

import EmployeeList from './pages/employees/EmployeeList';
import EmployeeProfile from './pages/employees/EmployeeProfile';
import EmployeeForm from './pages/employees/EmployeeForm';
import Departments from './pages/employees/Departments';
import AttendancePage from './pages/attendance/AttendancePage';
import TodayAttendance from './pages/attendance/TodayAttendance';
import LeavePage from './pages/leave/LeavePage';
import LeaveApproval from './pages/leave/LeaveApproval';

import PayrollPage from './pages/payroll/PayrollPage';
import PayslipDetail from './pages/payroll/PayslipDetail';
import PayrollAdmin from './pages/payroll/PayrollAdmin';

import PerformancePage from './pages/performance/PerformancePage';
import PerformanceTeam from './pages/performance/PerformanceTeam';

import JobsList from './pages/recruitment/JobsList';
import JobForm from './pages/recruitment/JobForm';
import CandidateKanban from './pages/recruitment/CandidateKanban';
import PublicApply from './pages/recruitment/PublicApply';

import ReportsPage from './pages/reports/ReportsPage';
import SettingsPage from './pages/settings/SettingsPage';

function RootRedirect() {
  const { token, role } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(role)} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="bottom-right" toastOptions={{ duration: 3500 }} />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/apply/:jobId" element={<PublicApply />} />

        {/* Admin */}
        <Route element={<ProtectedRoute allowedRoles={['management_admin']}><Layout /></ProtectedRoute>}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/employees" element={<EmployeeList />} />
          <Route path="/admin/employees/new" element={<EmployeeForm />} />
          <Route path="/admin/employees/:id" element={<EmployeeProfile />} />
          <Route path="/admin/employees/:id/edit" element={<EmployeeForm />} />
          <Route path="/admin/departments" element={<Departments />} />
          <Route path="/admin/attendance" element={<TodayAttendance />} />
          <Route path="/admin/leave" element={<LeaveApproval />} />
          <Route path="/admin/payroll" element={<PayrollAdmin />} />
          <Route path="/admin/performance" element={<PerformanceTeam />} />
          <Route path="/admin/recruitment" element={<JobsList />} />
          <Route path="/admin/recruitment/new" element={<JobForm />} />
          <Route path="/admin/recruitment/candidates" element={<CandidateKanban />} />
          <Route path="/admin/reports" element={<ReportsPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>

        {/* Manager */}
        <Route element={<ProtectedRoute allowedRoles={['senior_manager']}><Layout /></ProtectedRoute>}>
          <Route path="/manager" element={<ManagerDashboard />} />
          <Route path="/manager/team" element={<EmployeeList />} />
          <Route path="/manager/attendance" element={<TodayAttendance />} />
          <Route path="/manager/leave" element={<LeaveApproval />} />
          <Route path="/manager/performance" element={<PerformanceTeam />} />
        </Route>

        {/* Recruiter */}
        <Route element={<ProtectedRoute allowedRoles={['hr_recruiter']}><Layout /></ProtectedRoute>}>
          <Route path="/recruiter" element={<RecruiterDashboard />} />
          <Route path="/recruiter/jobs" element={<JobsList />} />
          <Route path="/recruiter/jobs/new" element={<JobForm />} />
          <Route path="/recruiter/candidates" element={<CandidateKanban />} />
        </Route>

        {/* Employee */}
        <Route element={<ProtectedRoute allowedRoles={['employee']}><Layout /></ProtectedRoute>}>
          <Route path="/employee" element={<EmployeeDashboard />} />
          <Route path="/employee/attendance" element={<AttendancePage />} />
          <Route path="/employee/leave" element={<LeavePage />} />
          <Route path="/employee/payslips" element={<PayrollPage />} />
          <Route path="/employee/payslips/:id" element={<PayslipDetail />} />
          <Route path="/employee/performance" element={<PerformancePage />} />
        </Route>

        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
