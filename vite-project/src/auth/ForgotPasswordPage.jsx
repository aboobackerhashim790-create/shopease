import API, { isSuccess } from "../api/client.js";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./ForgotPassword.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [remainingResends, setRemainingResends] = useState(3);
  const requestCodeInFlight = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const timer = window.setTimeout(
      () => setRemainingSeconds((seconds) => seconds - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [remainingSeconds]);

  async function requestCode(event) {
    event.preventDefault();
    if (requestCodeInFlight.current) return;
    requestCodeInFlight.current = true;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await API.post("/auth/forgot-password", { email });
      const result = response.data;
      if (typeof result.remainingResends === "number")
        setRemainingResends(result.remainingResends);
      if (result.retryAfterSeconds)
        setRemainingSeconds(result.retryAfterSeconds);
      if (!isSuccess(response))
        throw new Error(result.message || "Could not request a reset code.");
      setCodeSent(true);
      setMessage(result.message);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not request a reset code.",
      );
    } finally {
      requestCodeInFlight.current = false;
      setBusy(false);
    }
  }

  async function submitReset(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const response = await API.post("/auth/reset-password", {
        email,
        code,
        newPassword,
      });
      const result = response.data;
      if (!isSuccess(response))
        throw new Error(result.message || "Could not reset your password.");
      navigate("/auth/login", { replace: true, state: { message: result.message } });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="forgot-page">
      <Link to="/auth/login" className="forgot-brand">
        <span>S</span> ShopEase
      </Link>
      <section className="forgot-card">
        <div className="forgot-icon" aria-hidden="true">
          ⌑
        </div>
        <p className="forgot-eyebrow">ACCOUNT RECOVERY</p>
        <h1>Reset your password</h1>
        <p className="forgot-description">
          We’ll email you a one-time code so you can choose a new password.
        </p>
        {message && (
          <p className="forgot-notice" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="forgot-notice forgot-error" role="alert">
            {error}
          </p>
        )}
        {!codeSent ? (
          <form onSubmit={requestCode}>
            <label htmlFor="reset-email">Email address</label>
            <input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button type="submit" disabled={busy || remainingSeconds > 0}>
              {busy
                ? "Sending…"
                : remainingSeconds > 0
                  ? `Resend available in 00:${String(remainingSeconds).padStart(2, "0")}`
                  : "Send reset code"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitReset}>
            <label htmlFor="reset-email-readonly">Email address</label>
            <input
              id="reset-email-readonly"
              type="email"
              value={email}
              readOnly
              required
            />
            <label htmlFor="reset-code">6-digit code</label>
            <input
              id="reset-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              required
            />
            <label htmlFor="reset-new-password">New password</label>
            <div className="forgot-password-wrap">
              <input
                id="reset-new-password"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              <button type="button" aria-label={showNewPassword ? "Hide password" : "Show password"} onClick={() => setShowNewPassword((visible) => !visible)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showNewPassword && <path d="m3 3 18 18" />}</svg>
              </button>
            </div>
            <label htmlFor="reset-confirm-password">Confirm new password</label>
            <div className="forgot-password-wrap">
              <input
                id="reset-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
              <button type="button" aria-label={showConfirmPassword ? "Hide password" : "Show password"} onClick={() => setShowConfirmPassword((visible) => !visible)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showConfirmPassword && <path d="m3 3 18 18" />}</svg>
              </button>
            </div>
            <button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Reset password"}
            </button>
            <button
              className="forgot-secondary-button"
              type="button"
              disabled={busy || remainingSeconds > 0 || remainingResends <= 0}
              onClick={requestCode}
            >
              {busy
                ? "Sending…"
                : remainingResends <= 0
                  ? "No resends left"
                  : remainingSeconds > 0
                    ? `Resend code in 00:${String(remainingSeconds).padStart(2, "0")}`
                    : `Resend code (${remainingResends} left)`}
            </button>
            {remainingResends <= 0 && (
              <p className="forgot-description">
                You’ve used all 3 resend attempts. Please try again after this
                code expires.
              </p>
            )}
          </form>
        )}
        <Link to="/auth/login" className="forgot-back-link">
          ← Back to sign in
        </Link>
      </section>
    </main>
  );
}

export default ForgotPassword;
