import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import "./LegalPage.css";

const policyContent = {
  terms: {
    label: "SHOP EASE · TERMS",
    title: "Terms of Service",
    intro:
      "These terms explain the basic rules for using the current ShopEase application.",
    sections: [
      [
        "Using ShopEase",
        "By creating an account or using account features, you agree to these terms. You must provide accurate account details and use the service lawfully.",
      ],
      [
        "Your account",
        "Keep your password and verification codes private. You are responsible for activity performed through your account. Contact the ShopEase operator if you believe someone else has accessed it.",
      ],
      [
        "Email verification and password recovery",
        "ShopEase may send one-time codes to verify an email address or help reset a password. Codes expire and resend attempts are limited. Never share a code with another person.",
      ],
      [
        "Profile and addresses",
        "You may update your profile name and manage saved delivery addresses. Make sure saved details are accurate. Address information is used to support account and delivery-related features.",
      ],
      [
        "Catalog and referrals",
        "The current catalog and referral area are part of this project and may be examples or unfinished features. Product descriptions, prices, availability, and referral rewards should not be treated as a confirmed offer unless the app provides a completed checkout or specific reward terms.",
      ],
      [
        "Acceptable use",
        "Do not misuse the service, attempt unauthorized access, interfere with the app, or use another person's account or personal information without permission.",
      ],
      [
        "Changes and availability",
        "ShopEase may change or temporarily suspend features as the application is developed. These terms should be updated if the app adds purchases, payments, shipping, or other services.",
      ],
      [
        "Questions",
        "For now, contact the ShopEase project operator through the channel provided to you by the project owner. A public production version should provide a dedicated support contact here.",
      ],
    ],
  },
  privacy: {
    label: "SHOP EASE · PRIVACY",
    title: "Privacy Policy",
    intro:
      "This page describes the information the current ShopEase application uses to provide its account features.",
    sections: [
      [
        "Information you provide",
        "The app can store your name, email address, an optional referral code used during signup, and delivery-address details such as recipient name, phone number, and address. If you use password sign-in, the server stores a password hash rather than your plain-text password.",
      ],
      [
        "Verification and recovery codes",
        "Signup and password-reset codes are stored as hashes and are used to verify your email or reset your password. Codes expire after a limited time. Do not share a code with anyone.",
      ],
      [
        "Session cookie",
        "After sign-in, the browser receives an HTTP-only cookie named shopease.sid. It contains a session identifier; the associated session data is stored server-side in MongoDB. The current development configuration sets the cookie lifetime to 24 hours.",
      ],
      [
        "How information is used",
        "ShopEase uses account details to create and identify your account, verify your email, recover access, display your profile, and save your addresses. Admin users can access customer account details and saved addresses for the project's administrative features.",
      ],
      [
        "Service providers",
        "The app uses MongoDB for application and session data, an email service to deliver verification and reset messages, and Google sign-in when you choose that option. Those providers process information needed for the feature you use.",
      ],
      [
        "Your choices",
        "You can edit your profile name and manage saved addresses in account settings. The current app does not provide a self-service account deletion feature, so a production release should add a support contact and account-deletion process.",
      ],
      [
        "Security and retention",
        "The app uses password hashing, hashed verification codes, and an HTTP-only session cookie. No online service can promise perfect security. Data is retained in the application's database while the account and related records remain; this project does not yet provide a complete retention schedule.",
      ],
      [
        "Policy updates",
        "This policy should be revised when ShopEase adds features or changes its data practices. A production release should include the operator's legal name, contact information, and any jurisdiction-specific details.",
      ],
    ],
  },
};

function LegalPage({ type, accountPage }) {
  const policy = policyContent[type];
  const backPath = accountPage ? "/home/account" : "/auth/signup";

  return (
    <main className={`legal-page${accountPage ? " legal-page--account" : ""}`}>
      <header className="legal-header">
        <Link to="/home" className="legal-brand">
          <span>S</span> ShopEase
        </Link>
        <Link to={backPath} className="legal-back-link">
          {accountPage ? "Back to my account" : "Back to sign up"}
        </Link>
      </header>

      <article className="legal-card">
        {accountPage && (
          <nav className="legal-policy-tabs" aria-label="Legal policies">
            <Link
              to="/home/account/legal/terms"
              className={type === "terms" ? "active" : ""}
              aria-current={type === "terms" ? "page" : undefined}
            >
              Terms and Conditions
            </Link>
            <Link
              to="/home/account/legal/privacy"
              className={type === "privacy" ? "active" : ""}
              aria-current={type === "privacy" ? "page" : undefined}
            >
              Privacy Policy
            </Link>
          </nav>
        )}
        <p className="legal-eyebrow">{policy.label}</p>
        <h1>{policy.title}</h1>
        <p className="legal-intro">{policy.intro}</p>
        <p className="legal-review-note">
          ShopEase project policy · Updated October 22, 2026
        </p>

        <div className="legal-sections">
          {policy.sections.map(([heading, body], index) => (
            <section key={heading}>
              <h2>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {heading}
              </h2>
              <p>{body}</p>
            </section>
          ))}
        </div>

        <div className="legal-footer">
          <Link to={backPath}>
            {accountPage ? "Return to my account" : "Return to create your account"} <span>→</span>
          </Link>
          <p>
            These are starter policies for the current ShopEase project. Review
            and customize them before using the app as a public commercial
            service.
          </p>
        </div>
      </article>
    </main>
  );
}

LegalPage.propTypes = {
  type: PropTypes.oneOf(["terms", "privacy"]).isRequired,
  accountPage: PropTypes.bool,
};

LegalPage.defaultProps = {
  accountPage: false,
};

export default LegalPage;
