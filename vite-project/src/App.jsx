import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./auth/LoginPage";
import Signup from "./auth/SignupPage";
import VerifyEmail from "./auth/VerifyEmailPage";
import ForgotPassword from "./auth/ForgotPasswordPage";
import LegalPage from "./LegalPage";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import ShopLayout from "./shop/ShopLayout";
import HomePage from "./shop/Home.jsx";
import ProductsPage from "./shop/store/ProductsPage.jsx";
import ProductDetailsPage from "./shop/store/ProductDetailsPage.jsx";
import CartPage from "./shop/store/CartPage.jsx";
import WishlistPage from "./shop/store/WishlistPage.jsx";
import ProfileLayout from "./shop/ProfileLayout";
import ProfileDetails from "./shop/ProfileDetails";
import ProfileEditPage from "./shop/ProfileEditPage";
import OrdersPage from "./shop/OrdersPage";
import AddressesPage from "./shop/AddressPage";
import AccountSettingsPage from "./shop/AccountSettingsPage";
import WalletPage from "./shop/WalletPage.jsx";
import AdminLayout from "./admin/Layout-management/adminlayout.jsx";
import AdminDashboard from "./admin/adminDashboard";
import AdminUser from "./admin/user-management/UserManagementPage";
import AdminUserDetail from "./admin/user-management/UserDetailPage";
import AdminProducts from "./admin/Product-management/adminproducts.jsx";
import AdminOrders from "./admin/adminorders";
import AdminCoupons from "./admin/adminCoupons.jsx";
import OfferCampaignsPage from "./admin/offer-campaigns/OfferCampaignsPage.jsx";
import CategoryManagementPage from "./admin/category-management/categorymanagementpage";
import CheckoutPage from "./shop/store/CheckoutPage.jsx";
import OrderConfirmationPage from "./shop/store/OrderConfirmationPage.jsx";
import HelpCenterPage from "./shop/HelpCenterPage.jsx";
import SupportRequestsPage from "./admin/support/SupportRequestsPage.jsx";
import ReturnRequestsPage from "./admin/ReturnRequestsPage.jsx";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />
        <Route
          path="/auth/signup"
          element={
            <GuestRoute>
              <Signup />
            </GuestRoute>
          }
        />
        <Route
          path="/auth/verify-email"
          element={
            <GuestRoute>
              <VerifyEmail />
            </GuestRoute>
          }
        />
        <Route
          path="/auth/forgot-password"
          element={
            <GuestRoute>
              <ForgotPassword />
            </GuestRoute>
          }
        />

        <Route path="/terms" element={<LegalPage type="terms" />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
        <Route path="/" element={<Navigate to="/home" replace />} />

        <Route path="/home" element={<ShopLayout />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:slug" element={<ProductDetailsPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="order-confirmation" element={<OrderConfirmationPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route
            path="account"
            element={
              <ProtectedRoute requiredRole="customer">
                <ProfileLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ProfileDetails />} />
            <Route path="edit" element={<ProfileEditPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="addresses" element={<AddressesPage />} />
            <Route path="settings" element={<AccountSettingsPage />} />
            <Route path="help" element={<HelpCenterPage />} />
            <Route path="legal/terms" element={<LegalPage type="terms" accountPage />} />
            <Route path="legal/privacy" element={<LegalPage type="privacy" accountPage />} />
          </Route>
        </Route>

        <Route
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUser />} />
          <Route path="/admin/users/:userId" element={<AdminUserDetail />} />
          <Route path="/admin/products" element={<AdminProducts />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          <Route path="/admin/returns" element={<ReturnRequestsPage />} />
          <Route path="/admin/support" element={<SupportRequestsPage />} />
          <Route path="/admin/coupons" element={<AdminCoupons />} />
          <Route path="/admin/offer-campaigns" element={<OfferCampaignsPage />} />
          <Route path="/admin/category" element={<CategoryManagementPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
