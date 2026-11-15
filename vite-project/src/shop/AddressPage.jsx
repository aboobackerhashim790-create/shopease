import API, { isSuccess } from "../api/client.js";
import { useCallback, useEffect, useRef, useState } from "react";
import "./AddressPage.css";

const indianStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

const pinErrorMessages = {
  INVALID_PIN_CODE: "Enter a valid 6-digit Indian PIN code.",
  PIN_CODE_NOT_FOUND: "That PIN code was not found in the postal directory.",
  PIN_STATE_MISMATCH: "The PIN code does not match the selected state.",
  PIN_LOOKUP_UNAVAILABLE:
    "PIN code lookup is temporarily unavailable. Please try again.",
  STATE_REQUIRED: "Select a state before checking the PIN code.",
};

const blankAddress = {
  label: "Home",
  fullName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  isDefault: false,
};

const addressFieldNames = [
  "fullName", "phone", "addressLine1", "addressLine2",
  "city", "state", "postalCode", "country",
];

function validateAddressField(name, value, form) {
  const text = String(value ?? "").trim();
  const labels = {
    fullName: "Recipient name", addressLine1: "Address line 1",
    city: "City", state: "State / region", postalCode: "Postal code", country: "Country",
  };
  if (labels[name] && !text) return `${labels[name]} is required.`;
  if (name === "fullName" && text.length > 100) return "Recipient name must be 100 characters or fewer.";
  if (name === "phone" && !/^[6-9]\d{9}$/.test(text)) return "Enter a valid 10-digit Indian mobile number.";
  if (name === "addressLine1" && text.length > 160) return "Address line 1 must be 160 characters or fewer.";
  if (name === "addressLine2" && text.length > 160) return "Address line 2 must be 160 characters or fewer.";
  if (name === "city" && text.length > 80) return "City must be 80 characters or fewer.";
  if (name === "state" && text.length > 80) return "State must be 80 characters or fewer.";
  if (name === "country" && text.length > 80) return "Country must be 80 characters or fewer.";
  if (name === "postalCode") {
    if (text.length > 20) return "Postal code must be 20 characters or fewer.";
    if (form.country.trim().toLowerCase() === "india" && !/^\d{6}$/.test(text)) return "Enter a valid 6-digit Indian PIN code.";
  }
  return "";
}

async function requestAddresses() {
  const response = await API.get("/profile/addresses");
  const result = response.data;
  if (!isSuccess(response))
    throw new Error(result.message || "Could not load addresses.");
  return result.addresses || [];
}

function AddressesPage() {
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState(blankAddress);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [pinChecking, setPinChecking] = useState(false);
  const pinLookupRequest = useRef(0);

  const loadAddresses = useCallback(async () => {
    try {
      setAddresses(await requestAddresses());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    requestAddresses()
      .then((items) => {
        if (active) setAddresses(items);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      pinLookupRequest.current += 1;
    };
  }, []);

  function updateField(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => {
      const nextForm = {
        ...current,
        [name]: type === "checkbox" ? checked : value,
      };

      // City and state came from the previous PIN lookup. Clear them as soon
      // as the PIN changes so they cannot be saved for a different PIN.
      if (name === "postalCode") {
        nextForm.city = "";
        nextForm.state = "";
      }

      return nextForm;
    });

    if (addressFieldNames.includes(name)) {
      const nextForm = { ...form, [name]: value };
      setFieldErrors((current) => ({
        ...current,
        [name]: validateAddressField(name, value, nextForm),
      }));
      setTouchedFields((current) => ({ ...current, [name]: true }));
      if (name === "country" && touchedFields.postalCode) {
        setFieldErrors((current) => ({
          ...current,
          postalCode: validateAddressField("postalCode", form.postalCode, nextForm),
        }));
      }
    }

    if (name === "postalCode") {
      pinLookupRequest.current += 1;
      const requestId = pinLookupRequest.current;
      setMessage("");
      setFieldErrors((current) => ({
        ...current,
        postalCode: "",
        city: "",
        state: "",
      }));

      if (/^\d{6}$/.test(value)) {
        checkPincode(value, requestId);
      } else {
        setPinChecking(false);
      }
    }
  }

  async function checkPincode(postalCode, requestId) {
    setPinChecking(true);
    setFieldErrors((current) => ({ ...current, postalCode: "" }));
    try {
      const response = await API.get(
        "/profile/addresses/pincode/" + encodeURIComponent(postalCode),
      );
      const result = response.data;
      if (!isSuccess(response))
        throw new Error(
          pinErrorMessages[result.code] ||
          result.message ||
          "Could not check this PIN code.",
        );
      if (requestId !== pinLookupRequest.current) return;
      setForm((current) => ({
        ...current,
        city: result.city || "",
        state: result.state || "",
        country: result.country || current.country,
      }));
      setFieldErrors((current) => ({
        ...current,
        postalCode: "",
        city: "",
        state: "",
        country: "",
      }));
      setMessage("City, state, and country filled from the PIN code.");
    } catch (requestError) {
      if (requestId === pinLookupRequest.current) {
        setFieldErrors((current) => ({
          ...current,
          postalCode:
            pinErrorMessages[requestError.response?.data?.code] ||
            requestError.response?.data?.message ||
            requestError.message,
        }));
      }
    } finally {
      if (requestId === pinLookupRequest.current) setPinChecking(false);
    }
  }

  async function saveAddress(event) {
    event.preventDefault();
    const clientErrors = Object.fromEntries(
      addressFieldNames.map((name) => [name, validateAddressField(name, form[name], form)]),
    );
    setTouchedFields(Object.fromEntries(addressFieldNames.map((name) => [name, true])));
    setFieldErrors(clientErrors);
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const url = `/profile/addresses${editingId ? `/${editingId}` : ""}`;
      const method = editingId ? "PATCH" : "POST";
      const response = await API.request({ url, method, data: form });
      const result = response.data;
      if (!isSuccess(response))
        throw new Error(
          pinErrorMessages[result.code] ||
          result.message ||
          "Could not save this address.",
        );
      setMessage(result.message);
      setForm(blankAddress);
      setFieldErrors({});
      setTouchedFields({});
      setEditingId(null);
      await loadAddresses();
    } catch (requestError) {
      const serverErrors = requestError.response?.data?.fieldErrors || {};
      setFieldErrors((current) => ({ ...current, ...serverErrors }));
      if (Object.keys(serverErrors).length === 0) {
        setError(requestError.response?.data?.message || requestError.message);
      }
    } finally {
      setSaving(false);
    }
  }

  function startEditing(address) {
    setEditingId(address._id);
    setForm({
      label: address.label || "Home",
      fullName: address.fullName || "",
      phone: address.phone || "",
      addressLine1: address.addressLine1 || "",
      addressLine2: address.addressLine2 || "",
      city: address.city || "",
      state: address.state || "",
      postalCode: address.postalCode || "",
      country: address.country || "",
      isDefault: address.isDefault,
    });
    setMessage("");
    setError("");
    setFieldErrors({});
    setTouchedFields({});
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(blankAddress);
    setFieldErrors({});
    setTouchedFields({});
    setError("");
  }

  function fieldProps(name) {
    const touched = Boolean(touchedFields[name]);
    const optionalAndEmpty = name === "addressLine2" && !form.addressLine2.trim();
    return {
      "aria-invalid": touched && Boolean(fieldErrors[name]),
      className: touched && !optionalAndEmpty ? (fieldErrors[name] ? "field-invalid" : "field-valid") : "",
      onBlur: () => {
        setTouchedFields((current) => ({ ...current, [name]: true }));
        setFieldErrors((current) => ({
          ...current,
          [name]: validateAddressField(name, form[name], form),
        }));
      },
    };
  }

  function fieldFeedback(name) {
    if (!touchedFields[name]) return null;
    if (name === "addressLine2" && !form.addressLine2.trim()) return null;
    return (
      <span
        className={`address-field-feedback ${fieldErrors[name] ? "is-error" : "is-success"}`}
        role={fieldErrors[name] ? "alert" : "status"}
      >
        {fieldErrors[name] || "Looks good."}
      </span>
    );
  }

  async function setDefault(addressId) {
    setError("");
    try {
      const response = await API.patch(
        `/profile/addresses/${addressId}/default`,
      );
      const result = response.data;
      if (!isSuccess(response))
        throw new Error(result.message || "Could not set the default address.");
      setMessage(result.message);
      await loadAddresses();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function removeAddress(address) {
    if (!window.confirm(`Remove the ${address.label || "saved"} address?`))
      return;
    setError("");
    try {
      const response = await API.delete(`/profile/addresses/${address._id}`);
      const result = response.data;
      if (!isSuccess(response))
        throw new Error(result.message || "Could not remove this address.");
      setMessage(result.message);
      await loadAddresses();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <section className="addresses-page">
      <header className="account-page-heading">
        <p className="account-eyebrow">DELIVERY DETAILS</p>
        <h1>Saved addresses</h1>
        <p>Add and manage places where you’d like your orders delivered.</p>
      </header>

      {message && (
        <p className="account-notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="account-notice account-notice-error" role="alert">
          {error}
        </p>
      )}

      <section className="account-panel address-form-panel">
        <div className="account-panel-heading">
          <div>
            <h2>{editingId ? "Edit address" : "Add a new address"}</h2>
            <p>Your address is private to your account.</p>
          </div>
          <span aria-hidden="true">⌖</span>
        </div>
        <form className="address-form" onSubmit={saveAddress} noValidate>
          <label>
            Address label
            <select name="label" value={form.label} onChange={updateField}>
              <option>Home</option>
              <option>Work</option>
              <option>Other</option>
            </select>
          </label>
          <label className="address-field">
            Recipient name
            <input
              name="fullName"
              value={form.fullName}
              onChange={updateField}
              {...fieldProps("fullName")}
              maxLength={100}
            />
            {fieldFeedback("fullName")}
          </label>
          <label className="address-field">
            Phone number
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={updateField}
              {...fieldProps("phone")}
              maxLength={30}
            />
            {fieldFeedback("phone")}
          </label>
          <label className="address-field address-field-wide">
            Address line 1
            <input
              name="addressLine1"
              value={form.addressLine1}
              onChange={updateField}
              {...fieldProps("addressLine1")}
              maxLength={160}
            />
            {fieldFeedback("addressLine1")}
          </label>
          <label className="address-field address-field-wide">
            Address line 2 <span className="address-optional">Optional</span>
            <input
              name="addressLine2"
              value={form.addressLine2}
              onChange={updateField}
              {...fieldProps("addressLine2")}
              maxLength={160}
            />
            {fieldFeedback("addressLine2")}
          </label>
          <label className="address-field">
            City
            <input
              name="city"
              value={form.city}
              onChange={updateField}
              {...fieldProps("city")}
              maxLength={80}
            />
            {fieldFeedback("city")}
          </label>
          <label className="address-field">
            Country
            <input
              name="country"
              value={form.country}
              onChange={updateField}
              {...fieldProps("country")}
              maxLength={80}
            />
            {fieldFeedback("country")}
          </label>
          <label className="address-field">
            State / region
            {form.country.trim().toLowerCase() === "india" ? (
              <select
                name="state"
                value={form.state}
                onChange={updateField}
                {...fieldProps("state")}
              >
                <option value="">Select a state or union territory</option>
                {indianStates.map((state) => (
                  <option key={state}>{state}</option>
                ))}
              </select>
            ) : (
              <input
                name="state"
                value={form.state}
                onChange={updateField}
                {...fieldProps("state")}
                maxLength={80}
              />
            )}
            {fieldFeedback("state")}
          </label>
          <label className="address-field">
            Postal code
            <input
              name="postalCode"
              value={form.postalCode}
              onChange={updateField}
              {...fieldProps("postalCode")}
              maxLength={form.country.trim().toLowerCase() === "india" ? 6 : 20}
              inputMode={
                form.country.trim().toLowerCase() === "india"
                  ? "numeric"
                  : undefined
              }
              pattern={
                form.country.trim().toLowerCase() === "india"
                  ? "[0-9]{6}"
                  : undefined
              }
            />
            {fieldFeedback("postalCode")}
          </label>
          {pinChecking && (
            <p className="address-form-hint" role="status">
              Checking PIN code…
            </p>
          )}
          <label className="address-default-check">
            <input
              type="checkbox"
              name="isDefault"
              checked={form.isDefault}
              onChange={updateField}
            />
            Set as my default address
          </label>
          <div className="address-form-actions">
            {editingId && (
              <button
                className="account-button account-button-light"
                type="button"
                onClick={cancelEditing}
              >
                Cancel
              </button>
            )}
            <button
              className="account-button account-button-primary"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving…" : editingId ? "Save address" : "Add address"}
            </button>
          </div>
        </form>
      </section>

      <section className="saved-addresses-section">
        <div className="account-panel-heading saved-address-heading">
          <div>
            <h2>Your saved places</h2>
            <p>
              {addresses.length}{" "}
              {addresses.length === 1 ? "address" : "addresses"}
            </p>
          </div>
        </div>
        {loading ? (
          <p className="account-empty">Loading addresses…</p>
        ) : addresses.length === 0 ? (
          <p className="account-empty">You haven’t saved an address yet.</p>
        ) : (
          <div className="saved-address-grid">
            {addresses.map((address) => (
              <article
                className={`saved-address-card${address.isDefault ? " is-default" : ""}`}
                key={address._id}
              >
                <div className="saved-address-topline">
                  <span className="saved-address-label">
                    ⌂ &nbsp;{address.label}
                  </span>
                  {address.isDefault && (
                    <span className="default-address-badge">DEFAULT</span>
                  )}
                </div>
                <strong>{address.fullName}</strong>
                <p>
                  {address.addressLine1}
                  {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                </p>
                <p>
                  {address.city}, {address.state} {address.postalCode}
                </p>
                <p>
                  {address.country} · {address.phone}
                </p>
                <div className="saved-address-actions">
                  {!address.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefault(address._id)}
                    >
                      Make default
                    </button>
                  )}
                  <button type="button" onClick={() => startEditing(address)}>
                    Edit
                  </button>
                  <button
                    className="address-remove-button"
                    type="button"
                    onClick={() => removeAddress(address)}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

export default AddressesPage;
