import Category from "../models/Category.js";

// A category is storefront-visible only when it and each of its ancestors are active.
async function getVisibleStoreCategoryIds() {
  const categories = await Category.find({ active: true })
    .select("_id parentCategoryId")
    .lean();
  const byId = new Map(categories.map((category) => [String(category._id), category]));
  const visible = new Set();

  function hasActiveAncestors(category, path = new Set()) {
    const id = String(category._id);
    if (path.has(id)) return false; // Defensive guard against a category-parent cycle.
    if (!category.parentCategoryId) return true;
    const parentId = String(category.parentCategoryId);
    const parent = byId.get(parentId);
    if (!parent) return false;
    const nextPath = new Set(path);
    nextPath.add(id);
    return hasActiveAncestors(parent, nextPath);
  }

  for (const category of categories) {
    if (hasActiveAncestors(category)) visible.add(String(category._id));
  }
  return categories.filter((category) => visible.has(String(category._id))).map((category) => category._id);
}

export { getVisibleStoreCategoryIds };
