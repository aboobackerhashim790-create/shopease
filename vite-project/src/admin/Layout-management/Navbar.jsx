import { useLocation } from "react-router-dom";

function Navbar() {
  const location = useLocation();

  const pageTitles = {
    "/admin": "Dashboard",
    "/admin/users": "User Management",
    "/admin/products": "Products",
    "/admin/orders": "Orders",
    "/admin/support": "Help requests",
    "/admin/category": "Category",
  };

  const title = pageTitles[location.pathname] || "Admin";

  return (
    <header className="admin-navbar">
      <div>
        <p className="admin-navbar-label">ShopEase / Admin</p>
        <h1>{title}</h1>
      </div>

      <div className="admin-navbar-profile">
        <span className="admin-avatar">A</span>
        <div>
          <strong>Administrator</strong>
          <small>Admin account</small>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
