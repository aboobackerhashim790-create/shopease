import PropTypes from "prop-types";
import API, { isSuccess } from "../api/client.js";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

let initializedClientId = null;
let activeGoogleCallback = null;

function GoogleSignInButton({ buttonText = "continue_with" }) {
  const buttonContainer = useRef(null);
  const navigate = useNavigate();
  const clientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    "124181113746-0e0l591gp3ntcmhqotdhdb8t4j47jsac.apps.googleusercontent.com";
  const [message, setMessage] = useState(() =>
    clientId ? "" : "Google Client ID is missing from the Vite .env file.",
  );

  useEffect(() => {
    if (!clientId) return;

    let cancelled = false;
    let script;

    const handleCredential = async (googleResponse) => {
      try {
        const response = await API.post("/auth/google", {
          credential: googleResponse.credential,
        });

        const result = response.data;
        if (!isSuccess(response)) {
          setMessage(result.message || "Google sign-in failed.");
          return;
        }

        navigate(result.user?.role === "admin" ? "/admin" : "/home", {
          replace: true,
        });
      } catch (error) {
        console.error("Google sign-in error:", error);
        setMessage("Could not connect to the server.");
      }
    };

    activeGoogleCallback = handleCredential;

    function initializeGoogleButton() {
      if (
        cancelled ||
        !window.google?.accounts?.id ||
        !buttonContainer.current
      ) {
        return;
      }

      if (initializedClientId !== clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (googleResponse) => activeGoogleCallback?.(googleResponse),
        });
        initializedClientId = clientId;
      }

      buttonContainer.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonContainer.current, {
        theme: "outline",
        size: "large",
        text: buttonText,
        shape: "pill",
        width: 280,
      });
    }

    function showScriptError() {
      if (!cancelled) setMessage("Could not load Google Sign-In.");
    }

    if (window.google?.accounts?.id) {
      initializeGoogleButton();
    } else {
      script = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]',
      );

      if (!script) {
        script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      script.addEventListener("load", initializeGoogleButton);
      script.addEventListener("error", showScriptError);
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", initializeGoogleButton);
      script?.removeEventListener("error", showScriptError);
      if (activeGoogleCallback === handleCredential) {
        activeGoogleCallback = null;
      }
    };
  }, [buttonText, clientId, navigate]);

  return (
    <div>
      <div ref={buttonContainer} className="google-signin-container" />
      <p aria-live="polite">{message}</p>
    </div>
  );
}

GoogleSignInButton.propTypes = {
  buttonText: PropTypes.string,
};

export default GoogleSignInButton;
