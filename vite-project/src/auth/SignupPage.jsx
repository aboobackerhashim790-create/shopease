import API, { isSuccess } from "../api/client.js";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GoogleSignInButton from "./GoogleSignInButton";
import "./signup.css";

function validateField(field, value, form) {
  if (field === "fullName") {
    const normalizedName = value.trim().replace(/\s+/g, " ");
    if (!normalizedName) return "Full name is required.";
    if (normalizedName.length < 2 || normalizedName.length > 100) {
      return "Name must be between 2 and 100 characters.";
    }
    if (!/^[\p{L}\p{M}]+(?:[ '\u2019.-][\p{L}\p{M}]+)*$/u.test(normalizedName)) {
      return "Use letters and normal name separators only.";
    }
  }
  if (field === "email") {
    const email = value.trim();
    if (!email) return "Email address is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
    const [username, domain] = email.split("@");
    if (domain.toLowerCase() === "gmail.com" && (username.length < 6 || username.length > 30)) {
      return "Gmail usernames must be 6–30 characters before @gmail.com.";
    }
  }
  if (field === "password") {
    if (!value) return "Password is required.";
    if (value.length < 8) return "Password must be at least 8 characters.";
    if (!/[a-zA-Z]/.test(value)) return "Password must contain at least one letter.";
    if (!/\d/.test(value)) return "Password must contain at least one number.";
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(value)) {
      return "Password must contain at least one punctuation or special character.";
    }
  }
  if (field === "confirmPassword") {
    if (!value) return "Please confirm your password.";
    if (value !== form.password) return "The passwords do not match.";
  }
  return "";
}

function Signup() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    referralCode: "",
    password: "",
    confirmPassword: "",
    agreed: false,
  });
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    const nextForm = {
      ...form,
      [name]: nextValue,
    };
    setForm(nextForm);
    if (name !== "referralCode") {
      setTouched((current) => ({ ...current, [name]: true }));
      setFieldErrors((current) => ({
        ...current,
        [name]: name === "agreed" ? (nextValue ? "" : "Please agree to the terms.") : validateField(name, String(nextValue), nextForm),
        ...(name === "password" && touched.confirmPassword
          ? { confirmPassword: validateField("confirmPassword", form.confirmPassword, nextForm) }
          : {}),
      }));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setMessage("");

    const fields = ["fullName", "email", "password", "confirmPassword"];
    const nextErrors = Object.fromEntries(
      fields.map((field) => [field, validateField(field, form[field], form)]),
    );
    if (!form.agreed) nextErrors.agreed = "Please agree to the Terms of Service and Privacy Policy.";
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true, agreed: true });
    setFieldErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await API.post("/auth/signup", {
        fullName: form.fullName,
        email: form.email,
        referralCode: form.referralCode,
        password: form.password,
      });

      const result = response.data;

      if (isSuccess(response)) {
        navigate("/auth/verify-email", {
          state: { email: form.email },
        });
      } else if (result.needsVerification && result.email) {
        // A pending signup already exists; continue its verification flow.
        navigate("/auth/verify-email", {
          state: { email: result.email },
        });
      } else {
        setFieldErrors(result.fieldErrors || {});
        setMessage(result.message);
      }
    } catch (error) {
      console.error("Sign-up error:", error);
      setFieldErrors(error.response?.data?.fieldErrors || {});
      setMessage(
        error.response?.data?.message || "Could not connect to the server.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="signup-page">
      <header className="brand">
        <span className="brand-icon">♧</span>
        <span>ShopEase</span>
      </header>

      <section className="signup-card">
        <h1>Create your account</h1>

        {message && (
          <p className="signup-message" role="alert" aria-live="polite">
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            name="fullName"
            required
            value={form.fullName}
            onChange={handleChange}
            placeholder="♙  E.g. Maya Chen"
            aria-invalid={Boolean(fieldErrors.fullName)}
            className={touched.fullName ? (fieldErrors.fullName ? "field-invalid" : "field-valid") : ""}
          />
          {touched.fullName && <span className={`signup-field-feedback ${fieldErrors.fullName ? "is-error" : "is-success"}`}>{fieldErrors.fullName || "Looks good."}</span>}

          <label htmlFor="signupEmail">Email Address</label>
          <input
            id="signupEmail"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="✉  maya.chen@example.com"
            aria-invalid={Boolean(fieldErrors.email)}
            className={touched.email ? (fieldErrors.email ? "field-invalid" : "field-valid") : ""}
          />
          {touched.email && <span className={`signup-field-feedback ${fieldErrors.email ? "is-error" : "is-success"}`}>{fieldErrors.email || "Looks good."}</span>}

          <div className="signup-label-row">
            <label htmlFor="referralCode">Referral code</label>
            <span>Optional</span>
          </div>
          <input
            id="referralCode"
            name="referralCode"
            value={form.referralCode}
            onChange={handleChange}
            placeholder="Eg: 808943"
            aria-invalid={Boolean(fieldErrors.referralCode)}
            className={fieldErrors.referralCode ? "field-invalid" : ""}
          />
          {fieldErrors.referralCode && (
            <span className="signup-field-feedback is-error">{fieldErrors.referralCode}</span>
          )}

          <div className="signup-label-row password-label">
            <label htmlFor="signupPassword">Create Password</label>
            <span>8+ chars with letter, number & symbol</span>
          </div>
          <div className="signup-password-wrap">
            <input
              id="signupPassword"
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              placeholder="🔒  Min 8 chars, letter, number & symbol"
              aria-invalid={Boolean(fieldErrors.password)}
              className={touched.password ? (fieldErrors.password ? "field-invalid" : "field-valid") : ""}
            />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg>
            </button>
          </div>
          {touched.password && <span className={`signup-field-feedback ${fieldErrors.password ? "is-error" : "is-success"}`}>{fieldErrors.password || "Looks good."}</span>}

          <div className="signup-label-row password-label">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <span>Type it again</span>
          </div>
          <div className="signup-password-wrap">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="🔒  Re-enter your password"
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              className={touched.confirmPassword ? (fieldErrors.confirmPassword ? "field-invalid" : "field-valid") : ""}
            />
            <button type="button" aria-label={showConfirmPassword ? "Hide password" : "Show password"} onClick={() => setShowConfirmPassword((visible) => !visible)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showConfirmPassword && <path d="m3 3 18 18" />}</svg>
            </button>
          </div>
          {touched.confirmPassword && <span className={`signup-field-feedback ${fieldErrors.confirmPassword ? "is-error" : "is-success"}`}>{fieldErrors.confirmPassword || "Looks good."}</span>}

          <label className="terms-row">
            <input
              name="agreed"
              type="checkbox"
              checked={form.agreed}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.agreed)}
            />
            <span>
              I agree to the{" "}
              <Link to="/terms" target="_blank" rel="noreferrer">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" target="_blank" rel="noreferrer">
                Privacy Policy
              </Link>
            </span>
          </label>
          {touched.agreed && fieldErrors.agreed && <span className="signup-field-feedback is-error">{fieldErrors.agreed}</span>}

          <button className="create-account-button" type="submit" disabled={submitting}>
            {submitting ? "Creating account…" : <>Create Account <span>→</span></>}
          </button>
        </form>
        <div className="divider">
          <span>OR CONTINUE WITH</span>
        </div>

        <GoogleSignInButton buttonText="signup_with" />

        <div className="signin-prompt">
          Already a member? <Link to="/auth/login">Sign In</Link>
        </div>
      </section>
    </main>
  );
}

export default Signup;
