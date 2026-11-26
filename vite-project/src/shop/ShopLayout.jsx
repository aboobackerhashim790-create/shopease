import API, { isSuccess } from "../api/client.js";
import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import LogoutButton from "../components/LogoutButton";
import "./ShopLayout.css";

function ShopLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [wishlistIds, setWishlistIds] = useState([]);

  useEffect(() => {
    let active = true;
    API.get("/auth/me")
      .then(async (response) => (isSuccess(response) ? response.data.user : null))
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setAuthLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const refreshShopCounts = useCallback(async () => {
    if (!user) {
      setCartCount(0);
      setWishlistIds([]);
      return;
    }
    try {
      const [cartResponse, wishlistResponse] = await Promise.all([
        API.get("/store/cart"),
        API.get("/store/wishlist"),
      ]);
      if (isSuccess(cartResponse)) {
        setCartCount(
          (cartResponse.data.cart?.items || []).reduce((total, item) => total + item.quantity, 0),
        );
      }
      if (isSuccess(wishlistResponse)) {
        setWishlistIds(
          (wishlistResponse.data.items || []).map((entry) => entry.product?._id).filter(Boolean),
        );
      }
    } catch {
      setCartCount(0);
      setWishlistIds([]);
    }
  }, [user]);

  useEffect(() => {
    if (authLoaded) refreshShopCounts();
  }, [authLoaded, refreshShopCounts]);

  async function runProtectedAction(action) {
    let currentUser = user;

    if (!authLoaded) {
      try {
        const response = await API.get("/auth/me");
        const result = isSuccess(response) ? response.data : null;
        currentUser = result?.user || null;
        setUser(currentUser);
      } catch {
        currentUser = null;
      } finally {
        setAuthLoaded(true);
      }
    }

    if (!currentUser) {
      navigate("/auth/login", { state: { from: location } });
      return;
    }
    action?.();
  }

  return (
    <div className="shop-layout">
      <header className="shop-header">
        <div className="shop-logo">
          <span className="shop-logo-icon">S</span>
          <span>ShopEase</span>
        </div>

        <nav className="shop-nav" aria-label="Main navigation">
          <NavLink to="/home">Home</NavLink>
          <NavLink to="/home/products">Products</NavLink>
          <NavLink to="/home/account">Account</NavLink>
        </nav>

        <div className="shop-header-actions">
          <form
            className="shop-header-search"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(
                `/home/products${searchText.trim() ? `?search=${encodeURIComponent(searchText.trim())}` : ""}`,
              );
            }}
          >
            <input
              aria-label="Search products"
              placeholder="Search gadgets..."
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <button type="submit" aria-label="Submit product search">
              ⌕
            </button>
          </form>
          <Link
            className="shop-icon-link"
            to="/home/wishlist"
            aria-label={`Wishlist, ${wishlistIds.length} items`}
          >
            ♡{wishlistIds.length > 0 && <span>{wishlistIds.length}</span>}
          </Link>
          <Link className="shop-icon-link" to="/home/cart" aria-label={`Cart, ${cartCount} items`}>
            🛒{cartCount > 0 && <span>{cartCount}</span>}
          </Link>
          {user ? (
            <LogoutButton className="shop-logout-button" />
          ) : (
            <Link className="shop-login-link" to="/auth/login" state={{ from: location }}>
              Sign In
            </Link>
          )}
        </div>
      </header>

      <main className={`shop-content${location.pathname === "/home" ? " shop-content--home" : ""}`}>
        <Outlet
          context={{
            user,
            authLoaded,
            runProtectedAction,
            refreshShopCounts,
            wishlistIds,
          }}
        />
      </main>

      <footer className="shop-footer">
        <div className="shop-logo">
          <span className="shop-logo-icon">S</span>
          <span>ShopEase</span>
        </div>

        <p>Mindful tools for calmer, more intentional workdays.</p>

        <nav className="shop-footer-nav" aria-label="Footer navigation">
          <NavLink to="/home/products">Products</NavLink>
          <NavLink to="/home/cart">Cart</NavLink>
          <NavLink to="/home/wishlist">Wishlist</NavLink>
          <NavLink to="/home/account">Account</NavLink>
        </nav>

        <small>© 2025 ShopEase. Mindful commerce.</small>
      </footer>
    </div>
  );
}

export default ShopLayout;
