import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Layout from './components/Layout/Layout';
import ProtectedRoute, { roleHome } from './components/ProtectedRoute';
import Spinner from './components/Spinner';
import { useAuthStore } from './store/authStore';

const Login = lazy(() => import('./pages/Login'));
const Landing = lazy(() => import('./pages/Landing'));
const PublicApply = lazy(() => import('./pages/recruitment/PublicApply'));
const PublicInterview = lazy(() => import('./pages/ai/PublicInterview'));

const AdminDashboard = lazy(() => import('./pages/dashboards/AdminDashboard'));
const ManagerDashboard = lazy(() => import('./pages/dashboards/ManagerDashboard'));
const RecruiterDashboard = lazy(() => import('./pages/dashboards/RecruiterDashboard'));
const EmployeeDashboard = lazy(() => import('./pages/dashboards/EmployeeDashboard'));

const EmployeeList = lazy(() => import('./pages/employees/EmployeeList'));
const EmployeeProfile = lazy(() => import('./pages/employees/EmployeeProfile'));
const EmployeeForm = lazy(() => import('./pages/employees/EmployeeForm'));
const Departments = lazy(() => import('./pages/employees/Departments'));
const AttendancePage = lazy(() => import('./pages/attendance/AttendancePage'));
const TodayAttendance = lazy(() => import('./pages/attendance/TodayAttendance'));
const LeavePage = lazy(() => import('./pages/leave/LeavePage'));
const LeaveApproval = lazy(() => import('./pages/leave/LeaveApproval'));

const PayrollPage = lazy(() => import('./pages/payroll/PayrollPage'));
const PayslipDetail = lazy(() => import('./pages/payroll/PayslipDetail'));
const PayrollAdmin = lazy(() => import('./pages/payroll/PayrollAdmin'));

const PerformancePage = lazy(() => import('./pages/performance/PerformancePage'));
const PerformanceTeam = lazy(() => import('./pages/performance/PerformanceTeam'));

const JobsList = lazy(() => import('./pages/recruitment/JobsList'));
const JobForm = lazy(() => import('./pages/recruitment/JobForm'));
const CandidateKanban = lazy(() => import('./pages/recruitment/CandidateKanban'));

const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const ResumeScreener = lazy(() => import('./pages/ai/ResumeScreener'));
const InterviewRoom = lazy(() => import('./pages/ai/InterviewRoom'));
const AttritionRisk = lazy(() => import('./pages/ai/AttritionRisk'));
const SentimentPulse = lazy(() => import('./pages/ai/SentimentPulse'));
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'));
const AnalyticsDashboard = lazy(() => import('./pages/analytics/AnalyticsDashboard'));
const PolicyManagement = lazy(() => import('./pages/ai/PolicyManagement'));

function RootRedirect() {
  const { token, role } = useAuthStore();
  if (!token) return <Navigate to="/" replace />;
  return <Navigate to={roleHome(role)} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="bottom-left" toastOptions={{ duration: 3500 }} />
      <Suspense fallback={<Spinner label="Loading page..." />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/apply/:jobId" element={<PublicApply />} />
          <Route path="/interview/:sessionId" element={<PublicInterview />} />

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
            <Route path="/admin/ai/resume-screener" element={<ResumeScreener />} />
            <Route path="/admin/ai/interview" element={<InterviewRoom />} />
            <Route path="/admin/ai/attrition" element={<AttritionRisk />} />
            <Route path="/admin/ai/sentiment" element={<SentimentPulse />} />
            <Route path="/admin/ai/audit" element={<AuditLogs />} />
            <Route path="/admin/analytics" element={<AnalyticsDashboard />} />
            <Route path="/admin/ai/policy" element={<PolicyManagement />} />
          </Route>

          {/* Manager */}
          <Route element={<ProtectedRoute allowedRoles={['senior_manager']}><Layout /></ProtectedRoute>}>
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/manager/team" element={<EmployeeList />} />
            <Route path="/manager/team/:id" element={<EmployeeProfile />} />
            <Route path="/manager/attendance" element={<TodayAttendance />} />
            <Route path="/manager/leave" element={<LeaveApproval />} />
            <Route path="/manager/performance" element={<PerformanceTeam />} />
            <Route path="/manager/ai/attrition" element={<AttritionRisk />} />
            <Route path="/manager/ai/sentiment" element={<SentimentPulse />} />
          </Route>

          {/* Recruiter */}
          <Route element={<ProtectedRoute allowedRoles={['hr_recruiter']}><Layout /></ProtectedRoute>}>
            <Route path="/recruiter" element={<RecruiterDashboard />} />
            <Route path="/recruiter/jobs" element={<JobsList />} />
            <Route path="/recruiter/jobs/new" element={<JobForm />} />
            <Route path="/recruiter/candidates" element={<CandidateKanban />} />
            <Route path="/recruiter/ai/resume-screener" element={<ResumeScreener />} />
            <Route path="/recruiter/ai/interview" element={<InterviewRoom />} />
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
