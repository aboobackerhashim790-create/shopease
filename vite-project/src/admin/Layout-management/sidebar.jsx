import { NavLink } from "react-router-dom";
import LogoutButton from "../../components/LogoutButton";

function Sidebar() {
  return (
    <aside className="admin-sidebar">
      <div className="admin-brand">
        <span className="admin-brand-icon">S</span>
        <div>
          <strong>ShopEase</strong>
          <small>ADMIN PANEL</small>
        </div>
      </div>
      <nav className="admin-nav">
        <NavLink to="/admin" end className="admin-nav-link">
          <span>▦</span> Dashboard
        </NavLink>

        <NavLink to="/admin/users" className="admin-nav-link">
          <span>♙</span> Users
        </NavLink>

        <NavLink to="/admin/category" className="admin-nav-link">
          <span>□</span> Category
        </NavLink>

        <NavLink to="/admin/products" className="admin-nav-link">
          <span>□</span> Products
        </NavLink>

        <NavLink to="/admin/orders" className="admin-nav-link">
          <span>▤</span> Orders
        </NavLink>
        <NavLink to="/admin/returns" className="admin-nav-link">
          <span>↩</span> Returns
        </NavLink>
        <NavLink to="/admin/support" className="admin-nav-link">
          <span>✉</span> Help requests
        </NavLink>
        <NavLink to="/admin/coupons" className="admin-nav-link">
          <span>%</span> Coupons
        </NavLink>
        <NavLink to="/admin/offer-campaigns" className="admin-nav-link">
          <span>✦</span> Offer campaigns
        </NavLink>
      </nav>

      <div className="admin-sidebar-bottom">
        <LogoutButton className="admin-nav-link admin-signout-button" />
      </div>
    </aside>
  );
}

export default Sidebar;
