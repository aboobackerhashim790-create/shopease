import API, { isSuccess } from "../api/client.js";
import "../App.css";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import GoogleSignInButton from "./GoogleSignInButton";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState(location.state?.message || "");
  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    try {
      const response = await API.post("/auth/login", { email, password });

      const result = response.data;

      if (!isSuccess(response)) {
        setMessage(result.message || "Sign-in failed.");
        return;
      }

      const role = result.user?.role;

      if (!role) {
        setMessage("The server response is missing the user role.");
        return;
      }

      const requestedPath = location.state?.from;
      const requestedCustomerPath = requestedPath
        ? `${requestedPath.pathname || ""}${requestedPath.search || ""}${requestedPath.hash || ""}`
        : null;
      navigate(role === "admin" ? "/admin" : requestedCustomerPath || "/home", {
        replace: true,
      });
    } catch (error) {
      console.error("Sign-in error:", error);
      setMessage("Could not connect to the server.");
    }
  }
  return (
    <>
      <main className="page">
        <header className="brand">
          <span className="brand-icon">♧</span>
          <span>ShopEase</span>
        </header>

        <section className="login-card">
          <div className="lock-icon">🔒</div>
          <p className="eyebrow">WELCOME BACK</p>
          <h1>Access your calm sanctuary</h1>

          <div className="mode-label">↪ Sign In</div>

          <form onSubmit={handleSubmit}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              
            />

            <div className="password-heading">
              <label htmlFor="password">Password</label>
              <Link to="/auth/forgot-password">Forgot password?</Link>
            </div>
            <div className="password-input-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                className="password-visibility-button"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />{showPassword && <path d="m3 3 18 18" />}</svg>
              </button>
            </div>

            <button className="sign-in-button" type="submit">
              Sign In to ShopEase <span>→</span>
            </button>
          </form>
          <p>{message}</p>
          <div className="divider">
            <span>OR CONTINUE WITH</span>
          </div>

          <GoogleSignInButton buttonText="signin_with" />

          <p className="signup-prompt">
            Don’t have an account? <Link to="/auth/signup"> Sign Up ›</Link>
          </p>
        </section>
        <footer>© 2025 ShopEase. Mindful commerce for everyday calm.</footer>
      </main>
    </>
  );
}
export default Login;
