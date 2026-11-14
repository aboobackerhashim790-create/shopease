import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { getVisibleStoreCategoryIds } from "../utils/storeCategoryVisibility.js";
import { caseInsensitiveExact } from "./adminSharedService.js";

//------------------ Category Management -------------------------------

async function createCategory(input) {
  try {
    const { name, slug, active = true, sortOrder = 0, parentCategoryId } = input.body || {};
    if (typeof name !== "string" || !name.trim() || typeof slug !== "string" || !slug.trim()) {
      return {
        status: 400,
        body: {
          message: "Name and Slug are required"
        }
      }
    }

    if (typeof active !== "boolean" || !Number.isFinite(Number(sortOrder))) {
      return { status: 400, body: { message: "Active must be true or false and sort order must be a number." } };
    }
    if (Number(sortOrder) < 0 || name.trim().length > 120 || slug.trim().length > 160 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug.trim())) {
      return { status: 400, body: { message: "Use a name up to 120 characters, a valid URL slug, and a non-negative sort order." } };
    }

    if (parentCategoryId && !mongoose.isValidObjectId(parentCategoryId)) {
      return {
        status: 400,
        body: { message: "Invalid parent category ID." },
      };
    }

    const visibleCategoryIds = await getVisibleStoreCategoryIds();
    if (parentCategoryId && !visibleCategoryIds.some((id) => String(id) === String(parentCategoryId))) {
      return {
        status: 404,
        body: { message: "Active parent category not found." },
      };
    }

    const pendingCategory = await Category.findOne({
      $or: [
        caseInsensitiveExact("name", name.trim()),
        caseInsensitiveExact("slug", slug.trim().toLowerCase()),
      ],
    });

    if (pendingCategory) {
      return {
        status: 409,
        body: {
          message: "A category with this name and slug already exists"
        }
      }
    }

    await Category.create({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      active,
      sortOrder: Number(sortOrder),
      parentCategoryId: parentCategoryId || null,
    })
    return {
      status: 201,
      body: { message: "Category created." },
    };

  } catch (error) {
    console.error("Create category error:", error);
    if (error.code === 11000) return { status: 409, body: { message: "A category with this name or slug already exists." } };

    return {
      status: 500,
      body: {
        message: "Could not create category.",
      },
    };

  }
}

async function listCategory(input) {
  try {
    const query = input.query || {};


    const searchInput = input.query?.search;
    if (searchInput !== undefined && typeof searchInput !== "string") {
      return { status: 400, body: { message: "Search must be text." } };
    }
    const search = searchInput?.trim() || "";

    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = search
      ? { name: { $regex: safeSearch, $options: "i" } }
      : {};


    const status = query.status || "all";
    if (!["all", "listed", "unlisted"].includes(status)) {
      return { status: 400, body: { message: "Status must be all, listed, or unlisted." } };
    }
    if (status === "listed") filter.active = true;
    if (status === "unlisted") filter.active = false;

    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const requestedLimit = Number.parseInt(query.limit, 10) || 10;
    const limit = Math.min(Math.max(requestedLimit, 1), 50);
    const skip = (page - 1) * limit;


    const sortOrderDirection =
      query.sortOrderDirection === "desc" ? -1 : 1;

    const createdAtDirection = query.createdAtDirection === "asc" ? 1 : -1;

    const [categories, totalCategories] = await Promise.all([
      Category.find(filter)
        .sort({ sortOrder: sortOrderDirection, createdAt: createdAtDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      Category.countDocuments(filter),
    ]);

    const catogeriesWithChildCount = await Promise.all(
      categories.map(async (category) => {
        const childCount = await Category.countDocuments({
          parentCategoryId: category._id
        })
        return {
          ...category,
          childCount
        }
      })
    )
    return {
      status: 200,
      body: {
        categories: catogeriesWithChildCount,
        pagination: {
          page,
          limit,
          totalCategories,
          totalPages: Math.ceil(totalCategories / limit),
        },
      },
    }
  } catch (error) {
    console.error("Get categorie error:", error);


    return {
      status: 500,
      body: { message: "Could not load categories" }
    }
  }
}

async function editCategry(input) {
  try {
    const { name, sortOrder, slug, active, _id, parentCategoryId } = input.body || {};

    if (typeof name !== "string" || !name.trim() || typeof slug !== "string" || !slug.trim()) {
      return {
        status: 400,
        body: { message: "Name and slug are required." },
      };
    }
    if (name.trim().length > 120 || slug.trim().length > 160 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug.trim())) {
      return { status: 400, body: { message: "Category name or URL slug is invalid or too long." } };
    }
    if (!mongoose.isValidObjectId(_id)) {
      return {
        status: 400,
        body: { message: "Invalid category ID." },
      };
    }
    if (active !== undefined && typeof active !== "boolean") {
      return { status: 400, body: { message: "Active must be true or false." } };
    }
    if (sortOrder !== undefined && (!Number.isFinite(Number(sortOrder)) || Number(sortOrder) < 0)) {
      return { status: 400, body: { message: "Sort order must be a non-negative number." } };
    }

    const normalizedParentCategoryId = parentCategoryId || null;
    if (
      normalizedParentCategoryId &&
      !mongoose.isValidObjectId(normalizedParentCategoryId)
    ) {
      return {
        status: 400,
        body: { message: "Invalid parent category ID." },
      };
    }
    if (normalizedParentCategoryId && normalizedParentCategoryId.toString() === _id) {
      return {
        status: 400,
        body: { message: "A category cannot be its own parent." },
      };
    }
    if (normalizedParentCategoryId) {
      let ancestorId = normalizedParentCategoryId;
      const visited = new Set();
      while (ancestorId) {
        const ancestorKey = String(ancestorId);
        if (ancestorKey === String(_id) || visited.has(ancestorKey)) {
          return { status: 400, body: { message: "This parent would create a category cycle." } };
        }
        visited.add(ancestorKey);
        const ancestor = await Category.findById(ancestorId).select("parentCategoryId").lean();
        ancestorId = ancestor?.parentCategoryId || null;
      }
    }

    const visibleCategoryIds = await getVisibleStoreCategoryIds();
    if (normalizedParentCategoryId && !visibleCategoryIds.some((id) => String(id) === String(normalizedParentCategoryId))) {
      return {
        status: 404,
        body: { message: "Active parent category not found." },
      };
    }

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();
    const anotherCategoryWithName = await Category.findOne({
      ...caseInsensitiveExact("name", trimmedName),
      _id: { $ne: _id },
    });

    if (anotherCategoryWithName) {
      return {
        status: 409,
        body: { message: "Another category already uses this name." },
      };
    }

    const anotherCategoryWithSlug = await Category.findOne({
      ...caseInsensitiveExact("slug", trimmedSlug),
      _id: { $ne: _id },
    });

    if (anotherCategoryWithSlug) {
      return {
        status: 409,
        body: { message: "Another category already uses this slug." },
      };
    }

    const category = await Category.findByIdAndUpdate(
      _id,
      {
        $set: {
          name: trimmedName,
          slug: trimmedSlug,
          ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
          ...(active !== undefined ? { active } : {}),
          parentCategoryId: normalizedParentCategoryId,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!category) {
      return {
        status: 404,
        body: { message: "Category not found." },
      };
    }

    return {
      status: 200,
      body: { message: "Category updated successfully." },
    };
  } catch (error) {
    console.error("Update category error:", error);
    if (error.code === 11000) return { status: 409, body: { message: "Another category already uses this name or slug." } };
    return {
      status: 500,
      body: { message: "Could not update category." },
    };
  }
}
async function deleteCategory(input) {
  try {
    const { categoryId } = input.params;

    if (!mongoose.isValidObjectId(categoryId)) {
      return {
        status: 400,
        body: { message: "Invalid category ID." },
      };
    }
    const category = await Category.findById(categoryId).select("_id").lean();
    if (!category) {
      return {
        status: 404,
        body: { message: "Category not found." },
      };
    }

    const [hasProducts, hasChildren] = await Promise.all([
      Product.exists({ categoryId }),
      Category.exists({ parentCategoryId: categoryId }),
    ]);
    if (hasProducts || hasChildren) {
      return {
        status: 409,
        body: {
          message: "This category still has products or child categories. Move or remove them before permanently deleting it.",
        },
      };
    }

    await Category.findByIdAndDelete(categoryId);
    return {
      status: 200,
      body: { message: "Category permanently deleted." },
    };
  } catch (error) {
    console.error("Delete category error:", error);
    return {
      status: 500,
      body: { message: "Could not delete category." },
    };
  }
}

async function setCategoryListing(input) {
  try {
    const { categoryId } = input.params;
    const { active } = input.body || {};

    if (!mongoose.isValidObjectId(categoryId)) {
      return { status: 400, body: { message: "Invalid category ID." } };
    }
    if (typeof active !== "boolean") {
      return { status: 400, body: { message: "Active must be true or false." } };
    }

    const category = await Category.findByIdAndUpdate(
      categoryId,
      { $set: { active } },
      { new: true, runValidators: true },
    ).select("_id active").lean();

    if (!category) {
      return { status: 404, body: { message: "Category not found." } };
    }

    return {
      status: 200,
      body: { message: active ? "Category listed." : "Category unlisted.", category },
    };
  } catch (error) {
    console.error("Update category listing error:", error);
    return { status: 500, body: { message: "Could not update category status." } };
  }
}

export { createCategory, listCategory, editCategry, deleteCategory, setCategoryListing };
