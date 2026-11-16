import PropTypes from "prop-types";
import API, { isSuccess } from "../api/client.js";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

function ProtectedRoute({ children, requiredRole }) {
  // If a logged‑in user lands on the login page (e.g., via back button),
  // immediately redirect them to the appropriate home page.
  // This prevents the back button from showing the login screen again.
  const navigateIfLoggedIn = (user) => {
    if (user && location.pathname.startsWith('/auth/login')) {
      const target = user.role === 'admin' ? '/admin' : '/home';
      return <Navigate to={target} replace />;
    }
    return null;
  };

  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkSignIn() {
      try {
        const response = await API.get("/auth/me");

        if (!isSuccess(response)) {
          if (isMounted) setUser(null);
          return;
        }

        const result = response.data;
        if (isMounted) setUser(result.user);
      } catch {
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkSignIn();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) return <p>Checking your session...</p>;

  if (user && location.pathname.startsWith('/auth/login')) {
    // User is already authenticated but landed on login page (e.g., via back button)
    const target = user.role === 'admin' ? '/admin' : '/home';
    return <Navigate to={target} replace />;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  if (requiredRole && user.role !== requiredRole) {
    const correctPage = user.role === "admin" ? "/admin" : "/home";
    return <Navigate to={correctPage} replace />;
  }

  return children;
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  requiredRole: PropTypes.string,
};

export default ProtectedRoute;
