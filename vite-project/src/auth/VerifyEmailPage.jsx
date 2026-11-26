import API, { isSuccess } from "../api/client.js";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./verifyemail.css";

function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const codeInputRef = useRef(null);

  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
  const [editingEmail, setEditingEmail] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(60);
  const [resending, setResending] = useState(false);
  const [remainingResends, setRemainingResends] = useState(3);

  useEffect(() => {
    if (remainingSeconds <= 0) return;
    const timerId = window.setTimeout(() => {
      setRemainingSeconds((seconds) => seconds - 1);
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [remainingSeconds]);

  async function handleResendCode() {
    if (remainingSeconds > 0 || resending) return;

    setResending(true);
    setMessage("");

    try {
      const response = await API.post("/auth/resend-verification", { email });

      const result = response.data;

      if (typeof result.remainingResends === "number") {
        setRemainingResends(result.remainingResends);
      }
      if (result.retryAfterSeconds) {
        setRemainingSeconds(result.retryAfterSeconds);
      }

      if (!isSuccess(response)) {
        setMessage(result.message || "Could not resend the code.");
        return;
      }

      setMessage(result.message);
    } catch (error) {
      console.error("Resend code error:", error);
      setMessage(
        error.response?.data?.message || error.message || "Could not resend the verification code.",
      );
    } finally {
      setResending(false);
    }
  }

  const formattedTime = `00:${String(remainingSeconds).padStart(2, "0")}`;
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (code.length !== 6) {
      setMessage("Please enter the complete 6-digit code.");
      return;
    }

    setLoading(true);

    try {
      const response = await API.post("/auth/verify-email", { email, code });

      const result = response.data;

      if (!isSuccess(response)) {
        setMessage(result.message || "Could not verify your email.");
        return;
      }

      navigate("/auth/login", {
        replace: true,
        state: { message: result.message },
      });
    } catch (error) {
      console.error("Verification error:", error);
      setMessage("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="verify-page">
      <section className="verify-card">
        <div className="verify-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48">
            <path d="M24 5 9 11v11c0 10 6.4 17.8 15 21 8.6-3.2 15-11 15-21V11L24 5Z" />
            <path d="m17 23 5 5 10-11" />
          </svg>
          <span className="verify-lock">●</span>
        </div>

        <h1>Verify Gmail</h1>
        <p className="verify-description">
          We sent a 6-digit verification code to
          <br />
          <strong>{email || "your email address"}</strong>
        </p>

        <button
          className="edit-email-button"
          type="button"
          onClick={() => setEditingEmail((current) => !current)}
        >
          {editingEmail ? "Done" : "Edit Gmail"}
          <span aria-hidden="true">{editingEmail ? " ✓" : " ✎"}</span>
        </button>

        {editingEmail && (
          <label className="verify-email-label">
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
        )}

        <form onSubmit={handleSubmit}>
          <div className="otp-boxes" onClick={() => codeInputRef.current?.focus()}>
            {Array.from({ length: 6 }, (_, index) => (
              <span
                className={`otp-box ${code.length === index ? "otp-box-current" : ""}`}
                key={index}
              >
                {code[index] || ""}
              </span>
            ))}

            <input
              ref={codeInputRef}
              className="otp-hidden-input"
              aria-label="6-digit verification code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          </div>

          <button
            className="resend-button"
            type="button"
            onClick={handleResendCode}
            disabled={remainingSeconds > 0 || remainingResends <= 0 || resending}
          >
            {resending
              ? "Sending code…"
              : remainingResends <= 0
                ? "No resends left"
                : remainingSeconds > 0
                  ? `Resend code in ${formattedTime}`
                  : `Resend code (${remainingResends} left)`}
          </button>

          <button className="verify-submit-button" type="submit" disabled={loading}>
            {loading ? "Verifying…" : "Verify & Continue"}
            {!loading && <span aria-hidden="true"> →</span>}
          </button>
        </form>

        {message && (
          <p className="verify-message" role="alert">
            {message}
          </p>
        )}

        <button
          type="button"
          className="verify-back-button"
          onClick={() => navigate("/auth/signup")}
        >
          ← Back to signup
        </button>
      </section>
    </main>
  );
}

export default VerifyEmail;
