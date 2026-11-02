const INDIA_PIN_LOOKUP_URL = "https://api.postalpincode.in/pincode/";

async function lookupIndiaPincode(postalCode) {
  const response = await fetch(
    `${INDIA_PIN_LOOKUP_URL}${encodeURIComponent(postalCode)}`,
    {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    },
  );
  if (!response.ok) throw new Error("The PIN code service is unavailable.");
  const result = await response.json();
  const entry = Array.isArray(result) ? result[0] : null;
  if (
    entry?.Status !== "Success" ||
    !Array.isArray(entry.PostOffice) ||
    !entry.PostOffice.length
  )
    return null;
  const offices = entry.PostOffice;
  return {
    states: [...new Set(offices.map((office) => office.State).filter(Boolean))],
    districts: [
      ...new Set(offices.map((office) => office.District).filter(Boolean)),
    ],
  };
}

export { lookupIndiaPincode };
