import API, { isSuccess } from "../api/client.js";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./AccountSettingsPage.css";
function AccountSettingsPage() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [resendSeconds, setResendSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timerId = window.setTimeout(() => {
      setResendSeconds((seconds) => seconds - 1);
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [resendSeconds]);
  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }
  async function changePassword(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (form.newPassword !== form.confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const response = await API.patch("/profile/password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      const result = response.data;
      if (!isSuccess(response))
        throw new Error(result.message || "Could not change your password.");
      setMessage(result.message);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  async function requestEmailCode(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await API.post("/profile/email-change/request", {
        email: newEmail,
      });
      const result = response.data;
      if (!isSuccess(response))
        throw new Error(result.message || "Could not send verification code.");
      setEmailCodeSent(true);
      setResendSeconds(60);
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  async function verifyEmailCode(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await API.post("/profile/email-change/verify", {
        code: emailCode,
      });
      const result = response.data;
      if (!isSuccess(response))
        throw new Error(result.message || "Could not verify your new email.");
      setEmailCodeSent(false);
      setResendSeconds(0);
      setEmailCode("");
      setNewEmail("");
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="settings-page">
      <header className="account-page-heading">
        <p className="account-eyebrow">ACCOUNT PROTECTION</p>
        <h1>Settings &amp; Security</h1>
        <p>Manage your password and verify changes to your email.</p>
      </header>
      <section className="settings-security-banner">
        <span aria-hidden="true">⌑</span>
        <div>
          <strong>Your account security matters</strong>
          <p>Use a unique password with at least 8 characters.</p>
        </div>
      </section>
      <section className="account-panel settings-password-panel">
        <div className="account-panel-heading">
          <div>
            <h2>Change password</h2>
            <p>Confirm your current password before choosing a new one.</p>
          </div>
          <span aria-hidden="true">🔒</span>
        </div>
        {message && (
          <p className="account-notice" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="account-notice account-notice-error" role="alert">
            {error}
          </p>
        )}
        <form className="settings-password-form" onSubmit={changePassword}>
          <label>
            Current password
            <div className="settings-password-input-wrap">
              <input
                name="currentPassword"
                type={visiblePasswords.current ? "text" : "password"}
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={updateField}
                required
              />
              <button type="button" aria-label={visiblePasswords.current ? "Hide password" : "Show password"} onClick={() => setVisiblePasswords((current) => ({ ...current, current: !current.current }))}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visiblePasswords.current && <path d="m3 3 18 18" />}</svg>
              </button>
            </div>
          </label>
          <label>
            New password
            <div className="settings-password-input-wrap">
              <input
                name="newPassword"
                type={visiblePasswords.new ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={form.newPassword}
                onChange={updateField}
                required
              />
              <button type="button" aria-label={visiblePasswords.new ? "Hide password" : "Show password"} onClick={() => setVisiblePasswords((current) => ({ ...current, new: !current.new }))}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visiblePasswords.new && <path d="m3 3 18 18" />}</svg>
              </button>
            </div>
          </label>
          <label>
            Confirm new password
            <div className="settings-password-input-wrap">
              <input
                name="confirmPassword"
                type={visiblePasswords.confirm ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={form.confirmPassword}
                onChange={updateField}
                required
              />
              <button type="button" aria-label={visiblePasswords.confirm ? "Hide password" : "Show password"} onClick={() => setVisiblePasswords((current) => ({ ...current, confirm: !current.confirm }))}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{visiblePasswords.confirm && <path d="m3 3 18 18" />}</svg>
              </button>
            </div>
          </label>
          <button
            className="account-button account-button-primary"
            type="submit"
            disabled={saving}
          >
            {saving ? "Updating…" : "Update password"}
          </button>
        </form>
        <p className="settings-forgot-link">
          Forgot your current password?{" "}
          <Link to="/auth/forgot-password">Reset it by email</Link>
        </p>
      </section>
      <section className="account-panel settings-password-panel">
        <div className="account-panel-heading">
          <div>
            <h2>Change email address</h2>
            <p>
              We’ll send a 6-digit code to the new address to verify you own it.
            </p>
          </div>
          <span aria-hidden="true">✉</span>
        </div>
        <form
          className="settings-password-form"
          onSubmit={emailCodeSent ? verifyEmailCode : requestEmailCode}
        >
          {!emailCodeSent ? (
            <label>
              New email address
              <input
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                required
              />
            </label>
          ) : (
            <>
              <label>
                New email address
                <input type="email" value={newEmail} readOnly />
              </label>
              <label>
                Verification code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={emailCode}
                  onChange={(event) =>
                    setEmailCode(
                      event.target.value.replace(/\D/g, "").slice(0, 6),
                    )
                  }
                  required
                />
              </label>
            </>
          )}
          <button
            className="account-button account-button-primary"
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Please wait…"
              : emailCodeSent
                ? "Verify and update email"
                : "Send verification code"}
          </button>
          {emailCodeSent && (
            <button
              className="account-button account-button-primary"
              type="button"
              onClick={requestEmailCode}
              disabled={saving || resendSeconds > 0}
            >
              {resendSeconds > 0
                ? `Resend code in ${Math.floor(resendSeconds / 60)}:${String(
                    resendSeconds % 60,
                  ).padStart(2, "0")}`
                : "Resend code"}
            </button>
          )}
        </form>
      </section>
    </section>
  );
}
export default AccountSettingsPage;
