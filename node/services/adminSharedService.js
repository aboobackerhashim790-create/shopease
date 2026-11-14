// Helpers reused by multiple admin service modules.

function caseInsensitiveExact(field, value) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { [field]: { $regex: `^${escaped}$`, $options: "i" } };
}

export { caseInsensitiveExact };
