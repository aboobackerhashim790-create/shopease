import { useEffect, useState } from "react";
import API, { isSuccess } from "../../api/client.js";
import "./CategoryManagementPage.css";

const CATEGORY_SORT_SETTINGS = {
  "sortOrderAsc-createdAtDesc": {
    sortOrderDirection: "asc",
    createdAtDirection: "desc",
  },
  "sortOrderDesc-createdAtDesc": {
    sortOrderDirection: "desc",
    createdAtDirection: "desc",
  },
};
const CATEGORY_PAGE_LIMIT = 10;

function normalizeCategoryList(data, requestedPage) {
  const categories = Array.isArray(data.categories) ? data.categories : [];

  return {
    categories,
    pagination: data.pagination ?? {
      page: requestedPage,
      limit: CATEGORY_PAGE_LIMIT,
      totalCategories: categories.length,
      totalPages: categories.length > 0 ? 1 : 0,
    },
  };
}

function validateCategoryField(field, value) {
  if (field === "name") {
    if (!value.trim()) return "Category name is required.";
    if (value.trim().length > 120) return "Name must be 120 characters or fewer.";
  }
  if (field === "slug") {
    if (!value.trim()) return "Slug is required.";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value.trim())) {
      return "Use letters, numbers, and single hyphens only.";
    }
    if (value.trim().length > 160) return "Slug must be 160 characters or fewer.";
  }
  if (field === "sortOrder" && (!Number.isFinite(Number(value)) || Number(value) < 0)) {
    return "Sort order must be a non-negative number.";
  }
  return "";
}

function CategoryManagementPage() {
  const [categories, setCategories] = useState([]);
  const [parentCategories, setParentCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sortOption, setSortOption] = useState("sortOrderAsc-createdAtDesc");
  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    totalCategories: 0,
    totalPages: 0,
  });
  const [limit, setLimit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [form, setForm] = useState({
    name: "",
    slug: "",
    sortOrder: 0,
    parentCategoryId: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const pageOptions = [];
  const pageCount = pagination.totalPages || 1;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pageOptions.push(pageNumber);
  }

  useEffect(() => {
    let active = true;

    async function loadCategories() {
      setLoading(true);
      setError("");

      try {
        const response = await API.get("/admin/category", {
          params: {
            search,
            status,
            page,
            limit,
            ...CATEGORY_SORT_SETTINGS[sortOption],
          },
        });

        if (!isSuccess(response)) {
          throw new Error(response.data.message || "Could not load categories.");
        }

        if (active) {
          const categoryList = normalizeCategoryList(response.data, page);
          setCategories(categoryList.categories);
          setPagination(categoryList.pagination);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "Could not load categories.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadCategories();

    return () => {
      active = false;
    };
  }, [search, status, sortOption, page, limit, refreshKey]);

  async function openCategoryModal(category = null) {
    setError("");
    setFormErrors({});
    setTouchedFields({});
    setEditingCategory(category);
    setForm({
      name: category?.name ?? "",
      slug: category?.slug ?? "",
      sortOrder: category?.sortOrder ?? 0,
      parentCategoryId: category?.parentCategoryId?.toString() ?? "",
    });
    setShowCreateModal(true);

    try {
      const response = await API.get("/admin/category", {
        params: {
          page: 1,
          limit: 50,
          status: "listed",
          sortOrderDirection: "asc",
          createdAtDirection: "desc",
        },
      });

      if (!isSuccess(response)) {
        throw new Error(response.data.message || "Could not load parent categories.");
      }

      setParentCategories(
        response.data.categories.filter((parentCategory) => parentCategory._id !== category?._id),
      );
    } catch (requestError) {
      setError(requestError.message || "Could not load parent categories.");
    }
  }

  async function handleDelete(categoryId) {
    try {
      const response = await API.delete(`/admin/category/${categoryId}`);

      if (!isSuccess(response)) {
        throw new Error(response.data.message || "Could not delete the category.");
      }

      setCategories((currentCategories) =>
        currentCategories.filter((category) => category._id !== categoryId),
      );
      setPagination((currentPagination) => {
        const totalCategories = Math.max(currentPagination.totalCategories - 1, 0);
        return {
          ...currentPagination,
          totalCategories,
          totalPages: Math.ceil(totalCategories / limit),
        };
      });
      if (categories.length === 1 && page > 1) {
        setPage((currentPage) => currentPage - 1);
      }
    } catch (requestError) {
      setError(requestError.message || "Could not delete the category.");
    }
  }

  async function handleListingChange(category) {
    setError("");
    try {
      const response = await API.patch(`/admin/category/${category._id}/listing`, {
        active: !category.active,
      });

      if (!isSuccess(response)) {
        throw new Error(response.data.message || "Could not update category status.");
      }

      setRefreshKey((current) => current + 1);
    } catch (requestError) {
      setError(requestError.message || "Could not update category status.");
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");

    const fieldsToValidate = ["name", "slug", "sortOrder"];
    const nextErrors = Object.fromEntries(
      fieldsToValidate.map((field) => [
        field,
        validateCategoryField(field, String(form[field] ?? "")),
      ]),
    );
    setFormErrors(nextErrors);
    setTouchedFields({ name: true, slug: true, sortOrder: true });
    if (Object.values(nextErrors).some(Boolean)) return;

    setSaving(true);

    try {
      const categoryData = {
        name: form.name,
        slug: form.slug,
        sortOrder: Number(form.sortOrder),
        parentCategoryId: form.parentCategoryId || null,
      };

      const response = editingCategory
        ? await API.patch("/admin/category", {
            _id: editingCategory._id,
            ...categoryData,
          })
        : await API.post("/admin/category", categoryData);

      if (!isSuccess(response)) {
        throw new Error(
          response.data.message || `Could not ${editingCategory ? "update" : "create"} category.`,
        );
      }

      const listResponse = await API.get("/admin/category", {
        params: {
          search,
          status,
          page,
          limit,
          ...CATEGORY_SORT_SETTINGS[sortOption],
        },
      });

      if (isSuccess(listResponse)) {
        const categoryList = normalizeCategoryList(listResponse.data, page);
        setCategories(categoryList.categories);
        setPagination(categoryList.pagination);
      }

      setShowCreateModal(false);
      setEditingCategory(null);
      setFormErrors({});
      setTouchedFields({});
      setForm({
        name: "",
        slug: "",
        sortOrder: 0,
        parentCategoryId: "",
      });
    } catch (requestError) {
      const message =
        requestError.response?.data?.message || requestError.message || "Could not save category.";
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes("name") && lowerMessage.includes("slug")) {
        setFormErrors({ name: message, slug: message });
      } else if (lowerMessage.includes("name")) {
        setFormErrors((current) => ({ ...current, name: message }));
      } else if (lowerMessage.includes("slug")) {
        setFormErrors((current) => ({ ...current, slug: message }));
      } else if (lowerMessage.includes("sort order")) {
        setFormErrors((current) => ({ ...current, sortOrder: message }));
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {categoryToDelete && (
        <div className="modal-backdrop">
          <div className="delete-modal">
            <h2>Delete category?</h2>
            <p>
              This permanently deletes <strong>{categoryToDelete.name}</strong>. This cannot be
              undone. Categories that still contain products or child categories cannot be deleted.
            </p>

            <button type="button" onClick={() => setCategoryToDelete(null)}>
              Cancel
            </button>

            <button
              type="button"
              onClick={async () => {
                await handleDelete(categoryToDelete._id);
                setCategoryToDelete(null);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-backdrop">
          <form className="category-modal" onSubmit={handleCreate} noValidate>
            <h2>{editingCategory ? "Edit category" : "Create category"}</h2>

            <label>
              Name
              <input
                name="name"
                value={form.name}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({ ...current, name: value }));
                  setTouchedFields((current) => ({ ...current, name: true }));
                  setFormErrors((current) => ({
                    ...current,
                    name: validateCategoryField("name", value),
                  }));
                }}
                aria-invalid={Boolean(formErrors.name)}
                className={
                  touchedFields.name ? (formErrors.name ? "field-invalid" : "field-valid") : ""
                }
              />
              {touchedFields.name && (
                <span
                  className={`field-feedback ${formErrors.name ? "field-feedback--error" : "field-feedback--success"}`}
                >
                  {formErrors.name || "Looks good."}
                </span>
              )}
            </label>

            <label>
              Slug
              <input
                name="slug"
                value={form.slug}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({ ...current, slug: value }));
                  setTouchedFields((current) => ({ ...current, slug: true }));
                  setFormErrors((current) => ({
                    ...current,
                    slug: validateCategoryField("slug", value),
                  }));
                }}
                aria-invalid={Boolean(formErrors.slug)}
                className={
                  touchedFields.slug ? (formErrors.slug ? "field-invalid" : "field-valid") : ""
                }
              />
              {touchedFields.slug && (
                <span
                  className={`field-feedback ${formErrors.slug ? "field-feedback--error" : "field-feedback--success"}`}
                >
                  {formErrors.slug || "Looks good."}
                </span>
              )}
            </label>

            <label>
              Sort order
              <input
                name="sort-order"
                type="number"
                value={form.sortOrder}
                onChange={(event) => {
                  const value = event.target.value;
                  setForm((current) => ({ ...current, sortOrder: value }));
                  setTouchedFields((current) => ({ ...current, sortOrder: true }));
                  setFormErrors((current) => ({
                    ...current,
                    sortOrder: validateCategoryField("sortOrder", value),
                  }));
                }}
                aria-invalid={Boolean(formErrors.sortOrder)}
                className={
                  touchedFields.sortOrder
                    ? formErrors.sortOrder
                      ? "field-invalid"
                      : "field-valid"
                    : ""
                }
              />
              {touchedFields.sortOrder && (
                <span
                  className={`field-feedback ${formErrors.sortOrder ? "field-feedback--error" : "field-feedback--success"}`}
                >
                  {formErrors.sortOrder || "Looks good."}
                </span>
              )}
            </label>

            <label>
              Parent category
              <select
                name="parent-category-id"
                value={form.parentCategoryId}
                onChange={(event) => setForm({ ...form, parentCategoryId: event.target.value })}
              >
                <option value="">No parent (top-level category)</option>
                {parentCategories.map((parentCategory) => (
                  <option key={parentCategory._id} value={parentCategory._id}>
                    {parentCategory.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="category-modal__actions">
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingCategory(null);
                  setForm({
                    name: "",
                    slug: "",
                    sortOrder: 0,
                    parentCategoryId: "",
                  });
                  setFormErrors({});
                  setTouchedFields({});
                  setError("");
                }}
              >
                Cancel
              </button>
              <button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingCategory ? "Save changes" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="category-page">
        <header className="category-page__header">
          <div>
            <p className="category-page__eyebrow">ADMINISTRATION</p>
            <h1>Category management</h1>
            <p className="category-page__description">View and manage your store categories.</p>
          </div>
          <button type="button" onClick={() => openCategoryModal()}>
            Create category
          </button>
        </header>

        <div className="category-card">
          <form
            className="category-toolbar"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSearch(searchInput.trim());
            }}
          >
            <div className="category-toolbar__search">
              <label className="category-search">
                <span className="sr-only">Search categories</span>
                <input
                  name="search-input"
                  type="search"
                  placeholder="Search categories by name"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </label>

              <button type="submit">Search</button>

              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
              >
                Clear
              </button>
            </div>

            <label className="category-sort">
              <span>Sort by</span>
              <select
                name="sort-option"
                value={sortOption}
                onChange={(event) => {
                  setSortOption(event.target.value);
                  setPage(1);
                }}
              >
                <option value="sortOrderAsc-createdAtDesc">
                  Sort order: low to high · Newest first
                </option>
                <option value="sortOrderDesc-createdAtDesc">
                  Sort order: high to low · Newest first
                </option>
              </select>
            </label>

            <label className="category-sort">
              <span>Status</span>
              <select
                name="status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All categories</option>
                <option value="listed">Listed</option>
                <option value="unlisted">Unlisted</option>
              </select>
            </label>
          </form>

          {error && (
            <p className="category-message category-message--error" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <p className="category-message">Loading categories…</p>
          ) : categories.length === 0 ? (
            <p className="category-message">No categories found.</p>
          ) : (
            <div className="category-table-wrapper">
              <table className="category-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Child categories</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th>Sort order</th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {categories.map((category) => (
                    <tr key={category._id}>
                      <td>
                        <strong>{category.name}</strong>
                        <span className="category-slug">{category.slug}</span>
                      </td>
                      <td>{category.childCount ?? 0}</td>
                      <td>
                        {category.createdAt
                          ? new Date(category.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        <span
                          className={`category-status ${
                            category.active
                              ? "category-status--active"
                              : "category-status--inactive"
                          }`}
                        >
                          {category.active ? "Listed" : "Unlisted"}
                        </span>
                      </td>
                      <td>{category.sortOrder ?? 0}</td>
                      <td>
                        <button
                          type="button"
                          className="category-listing-button"
                          onClick={() => handleListingChange(category)}
                        >
                          {category.active ? "Unlist" : "List"}
                        </button>
                        <button
                          type="button"
                          className="category-delete-button"
                          onClick={() => setCategoryToDelete(category)}
                        >
                          Delete
                        </button>

                        <button type="button" onClick={() => openCategoryModal(category)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="category-pagination" aria-label="Category pagination">
            <p>
              {pagination.totalCategories === 0
                ? "No categories to show"
                : `Page ${page} of ${pagination.totalPages} · ${pagination.totalCategories} categories`}
            </p>
            <div className="category-pagination__buttons">
              <label>
                page number
                <select
                  name="page"
                  value={page}
                  onChange={(event) => setPage(Number(event.target.value))}
                  disabled={loading}
                >
                  {pageOptions.map((pageNumber) => (
                    <option key={pageNumber} value={pageNumber}>
                      {pageNumber}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Products per page
                <select
                  name="limit"
                  value={limit}
                  onChange={(event) => {
                    setLimit(Number(event.target.value));
                    setPage(1);
                  }}
                  disabled={loading}
                >
                  <option value={3}>3</option>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default CategoryManagementPage;
