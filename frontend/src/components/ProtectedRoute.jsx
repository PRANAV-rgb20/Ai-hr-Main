import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { token, role } = useAuthStore();

  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={roleHome(role)} replace />;
  }
  return children;
}

export const roleHome = (role) => {
  switch (role) {
    case 'management_admin': return '/admin';
    case 'senior_manager': return '/manager';
    case 'hr_recruiter': return '/recruiter';
    case 'employee': return '/employee';
    default: return '/login';
  }
};
