import API, { isSuccess } from "../../api/client.js";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./UserDetailPage.css";

function UserDetailPage() {
  const { userId } = useParams();
  const [customer, setCustomer] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    API.get(`/admin/users/${userId}`)
      .then(async (response) => {
        const result = response.data;
        if (!isSuccess(response))
          throw new Error(result.message || "Could not load customer details.");
        if (active) {
          setCustomer(result.customer);
          setAddresses(result.addresses);
        }
      })
      .catch((requestError) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading)
    return <p className="customer-detail-state">Loading customer…</p>;
  if (error)
    return (
      <section className="customer-detail-page">
        <p className="customer-detail-error" role="alert">
          {error}
        </p>
        <Link to="/admin/users">← Back to users</Link>
      </section>
    );
  if (!customer) return null;

  return (
    <section className="customer-detail-page">
      <Link className="customer-detail-back" to="/admin/users">
        ← User management
      </Link>
      <header className="customer-detail-heading">
        <div className="customer-detail-avatar">
          {customer.profilePhotoUrl ? (
            <img
              src={customer.profilePhotoUrl}
              alt={`${customer.fullName}'s profile`}
            />
          ) : (
            customer.fullName?.charAt(0)?.toUpperCase() || "C"
          )}
        </div>
        <div>
          <p className="customers-eyebrow">CUSTOMER PROFILE</p>
          <h1>{customer.fullName}</h1>
          <p>{customer.email}</p>
        </div>
        <span
          className={`status-badge ${customer.isBlocked ? "status-blocked" : "status-active"}`}
        >
          {customer.isBlocked ? "Blocked" : "Active"}
        </span>
      </header>
      <section className="customer-detail-card">
        <div className="customer-detail-card-heading">
          <div>
            <h2>Account details</h2>
            <p>Customer information and account status.</p>
          </div>
        </div>
        <div className="customer-detail-grid">
          <div>
            <span>Full name</span>
            <strong>{customer.fullName}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>{customer.email}</strong>
          </div>
          <div>
            <span>Referral code</span>
            <strong>{customer.personalReferralCode || "Not assigned"}</strong>
          </div>
          <div>
            <span>Email verification</span>
            <strong>{customer.isVerified ? "Verified" : "Not verified"}</strong>
          </div>
          <div>
            <span>Joined</span>
            <strong>
              {customer.createdAt
                ? new Date(customer.createdAt).toLocaleDateString()
                : "—"}
            </strong>
          </div>
        </div>
      </section>
      <section className="customer-detail-card">
        <div className="customer-detail-card-heading">
          <div>
            <h2>Saved addresses</h2>
            <p>
              {addresses.length}{" "}
              {addresses.length === 1 ? "address" : "addresses"} saved by this
              customer.
            </p>
          </div>
        </div>
        {addresses.length === 0 ? (
          <p className="customer-detail-state">
            This customer has not saved any addresses.
          </p>
        ) : (
          <div className="customer-address-grid">
            {addresses.map((address) => (
              <article className="customer-address-card" key={address._id}>
                <div className="customer-address-top">
                  <strong>{address.label || "Address"}</strong>
                  {address.isDefault && (
                    <span className="default-address-badge">DEFAULT</span>
                  )}
                </div>
                <p>
                  {address.fullName} · {address.phone}
                </p>
                <p>
                  {address.addressLine1}
                  {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                </p>
                <p>
                  {address.city}, {address.state} {address.postalCode}
                </p>
                <p>{address.country}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default UserDetailPage;
