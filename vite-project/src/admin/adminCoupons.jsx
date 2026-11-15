import { useEffect, useState } from "react";
import API, { isSuccess } from "../api/client.js";
import "./adminCommerce.css";

const blankCoupon = { code: "", description: "", discountType: "percentage", discountValue: "", minimumSubtotal: "0", maximumDiscount: "", usageLimit: "", firstOrderOnly: false, startsAt: "", expiresAt: "", active: true };
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

function couponErrorField(message) {
  if (/code|already in use/i.test(message)) return "code";
  if (/choose a percentage or fixed discount/i.test(message)) return "discountType";
  if (/discount value/i.test(message)) return "discountValue";
  if (/minimum subtotal/i.test(message)) return "minimumSubtotal";
  if (/maximum discount/i.test(message)) return "maximumDiscount";
  if (/usage limit/i.test(message)) return "usageLimit";
  if (/start date must be before/i.test(message)) return "expiresAt";
  if (/coupon dates/i.test(message)) return "startsAt";
  return "";
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(blankCoupon);
  const [editing, setEditing] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pagination, setPagination] = useState({ totalPages: 1, totalCoupons: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  async function loadCoupons() {
    setLoading(true);
    try {
      const response = await API.get("/admin/coupons", { params: { search, status, page, limit } });
      if (!isSuccess(response)) throw new Error(response.data.message || "Could not load coupons.");
      setCoupons(response.data.coupons || []);
      setPagination(response.data.pagination || { totalPages: 1, totalCoupons: 0 });
    } catch (error) { setMessage(error.response?.data?.message || error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadCoupons(); }, [search, status, page, limit]);

  function editCoupon(coupon) {
    setEditing(coupon._id);
    setForm({ ...coupon, discountValue: String(coupon.discountValue), minimumSubtotal: String(coupon.minimumSubtotal), maximumDiscount: coupon.maximumDiscount ?? "", usageLimit: coupon.usageLimit ?? "", firstOrderOnly: coupon.firstOrderOnly === true, startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 10) : "", expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : "" });
    setMessage("");
    setFieldErrors({});
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setMessage(""); setFieldErrors({});
    const payload = { ...form, discountValue: Number(form.discountValue), minimumSubtotal: Number(form.minimumSubtotal || 0), maximumDiscount: form.maximumDiscount === "" ? null : Number(form.maximumDiscount), usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit), startsAt: form.startsAt || null, expiresAt: form.expiresAt || null };
    try {
      const response = editing ? await API.patch(`/admin/coupons/${editing}`, payload) : await API.post("/admin/coupons", payload);
      if (!isSuccess(response)) {
        const serverMessage = response.data.message || "Could not save coupon.";
        const serverErrors = response.data.errors;
        if (serverErrors && Object.keys(serverErrors).length > 0) {
          setFieldErrors(serverErrors);
          return;
        }
        const field = couponErrorField(serverMessage);
        if (field) {
          setFieldErrors({ [field]: serverMessage });
          return;
        }
        throw new Error(serverMessage);
      }
      setMessage(response.data.message); setForm(blankCoupon); setEditing(null); await loadCoupons();
    } catch (error) { setMessage(error.response?.data?.message || error.message); }
    finally { setSaving(false); }
  }

  async function toggleCoupon(coupon) {
    setMessage("");
    try {
      const response = await API.patch(`/admin/coupons/${coupon._id}/active`, { active: !coupon.active });
      if (!isSuccess(response)) throw new Error(response.data.message || "Could not change coupon status.");
      setMessage(response.data.message); await loadCoupons();
    } catch (error) { setMessage(error.response?.data?.message || error.message); }
  }

  function resetForm() { setForm(blankCoupon); setEditing(null); setFieldErrors({}); setMessage(""); }

  function renderFieldError(name) {
    if (!fieldErrors[name]) return null;
    return <small className="admin-field-error" id={`coupon-${name}-error`}>{fieldErrors[name]}</small>;
  }

  return <section className="admin-commerce">
    <header className="admin-commerce__heading"><div><span>ADMINISTRATION</span><h1>Coupon management</h1><p>Create discounts and manage their availability and usage.</p></div><div className="admin-commerce__metric"><small>Total coupons</small><strong>{pagination.totalCoupons}</strong></div></header>
    <form className="admin-commerce__panel admin-coupon-form" onSubmit={submit}>
      <div className="admin-commerce__section-title"><div><h2>{editing ? "Edit coupon" : "Create coupon"}</h2><p>Customers can apply active coupons during checkout.</p></div></div>
      <div className="admin-coupon-grid">
        <label>
          Coupon code
          <input value={form.code} maxLength="40" aria-invalid={Boolean(fieldErrors.code)} aria-describedby={fieldErrors.code ? "coupon-code-error" : undefined} onChange={(e) => updateField("code", e.target.value.toUpperCase())} placeholder="WELCOME10" />
          {renderFieldError("code")}
        </label>
        <label>
          Description
          <input value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Welcome discount" />
        </label>
        <label>
          Discount type
          <select value={form.discountType} aria-invalid={Boolean(fieldErrors.discountType)} aria-describedby={fieldErrors.discountType ? "coupon-discountType-error" : undefined} onChange={(e) => updateField("discountType", e.target.value)}>
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount</option>
          </select>
          {renderFieldError("discountType")}
        </label>
        <label>
          Discount value
          <input type="number" step="0.01" value={form.discountValue} aria-invalid={Boolean(fieldErrors.discountValue)} aria-describedby={fieldErrors.discountValue ? "coupon-discountValue-error" : undefined} onChange={(e) => updateField("discountValue", e.target.value)} />
          {renderFieldError("discountValue")}
        </label>
        <label>
          Minimum subtotal (₹)
          <input type="number" step="0.01" value={form.minimumSubtotal} aria-invalid={Boolean(fieldErrors.minimumSubtotal)} aria-describedby={fieldErrors.minimumSubtotal ? "coupon-minimumSubtotal-error" : undefined} onChange={(e) => updateField("minimumSubtotal", e.target.value)} />
          {renderFieldError("minimumSubtotal")}
        </label>
        <label>
          Maximum discount (₹)
          <input type="number" step="0.01" value={form.maximumDiscount} aria-invalid={Boolean(fieldErrors.maximumDiscount)} aria-describedby={fieldErrors.maximumDiscount ? "coupon-maximumDiscount-error" : undefined} onChange={(e) => updateField("maximumDiscount", e.target.value)} placeholder="Optional" />
          {renderFieldError("maximumDiscount")}
        </label>
        <label>
          Usage limit
          <input type="number" step="1" value={form.usageLimit} aria-invalid={Boolean(fieldErrors.usageLimit)} aria-describedby={fieldErrors.usageLimit ? "coupon-usageLimit-error" : undefined} onChange={(e) => updateField("usageLimit", e.target.value)} placeholder="Unlimited" />
          {renderFieldError("usageLimit")}
        </label>
        <label>
          Starts on
          <input type="date" value={form.startsAt} aria-invalid={Boolean(fieldErrors.startsAt)} aria-describedby={fieldErrors.startsAt ? "coupon-startsAt-error" : undefined} onChange={(e) => updateField("startsAt", e.target.value)} />
          {renderFieldError("startsAt")}
        </label>
        <label>
          Expires on
          <input type="date" value={form.expiresAt} aria-invalid={Boolean(fieldErrors.expiresAt)} aria-describedby={fieldErrors.expiresAt ? "coupon-expiresAt-error" : undefined} onChange={(e) => updateField("expiresAt", e.target.value)} />
          {renderFieldError("expiresAt")}
        </label>
      </div>
      <label className="admin-coupon-active"><input type="checkbox" checked={form.firstOrderOnly} onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })} /> Only for a customer’s first order</label>
      <p className="admin-commerce__hint">This allows each eligible customer to use the coupon on their first order. Leave Usage limit empty to avoid a storewide one-customer limit.</p>
      <label className="admin-coupon-active"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active for checkout</label>
      <div className="admin-coupon-actions">{editing && <button type="button" onClick={resetForm}>Cancel edit</button>}<button className="admin-commerce__primary" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create coupon"}</button></div>
      {message && <p className="admin-commerce__message" role="status">{message}</p>}
    </form>
    <div className="admin-commerce__panel">
      <form className="admin-commerce__toolbar" onSubmit={(e) => { e.preventDefault(); setPage(1); setSearch(searchText.trim()); }}><input placeholder="Search coupon code" value={searchText} onChange={(e) => setSearchText(e.target.value)} /><button className="admin-commerce__primary">Search</button><button type="button" onClick={() => { setSearchText(""); setSearch(""); setStatus("all"); setPage(1); }}>Clear</button><label>Status <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="all">All coupons</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></form>
      <div className="admin-commerce__table-wrap"><table className="admin-commerce__table"><thead><tr><th>CODE</th><th>DISCOUNT</th><th>MINIMUM</th><th>USES</th><th>VALID DATES</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>
        {loading ? <tr><td colSpan="7">Loading coupons…</td></tr> : coupons.length === 0 ? <tr><td colSpan="7">No coupons found.</td></tr> : coupons.map((coupon) => <tr key={coupon._id}><td><strong>{coupon.code}</strong><small>{coupon.description || "—"}</small>{coupon.firstOrderOnly && <small>First order only</small>}</td><td>{coupon.discountType === "percentage" ? `${coupon.discountValue}%` : money(coupon.discountValue)}</td><td>{money(coupon.minimumSubtotal)}</td><td>{coupon.usedCount}{coupon.usageLimit ? ` / ${coupon.usageLimit}` : " / ∞"}</td><td>{coupon.startsAt ? new Date(coupon.startsAt).toLocaleDateString("en-IN") : "Now"}<small>{coupon.expiresAt ? `Until ${new Date(coupon.expiresAt).toLocaleDateString("en-IN")}` : "No expiry"}</small></td><td><span className={`admin-commerce__badge ${coupon.active ? "" : "is-muted"}`}>{coupon.active ? "Active" : "Inactive"}</span></td><td className="admin-commerce__actions"><button onClick={() => editCoupon(coupon)}>Edit</button><button onClick={() => toggleCoupon(coupon)}>{coupon.active ? "Deactivate" : "Activate"}</button></td></tr>)}
      </tbody></table></div>
      <footer className="admin-commerce__pagination"><span>Page {page} of {Math.max(pagination.totalPages, 1)} · {pagination.totalCoupons} coupons</span><div><label>Rows <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label><button disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button><button disabled={page >= pagination.totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</button></div></footer>
    </div>
  </section>;
}
