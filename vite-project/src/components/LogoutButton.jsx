import PropTypes from "prop-types";
import API, { isSuccess } from "../api/client.js";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function LogoutButton({ className = "" }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const response = await API.post("/auth/logout");
      const result = response.data;

      if (!isSuccess(response)) {
        throw new Error(result.message || "Could not sign out.");
      }

      navigate("/auth/login", {
        replace: true,
        state: { message: result.message || "You have been signed out." },
      });
    } catch (logoutError) {
      setError(logoutError.message || "Could not connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="logout-control">
      <button
        className={className}
        type="button"
        onClick={handleLogout}
        disabled={busy}
      >
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <small className="logout-error" role="alert">
          {error}
        </small>
      )}
    </span>
  );
}

LogoutButton.propTypes = {
  className: PropTypes.string,
};

export default LogoutButton;
