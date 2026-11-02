import "../config/loadEnvironment.js";
import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";

const categorySeeds = [
  { name: "Audio & Headphones", slug: "audio-headphones", sortOrder: 1 },
  { name: "Computers & Accessories", slug: "computers-accessories", sortOrder: 2 },
  { name: "Mobile Accessories", slug: "mobile-accessories", sortOrder: 3 },
  { name: "Smart Wearables", slug: "smart-wearables", sortOrder: 4 },
];

const productSeeds = [
  {
    name: "Studio Wireless Headphones",
    slug: "studio-wireless-headphones",
    description: "Comfortable over-ear headphones with clear sound for music, calls, and focused work.",
    categorySlug: "audio-headphones",
    brand: "ShopEase Audio",
    variants: [
      { sku: "SEA-HEAD-BLK", options: { color: "Graphite", storage: "" }, price: 5499, compareAtPrice: 6999, stockQuantity: 14, images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85"], active: true },
      { sku: "SEA-HEAD-SND", options: { color: "Sand", storage: "" }, price: 5699, compareAtPrice: 6999, stockQuantity: 8, images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85"], active: true },
    ],
    images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85"],
    specifications: { Connectivity: "Bluetooth", "Battery life": "Up to 30 hours", Type: "Over-ear" },
    warranty: "1 year",
    tags: ["Wireless", "Comfort fit", "Noise reduction"],
    isFeatured: true,
  },
  {
    name: "Compact Mechanical Keyboard",
    slug: "compact-mechanical-keyboard",
    description: "A compact mechanical keyboard with tactile switches and a sturdy frame for everyday typing.",
    categorySlug: "computers-accessories",
    brand: "ShopEase Studio",
    sku: "SES-KEY-75-WHT",
    price: 4299,
    compareAtPrice: 5299,
    stockQuantity: 22,
    images: ["https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85"],
    specifications: { Layout: "75%", Connection: "USB-C", Switches: "Tactile" },
    warranty: "1 year",
    tags: ["Compact layout", "Mechanical switches"],
    isFeatured: true,
  },
  {
    name: "Ergonomic Wireless Mouse",
    slug: "ergonomic-wireless-mouse",
    description: "A comfortable wireless mouse with precise tracking for work and study.",
    categorySlug: "computers-accessories",
    brand: "ShopEase Studio",
    sku: "SES-MOUSE-ERG-01",
    price: 1499,
    compareAtPrice: 1999,
    stockQuantity: 31,
    images: ["https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=900&q=85"],
    specifications: { Connection: "2.4 GHz wireless", Buttons: "6", Sensor: "Optical" },
    warranty: "1 year",
    tags: ["Ergonomic", "Wireless"],
    isFeatured: true,
  },
  {
    name: "Smart Fitness Watch",
    slug: "smart-fitness-watch",
    description: "A lightweight smart watch for activity tracking, everyday notifications, and quick status checks.",
    categorySlug: "smart-wearables",
    brand: "ShopEase Active",
    variants: [
      { sku: "SEA-WATCH-BLK", options: { color: "Midnight", storage: "" }, price: 4999, compareAtPrice: 6499, stockQuantity: 11, images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85"], active: true },
      { sku: "SEA-WATCH-SLV", options: { color: "Silver", storage: "" }, price: 5199, compareAtPrice: 6499, stockQuantity: 7, images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85"], active: true },
    ],
    images: ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85"],
    specifications: { Display: "Color touchscreen", Connectivity: "Bluetooth", WaterResistance: "Everyday splash resistant" },
    warranty: "1 year",
    tags: ["Activity tracking", "Notifications"],
    isFeatured: true,
  },
  {
    name: "Portable Bluetooth Speaker",
    slug: "portable-bluetooth-speaker",
    description: "A portable speaker with room-filling sound for your desk, kitchen, or weekend trips.",
    categorySlug: "audio-headphones",
    brand: "ShopEase Audio",
    sku: "SEA-SPEAKER-01",
    price: 2499,
    compareAtPrice: 3299,
    stockQuantity: 18,
    images: ["https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=900&q=85"],
    specifications: { Connection: "Bluetooth", Battery: "Up to 12 hours", Charging: "USB-C" },
    warranty: "1 year",
    tags: ["Portable", "USB-C charging"],
    isFeatured: false,
  },
  {
    name: "USB-C Multiport Hub",
    slug: "usb-c-multiport-hub",
    description: "Add useful ports to your laptop with this compact hub for workstations and travel.",
    categorySlug: "mobile-accessories",
    brand: "ShopEase Connect",
    sku: "SEC-HUB-7P-01",
    price: 1899,
    compareAtPrice: 2499,
    stockQuantity: 16,
    images: ["https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=85"],
    specifications: { Ports: "7", Connector: "USB-C", Material: "Aluminium" },
    warranty: "1 year",
    tags: ["USB-C", "Travel friendly"],
    isFeatured: false,
  },
];

async function seedStorefront() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);

  const categories = new Map();
  for (const seed of categorySeeds) {
    let category = await Category.findOne({ $or: [{ slug: seed.slug }, { name: seed.name }] });
    if (!category) category = await Category.create({ ...seed, active: true });
    categories.set(seed.slug, category);
  }

  let insertedProducts = 0;
  let skippedProducts = 0;
  for (const seed of productSeeds) {
    const existing = await Product.findOne({
      $or: [{ slug: seed.slug }, ...(seed.sku ? [{ sku: seed.sku }] : [])],
    });
    if (existing) {
      skippedProducts += 1;
      continue;
    }
    const category = categories.get(seed.categorySlug);
    const { categorySlug, ...productData } = seed;
    await Product.create({
      ...productData,
      categoryId: category._id,
      active: true,
      stockQuantity: productData.stockQuantity ?? 0,
    });
    insertedProducts += 1;
  }

  console.log(`Categories ready: ${categories.size}. Products added: ${insertedProducts}; already present: ${skippedProducts}.`);
}

seedStorefront()
  .catch((error) => {
    console.error("Could not seed storefront data:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
