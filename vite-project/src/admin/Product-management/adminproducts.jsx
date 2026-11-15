import { useCallback, useEffect, useState } from "react";
import API, { isSuccess } from "../../api/client.js";
import cropImage from "../cropImage.js";
import ProductFormModal from "./ProductFormModal.jsx";
import { ProductCropModal, ProductDeleteModal } from "./ProductDialogs.jsx";
import "./adminproducts.css";

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function isSupportedImage(file) {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".pdf") || file.type.toLowerCase() === "application/pdf") {
    return false;
  }

  return SUPPORTED_IMAGE_TYPES.has(file.type.toLowerCase()) && /\.(jpe?g|png|webp)$/i.test(fileName);
}



function emptyForm() {
  return {
    name: "",
    slug: "",
    description: "",
    categoryId: "",
    brand: "",
    sku: "",
    price: "",
    compareAtPrice: "",
    stockQuantity: "0",
    images: [],
    isFeatured: false,
    variants: [],
  };
}

function validateProductForm(form, productImageCount) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Product name is required.";
  if (!form.slug.trim()) errors.slug = "Slug is required.";
  else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(form.slug.trim())) {
    errors.slug = "Use letters, numbers, and single hyphens only.";
  }
  if (!form.categoryId) errors.categoryId = "Choose a category.";
  if (!form.description.trim()) errors.description = "Description is required.";
  if (productImageCount < 2 || productImageCount > 5) {
    errors.images = "Choose between 2 and 5 product images.";
  }

  if (form.variants.length === 0) {
    if (form.price === "" || !Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
      errors.price = "Enter a valid non-negative price.";
    }
    if (!Number.isInteger(Number(form.stockQuantity)) || Number(form.stockQuantity) < 0) {
      errors.stockQuantity = "Stock must be a non-negative whole number.";
    }
    if (form.compareAtPrice !== "") {
      if (!Number.isFinite(Number(form.compareAtPrice)) || Number(form.compareAtPrice) < 0) {
        errors.compareAtPrice = "Enter a valid non-negative compare-at price.";
      } else if (Number(form.compareAtPrice) <= Number(form.price)) {
        errors.compareAtPrice = "Compare-at price must be higher than the price.";
      }
    }
  }

  form.variants.forEach((variant, index) => {
    if (!variant.sku.trim()) errors[`variants.${index}.sku`] = "Variant SKU is required.";
    if (variant.price === "" || !Number.isFinite(Number(variant.price)) || Number(variant.price) < 0) {
      errors[`variants.${index}.price`] = "Enter a valid non-negative price.";
    }
    if (!Number.isInteger(Number(variant.stockQuantity)) || Number(variant.stockQuantity) < 0) {
      errors[`variants.${index}.stockQuantity`] = "Stock must be a non-negative whole number.";
    }
    if (variant.compareAtPrice !== "" && Number(variant.compareAtPrice) <= Number(variant.price)) {
      errors[`variants.${index}.compareAtPrice`] = "Compare-at price must be higher than the price.";
    }
  });

  return errors;
}

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest")
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    totalProducts: 0,
    totalPages: 0,
  });
  const [limit, setLimit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productToDelete, setProductToDelete] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedImageFiles, setSelectedImageFiles] = useState([]);
  const [cropQueue, setCropQueue] = useState([]);
  const [cropPreviewUrl, setCropPreviewUrl] = useState("");
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [cropping, setCropping] = useState(false);
  const activeCropItem = cropQueue[0];


  const pageOptions = [];
  const pageCount = pagination.totalPages || 1;

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pageOptions.push(pageNumber);
  }
  useEffect(() => {
    if (!activeCropItem) {
      setCropPreviewUrl("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(activeCropItem.file);
    setCropPreviewUrl(previewUrl);
    setCropPosition({ x: 0, y: 0 });
    setCropZoom(1);
    setCroppedAreaPixels(null);

    return () => URL.revokeObjectURL(previewUrl);
  }, [activeCropItem?.file]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await API.get("/admin/products", {
        params: { search, categoryId, status: statusFilter, sort, page, limit },
      });
      if (!isSuccess(response)) {
        throw new Error(response.data.message || "Could not load products.");
      }
      setProducts(
        Array.isArray(response.data.products) ? response.data.products : [],
      );
      setPagination(
        response.data.pagination || { totalProducts: 0, totalPages: 0 },
      );
    } catch (requestError) {
      setError(requestError.message || "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, statusFilter, sort, page, limit]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    let active = true;
    async function loadCategories() {
      try {
        const response = await API.get("/admin/category", {
          params: { page: 1, limit: 50 },
        });
        if (!isSuccess(response)) {
          throw new Error(
            response.data.message || "Could not load categories.",
          );
        }
        if (active) {
          setCategories(response.data.categories || []);
        }
      } catch (requestError) {
        if (active)
          setError(requestError.message || "Could not load categories.");
      }
    }
    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  function openCreateModal() {
    setEditingProduct(null);
    setForm(emptyForm());
    setSelectedImageFiles([]);
    setCropQueue([]);
    setError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function openEditModal(product) {
    setEditingProduct(product);
    setForm({
      name: product.name || "",
      slug: product.slug || "",
      description: product.description || "",
      categoryId: product.categoryId?._id || product.categoryId || "",
      brand: product.brand || "",
      sku: product.sku || "",
      price: product.price ?? "",
      compareAtPrice: product.compareAtPrice ?? "",
      stockQuantity: product.stockQuantity ?? 0,
      images: product.images || [],
      isFeatured: Boolean(product.isFeatured),
      variants: (product.variants || []).map((variant) => ({
        clientId: String(variant._id || `${Date.now()}-${Math.random()}`),
        sku: variant.sku || "",
        color: variant.options?.color || "",
        storage: variant.options?.storage || "",
        price: variant.price ?? "",
        compareAtPrice: variant.compareAtPrice ?? "",
        stockQuantity: variant.stockQuantity ?? 0,
        active: variant.active ?? true,
        images: variant.images || [],
        imageFiles: [],
      })),
    });
    setSelectedImageFiles([]);
    setCropQueue([]);
    setError("");
    setFieldErrors({});
    setModalOpen(true);
  }

  function makeProductPayload(images, variantImageUrls) {
    const variants = form.variants.map((variant, index) => ({
      sku: variant.sku.trim(),
      options: {
        color: variant.color.trim(),
        storage: variant.storage.trim(),
      },
      price: Number(variant.price),
      compareAtPrice:
        variant.compareAtPrice === "" ? null : Number(variant.compareAtPrice),
      stockQuantity: Number(variant.stockQuantity),
      active: variant.active,
      images: [...variant.images, ...variantImageUrls[index]],
    }));

    return {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      categoryId: form.categoryId,
      brand: form.brand.trim(),
      ...(!variants.length && form.sku.trim() ? { sku: form.sku.trim() } : {}),
      price: variants.length ? null : Number(form.price),
      compareAtPrice:
        variants.length || form.compareAtPrice === ""
          ? null
          : Number(form.compareAtPrice),
      stockQuantity: variants.length ? 0 : Number(form.stockQuantity),
      images,
      isFeatured: form.isFeatured,
      variants,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const imageCount = form.images.length + selectedImageFiles.length;
    const validationErrors = validateProductForm(form, imageCount);
    setFieldErrors(validationErrors);
    setError("");
    if (Object.keys(validationErrors).length > 0) return;

    setSaving(true);
    try {
      const uploadedUrls = await uploadImagesToCloudinary(selectedImageFiles);
      const variantImageUrls = await Promise.all(
        form.variants.map((variant) =>
          uploadImagesToCloudinary(variant.imageFiles),
        ),
      );

      const payload = makeProductPayload(
        [...form.images, ...uploadedUrls],
        variantImageUrls,
      );
      const response = editingProduct
        ? await API.patch(`/admin/products/${editingProduct._id}`, payload)
        : await API.post("/admin/products", payload);

      if (!isSuccess(response)) {
        throw new Error(response.data.message || "Could not save product.");
      }

      setModalOpen(false);
      setEditingProduct(null);
      setForm(emptyForm());
      setFieldErrors({});
      setSelectedImageFiles([]);
      setCropQueue([]);
      await loadProducts();
    } catch (requestError) {
      const serverFieldErrors = requestError.response?.data?.fieldErrors || {};
      if (Object.keys(serverFieldErrors).length) {
        setFieldErrors((current) => ({ ...current, ...serverFieldErrors }));
      } else {
        const message = requestError.response?.data?.message || requestError.message || "Could not save product.";
        if (/name/i.test(message)) setFieldErrors((current) => ({ ...current, name: message }));
        else if (/slug/i.test(message)) setFieldErrors((current) => ({ ...current, slug: message }));
        else if (/description/i.test(message)) setFieldErrors((current) => ({ ...current, description: message }));
        else if (/category/i.test(message)) setFieldErrors((current) => ({ ...current, categoryId: message }));
        else if (/price/i.test(message)) setFieldErrors((current) => ({ ...current, price: message }));
        else if (/stock/i.test(message)) setFieldErrors((current) => ({ ...current, stockQuantity: message }));
        else if (/image/i.test(message)) setFieldErrors((current) => ({ ...current, images: message }));
        else setError(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleListing(product) {
    setError("");
    try {
      const response = await API.patch(`/admin/products/${product._id}`, {
        active: !product.active,
      });
      if (!isSuccess(response)) {
        throw new Error(
          response.data.message || "Could not change product status.",
        );
      }
      await loadProducts();
    } catch (requestError) {
      setError(requestError.message || "Could not change product status.");
    }
  }

  async function handlePermanentDelete() {
    if (!productToDelete) return;
    setError("");
    try {
      const response = await API.delete(
        `/admin/products/${productToDelete._id}`,
      );
      if (!isSuccess(response)) {
        throw new Error(response.data.message || "Could not delete product.");
      }
      setProductToDelete(null);
      if (products.length === 1 && page > 1)
        setPage((currentPage) => currentPage - 1);
      else await loadProducts();
    } catch (requestError) {
      setError(requestError.message || "Could not delete product.");
    }
  }

  function closeModal() {
    setModalOpen(false);
    setEditingProduct(null);
    setForm(emptyForm());
    setSelectedImageFiles([]);
    setCropQueue([]);
    setError("");
    setFieldErrors({});
  }

  function updateFormField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  }

  function addVariant() {
    setForm((current) => ({
      ...current,
      variants: [
        ...current.variants,
        {
          clientId: `${Date.now()}-${Math.random()}`,
          sku: "",
          color: "",
          storage: "",
          price: "",
          compareAtPrice: "",
          stockQuantity: 0,
          active: true,
          images: [],
          imageFiles: [],
        },
      ],
    }));
  }

  function updateVariant(index, field, value) {
    setForm((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index ? { ...variant, [field]: value } : variant,
      ),
    }));
    setFieldErrors((current) => ({ ...current, [`variants.${index}.${field}`]: "" }));
  }

  function removeVariant(index) {
    setForm((current) => ({
      ...current,
      variants: current.variants.filter(
        (_, variantIndex) => variantIndex !== index,
      ),
    }));
  }

  function selectProductImages(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const imageFiles = files.filter(isSupportedImage);
    const rejectedFiles = files.length - imageFiles.length;
    const imageError = rejectedFiles
      ? "PDF and other file types are not supported. Choose JPG, PNG, or WebP images."
      : "";
    if (rejectedFiles && imageFiles.length === 0) {
      setFieldErrors((current) => ({ ...current, images: imageError }));
      return;
    }
    const pendingProductFiles = cropQueue.filter(
      (item) => item.target.type === "product",
    ).length;
    const availableSlots =
      5 - form.images.length - selectedImageFiles.length - pendingProductFiles;
    if (imageFiles.length > availableSlots) {
      setFieldErrors((current) => ({
        ...current,
        images: `You can add only ${Math.max(availableSlots, 0)} more image(s). A product can have at most 5.`,
      }));
      return;
    }
    setFieldErrors((current) => ({ ...current, images: imageError }));
    enqueueImagesForCropping(imageFiles, { type: "product" });
  }

  function selectVariantImages(index, event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const variant = form.variants[index];
    if (!variant) return;
    const imageFiles = files.filter(isSupportedImage);
    const field = `variants.${index}.images`;
    const rejectedFiles = files.length - imageFiles.length;
    const imageError = rejectedFiles
      ? "PDF and other file types are not supported. Choose JPG, PNG, or WebP images."
      : "";
    if (rejectedFiles && imageFiles.length === 0) {
      setFieldErrors((current) => ({ ...current, [field]: imageError }));
      return;
    }
    const pendingFiles = cropQueue.filter(
      (item) =>
        item.target.type === "variant" &&
        item.target.clientId === variant.clientId,
    ).length;
    const slots =
      5 - variant.images.length - variant.imageFiles.length - pendingFiles;
    if (imageFiles.length > slots) {
      setFieldErrors((current) => ({
        ...current,
        [field]: `A variant can have at most 5 images. You can add ${Math.max(slots, 0)} more.`,
      }));
      return;
    }
    setFieldErrors((current) => ({ ...current, [field]: imageError }));
    enqueueImagesForCropping(imageFiles, {
      type: "variant",
      clientId: variant.clientId,
    });
  }

  function enqueueImagesForCropping(files, target) {
    setCropQueue((current) => [
      ...current,
      ...files.map((file) => ({ file, target })),
    ]);
  }

  async function useCroppedImage() {
    if (!activeCropItem || !cropPreviewUrl || !croppedAreaPixels) return;
    setCropping(true);
    setError("");
    try {
      const blob = await cropImage(cropPreviewUrl, croppedAreaPixels);
      const originalName = activeCropItem.file.name.replace(/\.[^.]+$/, "");
      const croppedFile = new File([blob], `${originalName}-cropped.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      if (activeCropItem.target.type === "product") {
        setSelectedImageFiles((current) => [...current, croppedFile]);
        setFieldErrors((current) => ({ ...current, images: "" }));
      } else {
        setForm((current) => ({
          ...current,
          variants: current.variants.map((variant) =>
            variant.clientId === activeCropItem.target.clientId
              ? { ...variant, imageFiles: [...variant.imageFiles, croppedFile] }
              : variant,
          ),
        }));
      }
      setCropQueue((current) => current.slice(1));
    } catch (cropError) {
      setError(cropError.message || "Could not crop this image.");
    } finally {
      setCropping(false);
    }
  }

  function skipCurrentCrop() {
    setCropQueue((current) => current.slice(1));
  }

  async function uploadImagesToCloudinary(files) {
    if (!files.length) return [];
    const imageFormData = new FormData();
    files.forEach((file) => imageFormData.append("images", file));
    const response = await API.post("/admin/products/images", imageFormData);
    if (!isSuccess(response)) {
      throw new Error(
        response.data.message || "Could not upload product images.",
      );
    }
    return (response.data.images || []).map((image) => image.url);
  }

  return (
    <section className="products-page">
      <header className="products-page__header">
        <div>
          <p className="products-page__eyebrow">ADMINISTRATION</p>
          <h1>Product management</h1>
          <p className="products-page__description">
            Add products and manage your store inventory.
          </p>
        </div>
        <button
          className="products-primary-button"
          type="button"
          onClick={openCreateModal}
        >
          Create product
        </button>
      </header>

      <div className="products-card">
        <form
          className="products-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <input
            type="search"
            aria-label="Search products"
            placeholder="Search by product, brand, SKU, or slug"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button className="products-primary-button" type="submit">
            Search
          </button>
          <button
            className="products-secondary-button"
            type="button"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setCategoryId("");
              setStatusFilter("all");
              setPage(1);
              setSort("newest");
            }}
          >
            Clear
          </button>
          <label className="products-filter">
            Category
            <select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
              }}
              disabled={loading}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category._id} value={category._id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="products-filter">
            Status
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              disabled={loading}
            >
              <option value="all">All statuses</option>
              <option value="listed">Listed</option>
              <option value="unlisted">Unlisted</option>
            </select>
          </label>

          <label>
            Sort by
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              disabled={loading}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>

            </select>
          </label>
        </form>

        {error && (
          <p className="products-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="products-empty-state">Loading products…</p>
        ) : products.length === 0 ? (
          <p className="products-empty-state">No products found.</p>
        ) : (
          <div className="products-table-wrap">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const hasVariants = product.variants?.length > 0;
                  const activeVariants = (product.variants || []).filter(
                    (variant) => variant.active !== false,
                  );
                  const price = hasVariants
                    ? activeVariants[0]?.price
                    : product.price;
                  const stock = hasVariants
                    ? product.variants.reduce(
                      (total, variant) =>
                        total + (variant.stockQuantity || 0),
                      0,
                    )
                    : product.stockQuantity;
                  const isStoreVisible =
                    product.active &&
                    (!hasVariants || activeVariants.length > 0);
                  return (
                    <tr key={product._id}>
                      <td>
                        <div className="products-name-cell">
                          {product.images?.[0] && (
                            <img src={product.images[0]} alt="" />
                          )}
                          <div>
                            <strong>{product.name}</strong>
                            <span>{product.sku || product.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td>{product.categoryId?.name || "—"}</td>
                      <td>
                        {price == null
                          ? "—"
                          : `₹${Number(price).toLocaleString("en-IN")}`}
                      </td>
                      <td>{stock ?? 0}</td>
                      <td>
                        <span
                          className={`products-status ${isStoreVisible ? "is-active" : "is-inactive"}`}
                        >
                          {!product.active
                            ? "Unlisted"
                            : hasVariants && !activeVariants.length
                              ? "No listed variants"
                              : "Listed"}
                        </span>
                      </td>
                      <td className="products-actions">
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleListing(product)}
                        >
                          {product.active ? "Unlist" : "List"}
                        </button>
                        <button
                          className="is-danger"
                          type="button"
                          onClick={() => setProductToDelete(product)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="products-pagination">
          <span>
            {pagination.totalProducts
              ? `Page ${page} of ${pagination.totalPages} · ${pagination.totalProducts} products`
              : "No products to show"}
          </span>
          <div className="products-pagination__controls">
            <label>
              Page
              <select
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
        </footer>
      </div>

      {
        modalOpen && (
          <ProductFormModal
            editingProduct={editingProduct}
            form={form}
            setForm={setForm}
            categories={categories}
            selectedImageFiles={selectedImageFiles}
            setSelectedImageFiles={setSelectedImageFiles}
            saving={saving}
            error={error}
            fieldErrors={fieldErrors}
            onFieldChange={updateFormField}
            onSubmit={handleSubmit}
            onClose={closeModal}
            onSelectProductImages={selectProductImages}
            onAddVariant={addVariant}
            onUpdateVariant={updateVariant}
            onRemoveVariant={removeVariant}
            onSelectVariantImages={selectVariantImages}
          />
        )
      }

      <ProductCropModal
        activeCropItem={activeCropItem}
        cropPreviewUrl={cropPreviewUrl}
        cropQueueLength={cropQueue.length}
        cropPosition={cropPosition}
        setCropPosition={setCropPosition}
        cropZoom={cropZoom}
        setCropZoom={setCropZoom}
        croppedAreaPixels={croppedAreaPixels}
        setCroppedAreaPixels={setCroppedAreaPixels}
        cropping={cropping}
        onCancel={() => setCropQueue([])}
        onSkip={skipCurrentCrop}
        onUseCrop={useCroppedImage}
      />

      <ProductDeleteModal
        product={productToDelete}
        onCancel={() => setProductToDelete(null)}
        onConfirm={handlePermanentDelete}
      />
    </section >
  );
}

export default AdminProducts;
