import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import API, { isSuccess } from "../../api/client.js";
import StoreProductCard from "./StoreProductCard.jsx";
import "./StorePages.css";

function WishlistPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    authLoaded,
    refreshShopCounts,
    wishlistIds = [],
    runProtectedAction,
  } = useOutletContext();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadWishlist = useCallback(async () => {
    const response = await API.get("/store/wishlist");
    if (response.status === 401) {
      navigate("/auth/login", { state: { from: location }, replace: true });
      return;
    }
    if (!isSuccess(response))
      throw new Error(response.data.message || "Could not load your wishlist.");
    setItems(response.data.items || []);
  }, [location, navigate]);

  useEffect(() => {
    if (!authLoaded) return;
    if (!user) {
      navigate("/auth/login", { state: { from: location }, replace: true });
      return;
    }
    let active = true;
    setLoading(true);
    loadWishlist()
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authLoaded, user, location, navigate, loadWishlist]);

  function removeFromWishlist(product) {
    runProtectedAction(() => {
      (async () => {
        const response = await API.delete(`/store/wishlist/items/${product._id}`);
        if (!isSuccess(response))
          throw new Error(response.data.message || "Could not remove this item.");
        await Promise.all([loadWishlist(), refreshShopCounts()]);
      })().catch((requestError) =>
        setError(requestError.response?.data?.message || requestError.message),
      );
    });
  }

  function addToCart(product, variantId) {
    runProtectedAction(() => {
      (async () => {
        const response = await API.post("/store/cart/items", {
          productId: product._id,
          variantId,
          quantity: 1,
        });
        if (!isSuccess(response))
          throw new Error(response.data.message || "Could not add this item to your cart.");
        setNotice(`${product.name} was added to your cart and removed from your wishlist.`);
        await Promise.all([loadWishlist(), refreshShopCounts()]);
      })().catch((requestError) =>
        setError(requestError.response?.data?.message || requestError.message),
      );
    });
  }

  function buyNow(product, variantId) {
    runProtectedAction(() =>
      navigate("/home/checkout", {
        state: { buyNow: { productId: product._id, variantId: variantId || null, quantity: 1 } },
      }),
    );
  }

  if (loading)
    return (
      <section className="store-page">
        <div className="store-panel store-empty">Loading wishlist…</div>
      </section>
    );
  return (
    <section className="store-page">
      <div className="store-page__heading">
        <div>
          <span className="store-eyebrow">SAVED FOR LATER</span>
          <h1>Your wishlist</h1>
          <p className="store-muted">
            Saved items stay here until you remove them or add them to your cart.
          </p>
        </div>
      </div>
      {error && (
        <div className="store-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="store-result-line" role="status">
          {notice}
        </p>
      )}
      {items.length === 0 ? (
        <div className="store-panel store-empty">
          <h2>Your wishlist is empty</h2>
          <p className="store-muted">Save products you may want later.</p>
          <Link className="store-button store-button--primary" to="/home/products">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="store-wishlist-list">
          {items.map(
            (entry) =>
              entry.product && (
                <StoreProductCard
                  key={entry.product._id}
                  product={entry.product}
                  available={entry.available}
                  wished={wishlistIds.includes(entry.product._id)}
                  onAdd={addToCart}
                  onBuyNow={buyNow}
                  onToggleWishlist={removeFromWishlist}
                />
              ),
          )}
        </div>
      )}
    </section>
  );
}

export default WishlistPage;
