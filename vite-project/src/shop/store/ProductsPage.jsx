import { useEffect, useState } from "react";
import { Link, useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import API, { isSuccess } from "../../api/client.js";
import StoreProductCard from "./StoreProductCard.jsx";
import "./StorePages.css";

const EMPTY_FILTERS = {
  search: "",
  categoryId: "",
  minPrice: "",
  maxPrice: "",
  sort: "newest",
  page: 1,
};

function ProductsPage() {
  const navigate = useNavigate();
  const {
    runProtectedAction,
    refreshShopCounts,
    wishlistIds = [],
  } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    search: searchParams.get("search") || "",
    categoryId: searchParams.get("categoryId") || "",
  }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    ...EMPTY_FILTERS,
    search: searchParams.get("search") || "",
    categoryId: searchParams.get("categoryId") || "",
  }));
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    totalProducts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedCategory = categories.find(
    (category) => category._id === appliedFilters.categoryId,
  );

  useEffect(() => {
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId") || "";
    setFilters((current) => {
      if (
        current.search === search &&
        current.categoryId === categoryId &&
        current.page === 1
      ) {
        return current;
      }
      return { ...current, search, categoryId, page: 1 };
    });
    setAppliedFilters((current) => {
      if (
        current.search === search &&
        current.categoryId === categoryId &&
        current.page === 1
      ) {
        return current;
      }
      return { ...current, search, categoryId, page: 1 };
    });
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    API.get("/store/categories")
      .then((response) => {
        if (active && isSuccess(response))
          setCategories(response.data.categories || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    API.get("/store/products", {
      params: {
        search: appliedFilters.search || undefined,
        categoryId: appliedFilters.categoryId || undefined,
        minPrice: appliedFilters.minPrice || undefined,
        maxPrice: appliedFilters.maxPrice || undefined,
        sort: appliedFilters.sort,
        page: appliedFilters.page,
        limit: 12,
      },
    })
      .then((response) => {
        if (!active) return;
        if (!isSuccess(response))
          throw new Error(response.data.message || "Could not load products.");
        setProducts(response.data.products || []);
        setPagination(
          response.data.pagination || {
            page: 1,
            totalPages: 1,
            totalProducts: 0,
          },
        );
      })
      .catch((requestError) => {
        if (active)
          setError(requestError.message || "Could not load products.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [appliedFilters]);

  function changeFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  }

  function applyFilters(event) {
    event.preventDefault();
    const nextFilters = { ...filters, page: 1 };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    const next = {};
    if (filters.search.trim()) next.search = filters.search.trim();
    if (filters.categoryId) next.categoryId = filters.categoryId;
    setSearchParams(next);
  }

  function clearFilters() {
    setFilters({ ...EMPTY_FILTERS });
    setAppliedFilters({ ...EMPTY_FILTERS });
    setSearchParams({});
    setNotice("");
  }

  function changePage(nextPage) {
    setFilters((current) => ({ ...current, page: nextPage }));
    setAppliedFilters((current) => ({ ...current, page: nextPage }));
  }

  function addToCart(product, variantId) {
    runProtectedAction(() => {
      setNotice("");
      (async () => {
        try {
          const response = await API.post("/store/cart/items", {
            productId: product._id,
            variantId,
            quantity: 1,
          });
          if (!isSuccess(response))
            throw new Error(
              response.data.message || "Could not add this item.",
            );
          await refreshShopCounts();
          setNotice(`${product.name} added to your cart.`);
        } catch (requestError) {
          setNotice(
            requestError.response?.data?.message ||
              requestError.message ||
              "Could not add this item.",
          );
        }
      })();
    });
  }

  function buyNow(product, variantId) {
    runProtectedAction(() => navigate("/home/checkout", {
      state: { buyNow: { productId: product._id, variantId: variantId || null, quantity: 1 } },
    }));
  }

  function toggleWishlist(product) {
    runProtectedAction(() => {
      setNotice("");
      (async () => {
        try {
          const isWished = wishlistIds.includes(product._id);
          const response = isWished
            ? await API.delete(`/store/wishlist/items/${product._id}`)
            : await API.post(`/store/wishlist/items/${product._id}`);
          if (!isSuccess(response))
            throw new Error(
              response.data.message || "Could not update your wishlist.",
            );
          await refreshShopCounts();
        } catch (requestError) {
          setNotice(
            requestError.response?.data?.message ||
              requestError.message ||
              "Could not update your wishlist.",
          );
        }
      })();
    });
  }

  return (
    <section className="store-page">
      <div className="store-page__heading">
        <div>
          {selectedCategory && (
            <p className="store-breadcrumbs">
              <Link to="/home/products">All products</Link>
              <span>/</span>
              <span>{selectedCategory.name}</span>
            </p>
          )}
          <span className="store-eyebrow">
            {selectedCategory ? "BROWSE CATEGORY" : "SHOP THE COLLECTION"}
          </span>
          <h1>{selectedCategory?.name || "Gadgets and essentials"}</h1>
          <p className="store-muted">
            {selectedCategory
              ? `Browse available products in ${selectedCategory.name}.`
              : "Search, compare, and find the right option for you."}
          </p>
        </div>
      </div>

      <form className="store-panel store-filters" onSubmit={applyFilters}>
        <label className="store-field">
          Search products
          <input
            value={filters.search}
            onChange={(event) => changeFilter("search", event.target.value)}
            placeholder="Name, brand, SKU..."
          />
        </label>
        <label className="store-field">
          Category
          <select
            value={filters.categoryId}
            onChange={(event) => changeFilter("categoryId", event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="store-field">
          Minimum price
          <input
            type="number"
            min="0"
            value={filters.minPrice}
            onChange={(event) => changeFilter("minPrice", event.target.value)}
            placeholder="₹ Min"
          />
        </label>
        <label className="store-field">
          Maximum price
          <input
            type="number"
            min="0"
            value={filters.maxPrice}
            onChange={(event) => changeFilter("maxPrice", event.target.value)}
            placeholder="₹ Max"
          />
        </label>
        <label className="store-field">
          Sort by
          <select
            value={filters.sort}
            onChange={(event) => changeFilter("sort", event.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="name_asc">Name: A–Z</option>
            <option value="name_desc">Name: Z–A</option>
          </select>
        </label>
        <div className="store-filter-actions">
          <button className="store-button store-button--primary" type="submit">
            Apply
          </button>
          <button className="store-button" type="button" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </form>

      {notice && (
        <p className="store-result-line" role="status">
          {notice}
        </p>
      )}
      {!loading && !error && (
        <p className="store-result-line">
          {pagination.totalProducts} products found
        </p>
      )}
      {error && (
        <div className="store-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="store-panel store-empty">Loading products…</div>
      ) : null}
      {!loading && !error && products.length === 0 && (
        <div className="store-panel store-empty">
          No available products match these filters.
        </div>
      )}
      {!loading && products.length > 0 && (
        <>
          <div className="store-product-grid">
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
          <div className="store-pagination">
            <button
              className="store-button"
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => changePage(pagination.page - 1)}
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {Math.max(pagination.totalPages, 1)}
            </span>
            <button
              className="store-button"
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => changePage(pagination.page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default ProductsPage;
