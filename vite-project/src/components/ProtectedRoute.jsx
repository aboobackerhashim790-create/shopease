import PropTypes from "prop-types";
import API, { isSuccess } from "../api/client.js";
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

function ProtectedRoute({ children, requiredRole }) {
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

  if (!user) {
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
