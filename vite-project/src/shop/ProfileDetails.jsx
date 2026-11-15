import API, { isSuccess } from "../api/client.js";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./ProfileDetails.css";

function ProfileDetails() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [defaultAddress, setDefaultAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      try {
        const profileResponse = await API.get("/auth/me");
        const profileResult = profileResponse.data;

        if (!isSuccess(profileResponse)) {
          throw new Error(
            profileResult.message || "Could not load your profile.",
          );
        }

        if (!isMounted) return;
        setUser(profileResult.user);

        const addressResponse = await API.get("/profile/addresses");

        if (isSuccess(addressResponse)) {
          const addressResult = addressResponse.data;
          const address =
            addressResult.addresses?.find((item) => item.isDefault) || null;

          if (isMounted) setDefaultAddress(address);
        }
      } catch (requestError) {
        if (isMounted) setError(requestError.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <p className="profile-status">Loading your profile…</p>;
  }

  if (error && !user) {
    return (
      <p className="profile-status profile-error" role="alert">
        {error}
      </p>
    );
  }

  if (!user) {
    return (
      <p className="profile-status">Profile information is unavailable.</p>
    );
  }

  const firstName = user.fullName?.trim().split(/\s+/)[0] || "there";

  return (
    <div className="profile-details">
      <header className="profile-heading">
        <p className="profile-eyebrow">YOUR PRIVATE SANCTUARY</p>
        <h1>Account &amp; Personal Preferences</h1>
        <p>
          Keep your ShopEase details up to date and ready for your next order.
        </p>
      </header>

      <section className="profile-welcome-card">
        <div>
          <span className="profile-member-badge">✦ SHOP EASE MEMBER</span>
          <h2>Warm welcome, {firstName}</h2>
          <p>
            Your account details and personal referral code are gathered here.
          </p>
        </div>
        <div className="profile-welcome-icon profile-avatar" aria-hidden="true">
          {user.profilePhotoUrl ? (
            <img src={user.profilePhotoUrl} alt="" />
          ) : (
            firstName.charAt(0).toUpperCase()
          )}
        </div>
      </section>

      <section className="profile-info-card">
        <div className="profile-card-heading">
          <div>
            <h2>Personal Information</h2>
            <p>Manage the details associated with your account.</p>
          </div>
          <span className="profile-card-icon" aria-hidden="true">
            ♙
          </span>
        </div>

        <div className="profile-info-grid">
          <div className="profile-info-item">
            <span>Full name</span>
            <strong>{user.fullName}</strong>
          </div>
          <div className="profile-info-item">
            <span>Email address</span>
            <strong>{user.email}</strong>
          </div>
          <div className="profile-info-item profile-referral-number">
            <span>Your referral number</span>
            <strong>{user.personalReferralCode || "Not assigned yet"}</strong>
          </div>
        </div>
        <div className="profile-form-actions">
          <button
            className="profile-primary-button"
            type="button"
            onClick={() => navigate("/home/account/edit")}
          >
            ✎ &nbsp; Update profile
          </button>
        </div>
        <div className="profile-default-address">
          <div>
            <span>Default delivery address</span>
            {defaultAddress ? (
              <strong>
                {defaultAddress.addressLine1}, {defaultAddress.city},{" "}
                {defaultAddress.state} {defaultAddress.postalCode}
              </strong>
            ) : (
              <strong>No default address saved</strong>
            )}
          </div>
          <Link to="/home/account/addresses">
            {defaultAddress ? "Manage addresses" : "Add address"}
          </Link>
        </div>
        {error && (
          <p className="profile-error-message" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="profile-referral-card">
        <div className="profile-referral-art" aria-hidden="true">
          REFER
          <br />
          &amp; EARN
        </div>
        <div>
          <p className="profile-eyebrow">SHARE A LITTLE CALM</p>
          <h2>Refer and earn</h2>
          <p>Invite friends to ShopEase with your personal referral code.</p>
          <div className="profile-code">
            <span>Your code</span>
            <strong>{user.personalReferralCode || "Not assigned yet"}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProfileDetails;
