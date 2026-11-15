import { useEffect, useState } from "react";
import API, { isSuccess } from "../../api/client.js";
import "../adminCommerce.css";

const emptyForm = {
  name: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  appliesTo: "all",
  categoryId: "",
  productId: "",
  startsAt: "",
  endsAt: "",
  active: true,
};

function toBackendDate(value) {
  if (!value) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function toDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function campaignState(campaign) {
  const now = Date.now();
  if (!campaign.active) return "Paused";
  if (new Date(campaign.startsAt).getTime() > now) return "Scheduled";
  if (new Date(campaign.endsAt).getTime() <= now) return "Ended";
  return "Live";
}

function formatDate(value) {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function loadAllOptions(endpoint, collectionName) {
  const firstResponse = await API.get(endpoint, {
    params: { page: 1, limit: 50, status: "all" },
  });
  if (!isSuccess(firstResponse)) {
    throw new Error(firstResponse.data.message || `Could not load ${collectionName}.`);
  }

  const firstPage = firstResponse.data[collectionName] || [];
  const totalPages = firstResponse.data.pagination?.totalPages || 1;
  const allItems = [...firstPage];

  for (let page = 2; page <= totalPages; page += 1) {
    const response = await API.get(endpoint, {
      params: { page, limit: 50, status: "all" },
    });
    if (!isSuccess(response)) {
      throw new Error(response.data.message || `Could not load ${collectionName}.`);
    }
    allItems.push(...(response.data[collectionName] || []));
  }

  return allItems;
}

export default function OfferCampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  async function loadCampaigns() {
    const response = await API.get("/admin/offer-campaigns");
    if (!isSuccess(response)) {
      throw new Error(response.data.message || "Could not load offer campaigns.");
    }
    setCampaigns(response.data.campaigns || []);
  }

  useEffect(() => {
    let stillMounted = true;

    async function loadPage() {
      setLoading(true);
      try {
        const [categoryOptions, productOptions] = await Promise.all([
          loadAllOptions("/admin/category", "categories"),
          loadAllOptions("/admin/products", "products"),
        ]);
        const campaignResponse = await API.get("/admin/offer-campaigns");
        if (!isSuccess(campaignResponse)) {
          throw new Error(campaignResponse.data.message || "Could not load offer campaigns.");
        }
        if (stillMounted) {
          setCategories(categoryOptions);
          setProducts(productOptions);
          setCampaigns(campaignResponse.data.campaigns || []);
        }
      } catch (error) {
        if (stillMounted) {
          setMessage(error.response?.data?.message || error.message || "Could not load campaign data.");
          setIsError(true);
        }
      } finally {
        if (stillMounted) setLoading(false);
      }
    }

    loadPage();
    return () => {
      stillMounted = false;
    };
  }, []);

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
      ...(name === "appliesTo" ? { categoryId: "", productId: "" } : {}),
    }));
    setFieldErrors((current) => ({
      ...current,
      [name]: "",
      ...(name === "appliesTo" ? { categoryId: "", productId: "" } : {}),
    }));
  }

  function startEditing(campaign) {
    setEditingId(campaign._id);
    setForm({
      name: campaign.name || "",
      description: campaign.description || "",
      discountType: campaign.discountType,
      discountValue: String(campaign.discountValue),
      appliesTo: campaign.appliesTo,
      categoryId: campaign.categoryId?._id || campaign.categoryId || "",
      productId: campaign.productId?._id || campaign.productId || "",
      startsAt: toDateTimeInput(campaign.startsAt),
      endsAt: toDateTimeInput(campaign.endsAt),
      active: campaign.active !== false,
    });
    setMessage("");
    setIsError(false);
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setMessage("");
    setIsError(false);
    setFieldErrors({});
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setIsError(false);
    setFieldErrors({});

    try {
      const payload = {
        ...form,
        discountValue: Number(form.discountValue),
        categoryId: form.appliesTo === "category" ? form.categoryId : null,
        productId: form.appliesTo === "product" ? form.productId : null,
        startsAt: toBackendDate(form.startsAt),
        endsAt: toBackendDate(form.endsAt),
      };
      const response = editingId
        ? await API.patch(`/admin/offer-campaigns/${editingId}`, payload)
        : await API.post("/admin/offer-campaigns", payload);
      if (!isSuccess(response)) {
        const serverErrors = response.data.errors;
        if (serverErrors && Object.keys(serverErrors).length > 0) {
          setFieldErrors(serverErrors);
          return;
        }
        throw new Error(response.data.message || "Could not save campaign.");
      }
      setMessage(response.data.message || "Campaign saved.");
      setForm(emptyForm);
      setEditingId(null);
      setFieldErrors({});
      await loadCampaigns();
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Could not save campaign.");
      setIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function toggleCampaign(campaign) {
    setMessage("");
    setIsError(false);
    try {
      const response = await API.patch(`/admin/offer-campaigns/${campaign._id}/active`, {
        active: !campaign.active,
      });
      if (!isSuccess(response)) {
        throw new Error(response.data.message || "Could not change campaign status.");
      }
      setMessage(response.data.message);
      await loadCampaigns();
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Could not change campaign status.");
      setIsError(true);
    }
  }

  function getTargetLabel(campaign) {
    if (campaign.appliesTo === "all") return "All products";
    if (campaign.appliesTo === "category") return campaign.categoryId?.name || "Category";
    return campaign.productId?.name || "Product";
  }

  return (
    <section className="admin-commerce">
      <header className="admin-commerce__heading">
        <div>
          <span>ADMINISTRATION</span>
          <h1>Offer campaigns</h1>
          <p>Schedule seasonal offers for your products and categories.</p>
        </div>
        <div className="admin-commerce__metric">
          <small>Total campaigns</small>
          <strong>{campaigns.length}</strong>
        </div>
      </header>

      <form className="admin-commerce__panel offer-campaign-form" onSubmit={submit}>
        <div className="admin-commerce__section-title">
          <div>
            <h2>{editingId ? "Edit campaign" : "Create a campaign"}</h2>
            <p>For example, set up a Christmas discount for selected products.</p>
          </div>
        </div>

        <div className="offer-campaign-grid">
          <label>
            Campaign name
            <input name="name" value={form.name} onChange={updateField} maxLength="100" placeholder="Christmas sale" aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "campaign-name-error" : undefined} />
            {fieldErrors.name && <small id="campaign-name-error" className="admin-field-error">{fieldErrors.name}</small>}
          </label>
          <label>
            Description
            <input name="description" value={form.description} onChange={updateField} maxLength="300" placeholder="Holiday savings on selected gadgets" aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? "campaign-description-error" : undefined} />
            {fieldErrors.description && <small id="campaign-description-error" className="admin-field-error">{fieldErrors.description}</small>}
          </label>
          <label>
            Discount type
            <select name="discountType" value={form.discountType} onChange={updateField}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed amount (₹)</option>
            </select>
          </label>
          <label>
            Discount value {form.discountType === "percentage" ? "(%)" : "(₹)"}
            <input name="discountValue" type="number" min="0.01" max={form.discountType === "percentage" ? "99" : undefined} step="0.01" value={form.discountValue} onChange={updateField} aria-invalid={Boolean(fieldErrors.discountValue)} aria-describedby={fieldErrors.discountValue ? "campaign-discount-error" : "campaign-discount-hint"} />
            {form.discountType === "percentage" && <small id="campaign-discount-hint">Maximum percentage is 99%, so a positive-price item won’t become free.</small>}
            {fieldErrors.discountValue && <small id="campaign-discount-error" className="admin-field-error">{fieldErrors.discountValue}</small>}
          </label>
          <label>
            Apply offer to
            <select name="appliesTo" value={form.appliesTo} onChange={updateField} aria-invalid={Boolean(fieldErrors.appliesTo)} aria-describedby={fieldErrors.appliesTo ? "campaign-applies-error" : undefined}>
              <option value="all">All products</option>
              <option value="category">One category</option>
              <option value="product">One product</option>
            </select>
            {fieldErrors.appliesTo && <small id="campaign-applies-error" className="admin-field-error">{fieldErrors.appliesTo}</small>}
          </label>
          {form.appliesTo === "category" && (
            <label>
              Category
              <select name="categoryId" value={form.categoryId} onChange={updateField} aria-invalid={Boolean(fieldErrors.categoryId)} aria-describedby={fieldErrors.categoryId ? "campaign-category-error" : undefined}>
                <option value="">Choose a category</option>
                {categories.map((category) => (
                  <option key={category._id} value={category._id}>{category.name}</option>
                ))}
              </select>
              {fieldErrors.categoryId && <small id="campaign-category-error" className="admin-field-error">{fieldErrors.categoryId}</small>}
            </label>
          )}
          {form.appliesTo === "product" && (
            <label>
              Product
              <select name="productId" value={form.productId} onChange={updateField} aria-invalid={Boolean(fieldErrors.productId)} aria-describedby={fieldErrors.productId ? "campaign-product-error" : undefined}>
                <option value="">Choose a product</option>
                {products.map((product) => (
                  <option key={product._id} value={product._id}>{product.name}</option>
                ))}
              </select>
              {fieldErrors.productId && <small id="campaign-product-error" className="admin-field-error">{fieldErrors.productId}</small>}
            </label>
          )}
          <label>
            Starts at
            <input name="startsAt" type="datetime-local" value={form.startsAt} onChange={updateField} aria-invalid={Boolean(fieldErrors.startsAt)} aria-describedby={fieldErrors.startsAt ? "campaign-start-error" : undefined} />
            {fieldErrors.startsAt && <small id="campaign-start-error" className="admin-field-error">{fieldErrors.startsAt}</small>}
          </label>
          <label>
            Ends at
            <input name="endsAt" type="datetime-local" value={form.endsAt} onChange={updateField} aria-invalid={Boolean(fieldErrors.endsAt)} aria-describedby={fieldErrors.endsAt ? "campaign-end-error" : undefined} />
            {fieldErrors.endsAt && <small id="campaign-end-error" className="admin-field-error">{fieldErrors.endsAt}</small>}
          </label>
        </div>

        <label className="offer-campaign-active">
          <input name="active" type="checkbox" checked={form.active} onChange={updateField} />
          Campaign is enabled
        </label>
        <p className="admin-commerce__hint">The campaign is only active between the selected dates. You can pause it at any time.</p>

        <div className="admin-coupon-actions">
          {editingId && <button type="button" onClick={resetForm}>Cancel edit</button>}
          <button className="admin-commerce__primary" disabled={saving}>
            {saving ? "Saving…" : editingId ? "Save changes" : "Create campaign"}
          </button>
        </div>
        {message && <p className={`admin-commerce__message ${isError ? "is-error" : "is-success"}`} role="status">{message}</p>}
      </form>

      <div className="admin-commerce__panel">
        <div className="admin-commerce__section-title">
          <div>
            <h2>Campaigns</h2>
            <p>Review targeting, schedule, and campaign status.</p>
          </div>
        </div>
        <div className="admin-commerce__table-wrap">
          <table className="admin-commerce__table">
            <thead>
              <tr><th>CAMPAIGN</th><th>OFFER</th><th>APPLIES TO</th><th>SCHEDULE</th><th>STATUS</th><th>ACTIONS</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6">Loading campaigns…</td></tr>
              ) : campaigns.length === 0 ? (
                <tr><td colSpan="6">No campaigns created yet.</td></tr>
              ) : campaigns.map((campaign) => {
                const state = campaignState(campaign);
                return (
                  <tr key={campaign._id}>
                    <td><strong>{campaign.name}</strong><small>{campaign.description}</small></td>
                    <td>{campaign.discountType === "percentage" ? `${campaign.discountValue}% off` : `₹${Number(campaign.discountValue).toLocaleString("en-IN")} off`}</td>
                    <td>{getTargetLabel(campaign)}</td>
                    <td>{formatDate(campaign.startsAt)}<small>Until {formatDate(campaign.endsAt)}</small></td>
                    <td><span className={`admin-commerce__badge ${state === "Ended" || state === "Paused" ? "is-muted" : ""}`}>{state}</span></td>
                    <td className="admin-commerce__actions">
                      <button type="button" onClick={() => startEditing(campaign)}>Edit</button>
                      <button type="button" onClick={() => toggleCampaign(campaign)}>{campaign.active ? "Pause" : "Enable"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
