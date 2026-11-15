import PropTypes from "prop-types";
import API, { isSuccess } from "../api/client.js";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

function GuestRoute({ children }) {
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
        if (isMounted) setUser(result?.user || null);
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

  if (loading) return null;

  if (user) {
    const destination = user.role === "admin" ? "/admin" : "/home";
    return <Navigate to={destination} replace />;
  }

  return children;
}

GuestRoute.propTypes = {
  children: PropTypes.node.isRequired,
};

export default GuestRoute;
