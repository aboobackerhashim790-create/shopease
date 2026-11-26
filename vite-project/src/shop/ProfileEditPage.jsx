import API, { isSuccess } from "../api/client.js";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./ProfileEditPage.css";

function ProfileEditPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    API.get("/auth/me")
      .then(async (response) => {
        const result = response.data;
        if (!isSuccess(response)) throw new Error(result.message || "Could not load your profile.");
        setUser(result.user);
        setFullName(result.user.fullName || "");
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await API.patch("/profile/me", { fullName });
      const result = response.data;
      if (!isSuccess(response)) throw new Error(result.message || "Could not update your profile.");
      setUser((current) => ({ ...current, ...result.user }));
      navigate("/home/account", { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhoto(event) {
    event.preventDefault();
    if (!photo) {
      setError("Choose a photo first.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.append("photo", photo);
      const response = await API.post("/profile/photo", body);
      const result = response.data;
      if (!isSuccess(response)) throw new Error(result.message || "Could not upload your photo.");
      setUser((current) => ({ ...current, ...result.user }));
      setPhoto(null);
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="profile-edit-page">
      <header className="account-page-heading">
        <p className="account-eyebrow">PERSONAL DETAILS</p>
        <h1>Edit your profile</h1>
        <p>Update your name and profile photo.</p>
      </header>
      {loading && (
        <p className="profile-edit-notice" role="status">
          Loading profile…
        </p>
      )}
      {error && (
        <p className="profile-edit-notice error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="profile-edit-notice" role="status">
          {message}
        </p>
      )}
      {user && (
        <section className="profile-edit-panel">
          <div className="profile-edit-photo">
            {user.profilePhotoUrl ? (
              <img src={user.profilePhotoUrl} alt="Your profile" />
            ) : (
              <span>{user.fullName?.charAt(0)?.toUpperCase() || "U"}</span>
            )}
          </div>
          <form onSubmit={uploadPhoto} className="profile-edit-form">
            <label>
              Profile photo (JPG, PNG, or WebP; up to 5 MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setPhoto(event.target.files?.[0] || null)}
              />
            </label>
            <button type="submit" disabled={busy}>
              {busy ? "Uploading…" : "Upload photo"}
            </button>
          </form>
          <form onSubmit={saveProfile} className="profile-edit-form">
            <label>
              Full name
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                minLength={2}
                maxLength={100}
                required
              />
            </label>
            <label>
              Email address
              <input value={user.email || ""} readOnly />
            </label>
            <div className="profile-edit-actions">
              <Link to="/home/account">Cancel</Link>
              <button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save profile"}
              </button>
            </div>
          </form>
        </section>
      )}
    </section>
  );
}

export default ProfileEditPage;
