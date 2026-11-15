import { Outlet } from "react-router-dom";
import Sidebar from "./sidebar";
import Navbar from "./Navbar";
import "./layout.css";

function AdminLayout() {
  return (
    <div className="admin-layout">
      <Sidebar />

      <div className="admin-main">
        <Navbar />
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
