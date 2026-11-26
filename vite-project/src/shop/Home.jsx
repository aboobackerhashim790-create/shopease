import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import API, { isSuccess } from "../api/client.js";
import StoreProductCard from "./store/StoreProductCard.jsx";
import "./store/StorePages.css";

// Fetch enough recent products to fill both five-card homepage sections.
const LATEST_PRODUCT_LIMIT = 10;
const FEATURED_PRODUCT_LIMIT = 5;
const HOME_SECTION_LIMIT = 5;

function getRequestErrorMessage(error, fallbackMessage) {
  return error.response?.data?.message || error.message || fallbackMessage;
}

function HomePage() {
  const navigate = useNavigate();
  const { runProtectedAction, refreshShopCounts, wishlistIds = [] } = useOutletContext();

  const [categories, setCategories] = useState([]);
  const [latestProducts, setLatestProducts] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      try {
        const response = await API.get("/store/categories");

        if (active && isSuccess(response)) {
          setCategories(response.data.categories || []);
        }
      } catch {
        // The home page can still show products if categories fail to load.
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadHomeProducts() {
      setLoading(true);
      setError("");

      const categoryFilter = selectedCategoryId ? { categoryId: selectedCategoryId } : {};

      try {
        const [latestResponse, featuredResponse] = await Promise.all([
          API.get("/store/products", {
            params: {
              ...categoryFilter,
              sort: "newest",
              page: 1,
              limit: LATEST_PRODUCT_LIMIT,
            },
          }),
          API.get("/store/products", {
            params: {
              ...categoryFilter,
              featured: true,
              sort: "newest",
              page: 1,
              limit: FEATURED_PRODUCT_LIMIT,
            },
          }),
        ]);

        if (!active) return;

        if (!isSuccess(latestResponse)) {
          throw new Error(latestResponse.data.message || "Could not load the storefront.");
        }

        setLatestProducts(latestResponse.data.products || []);
        setFeaturedProducts(
          isSuccess(featuredResponse) ? featuredResponse.data.products || [] : [],
        );
      } catch (requestError) {
        if (active) {
          setError(getRequestErrorMessage(requestError, "Could not load the storefront."));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHomeProducts();

    return () => {
      active = false;
    };
  }, [selectedCategoryId]);

  // The category API sorts by sortOrder ascending, so keep its first three roots.
  const topLevelCategories = categories
    .filter((category) => !category.parentCategoryId)
    .slice(0, 3);

  const essentials = featuredProducts.length
    ? featuredProducts
    : latestProducts.slice(0, HOME_SECTION_LIMIT);

  const essentialProductIds = new Set(essentials.map((product) => product._id));

  const trendingProducts = latestProducts
    .filter((product) => !essentialProductIds.has(product._id))
    .slice(0, HOME_SECTION_LIMIT);

  const selectedCategoryName =
    categories.find((category) => category._id === selectedCategoryId)?.name || "this category";

  function openCategory(category) {
    setSelectedCategoryId(category?._id || "");
  }

  async function sendAddToCartRequest(product, variantId) {
    try {
      const response = await API.post("/store/cart/items", {
        productId: product._id,
        variantId,
        quantity: 1,
      });

      if (!isSuccess(response)) {
        throw new Error(response.data.message || "Could not add this item.");
      }

      await refreshShopCounts();
      setNotice(`${product.name} added to your cart.`);
    } catch (requestError) {
      setNotice(getRequestErrorMessage(requestError, "Could not add this item."));
    }
  }

  function addToCart(product, variantId) {
    runProtectedAction(() => sendAddToCartRequest(product, variantId));
  }

  function buyNow(product, variantId) {
    runProtectedAction(() =>
      navigate("/home/checkout", {
        state: { buyNow: { productId: product._id, variantId: variantId || null, quantity: 1 } },
      }),
    );
  }

  async function sendWishlistRequest(product) {
    try {
      const isWished = wishlistIds.includes(product._id);
      const response = isWished
        ? await API.delete(`/store/wishlist/items/${product._id}`)
        : await API.post(`/store/wishlist/items/${product._id}`);

      if (!isSuccess(response)) {
        throw new Error(response.data.message || "Could not update your wishlist.");
      }

      await refreshShopCounts();
    } catch (requestError) {
      setNotice(getRequestErrorMessage(requestError, "Could not update your wishlist."));
    }
  }

  function toggleWishlist(product) {
    runProtectedAction(() => sendWishlistRequest(product));
  }

  function renderProductSection(title, eyebrow, products) {
    return (
      <section className="home-store-section">
        <div className="home-store-section__heading">
          <div>
            <span className="store-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <Link to="/home/products">
            View all <span aria-hidden="true">→</span>
          </Link>
        </div>

        {products.length > 0 ? (
          <div className="home-store-products">
            {products.map((product) => (
              <StoreProductCard
                key={product._id}
                product={product}
                wished={wishlistIds.includes(product._id)}
                onAdd={addToCart}
                onBuyNow={buyNow}
                onToggleWishlist={toggleWishlist}
              />
            ))}
          </div>
        ) : (
          <p className="store-muted">No products to show in this selection yet.</p>
        )}
      </section>
    );
  }

  return (
    <div className="home-store-page">
      <section className="home-store-hero">
        <div className="home-store-hero__copy">
          <span className="home-store-label">● HANDPICKED GADGETS</span>
          <h1>
            Everyday tools,
            <br />
            <em>mindfully crafted.</em>
          </h1>
          <p>
            Discover useful technology, thoughtful accessories, and reliable gadgets for the way you
            work and live.
          </p>
          <Link className="home-store-cta" to="/home/products">
            Explore collection <span>→</span>
          </Link>
          <div className="home-store-promise">
            <span>✓</span>
            <div>
              <strong>Quality you can rely on</strong>
              <small>Carefully selected products for everyday use.</small>
            </div>
          </div>
        </div>

        <div className="home-store-hero__photo">
          <img
            src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1400&q=85"
            alt="Premium headphones"
          />
          <span>Thoughtful tech. Better everyday.</span>
        </div>
      </section>

      <section className="home-store-categories">
        <div className="home-store-section__heading">
          <div>
            <span className="store-eyebrow">FIND YOUR NEXT FAVORITE</span>
            <h2>Shop by category</h2>
          </div>
          <Link to="/home/products">
            All categories <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="home-store-category-list">
          <button
            className={!selectedCategoryId ? "is-selected" : ""}
            type="button"
            onClick={() => openCategory(null)}
          >
            All categories <span aria-hidden="true">↗</span>
          </button>

          {topLevelCategories.length > 0
            ? topLevelCategories.map((category) => (
                <button
                  key={category._id}
                  className={selectedCategoryId === category._id ? "is-selected" : ""}
                  type="button"
                  onClick={() => openCategory(category)}
                >
                  {category.name} <span aria-hidden="true">↗</span>
                </button>
              ))
            : !loading && (
                <span className="store-muted">Categories will appear here when you add them.</span>
              )}
        </div>
      </section>

      {notice && (
        <p className="home-store-notice" role="status">
          {notice}
        </p>
      )}

      {error && (
        <div className="store-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="store-panel store-empty">Loading the latest products…</div>
      ) : (
        <>
          {renderProductSection(
            selectedCategoryId
              ? `Featured in ${selectedCategoryName}`
              : "Refined tools for focused days.",
            "FEATURED ESSENTIALS",
            essentials,
          )}
          {renderProductSection(
            selectedCategoryId
              ? `More to explore in ${selectedCategoryName}`
              : "Discover what’s new.",
            "TRENDING STUDIO ESSENTIALS",
            trendingProducts,
          )}
        </>
      )}
    </div>
  );
}

export default HomePage;
