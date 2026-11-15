import { NavLink, Outlet } from "react-router-dom";
import LogoutButton from "../components/LogoutButton";
import "./ProfileLayout.css";

function ProfileLayout() {
  return (
    <div className="profile-layout">
      <aside className="profile-sidebar">
        <h2>My Account</h2>

        <nav className="profile-menu" aria-label="Account menu">
          <NavLink to="." end>
            Profile Details
          </NavLink>
          <NavLink to="orders">Orders &amp; Tracking</NavLink>
          <NavLink to="wallet">ShopEase Wallet</NavLink>
          <NavLink to="addresses">Saved Addresses</NavLink>
          <NavLink to="settings">Settings &amp; Security</NavLink>
          <NavLink to="help">Help Center</NavLink>
          <NavLink to="legal/terms">Legal &amp; Policies</NavLink>
          <LogoutButton className="profile-logout-button" />
        </nav>
      </aside>

      <section className="profile-page-content">
        <Outlet />
      </section>
    </div>
  );
}

export default ProfileLayout;
