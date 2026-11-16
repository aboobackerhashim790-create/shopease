import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not found in .env");
  process.exit(1);
}

import Category from "../models/Category.js";
import Product from "../models/Product.js";

const categoriesData = [
  {
    name: "Smartphones",
    slug: "smartphones",
    active: true,
    sortOrder: 1,
  },
  {
    name: "Laptops",
    slug: "laptops",
    active: true,
    sortOrder: 2,
  },
  {
    name: "Audio & Headphones",
    slug: "audio-headphones",
    active: true,
    sortOrder: 3,
  },
  {
    name: "Smartwatches",
    slug: "smartwatches",
    active: true,
    sortOrder: 4,
  },
  {
    name: "Accessories",
    slug: "accessories",
    active: true,
    sortOrder: 5,
  },
];

const productsData = [
  // Category 1: Smartphones (5 products)
  {
    catSlug: "smartphones",
    name: "Apple iPhone 15 Pro",
    slug: "apple-iphone-15-pro",
    brand: "Apple",
    description: "Forged in titanium and featuring the groundbreaking A17 Pro chip, customizable Action button, and a powerful iPhone camera system.",
    price: 134900,
    compareAtPrice: 144900,
    stockQuantity: 25,
    images: [
      "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: true,
    tags: ["smartphone", "apple", "5g", "flagship"],
    specifications: { Display: "6.1-inch Super Retina XDR", Processor: "A17 Pro", Camera: "48MP Main" },
  },
  {
    catSlug: "smartphones",
    name: "Samsung Galaxy S24 Ultra",
    slug: "samsung-galaxy-s24-ultra",
    brand: "Samsung",
    description: "Meet Galaxy S24 Ultra with Galaxy AI, titanium frame, built-in S Pen, and 200MP camera with next-level zoom capabilities.",
    price: 129999,
    compareAtPrice: 139999,
    stockQuantity: 18,
    images: [
      "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: true,
    tags: ["smartphone", "samsung", "ai", "flagship"],
    specifications: { Display: "6.8-inch Dynamic AMOLED 2X", Processor: "Snapdragon 8 Gen 3", Camera: "200MP Quad" },
  },
  {
    catSlug: "smartphones",
    name: "Google Pixel 8 Pro",
    slug: "google-pixel-8-pro",
    brand: "Google",
    description: "Google Tensor G3 chip designed with Google AI for cutting-edge photo and video editing and personalized assistance all day.",
    price: 93999,
    compareAtPrice: 106999,
    stockQuantity: 15,
    images: [
      "https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["smartphone", "google", "pixel", "camera"],
    specifications: { Display: "6.7-inch Super Actua", Processor: "Google Tensor G3", Camera: "50MP Triple" },
  },
  {
    catSlug: "smartphones",
    name: "OnePlus 12 5G",
    slug: "oneplus-12-5g",
    brand: "OnePlus",
    description: "Powered by Qualcomm Snapdragon 8 Gen 3, 4th Gen Hasselblad Camera System, and 100W SUPERVOOC hyper-fast charging.",
    price: 64999,
    compareAtPrice: 69999,
    stockQuantity: 30,
    images: [
      "https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["smartphone", "oneplus", "fastcharge"],
    specifications: { Display: "6.82-inch 2K ProXDR", Battery: "5400mAh", Charging: "100W" },
  },
  {
    catSlug: "smartphones",
    name: "Nothing Phone (2)",
    slug: "nothing-phone-2",
    brand: "Nothing",
    description: "Unique transparent Glyph Interface, Snapdragon 8+ Gen 1 chipset, and clean Nothing OS 2.0 with zero bloatware.",
    price: 36999,
    compareAtPrice: 44999,
    stockQuantity: 20,
    images: [
      "https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["smartphone", "nothing", "glyph"],
    specifications: { Display: "6.7-inch OLED 120Hz", OS: "Nothing OS 2.5", Camera: "50MP Dual" },
  },

  // Category 2: Laptops (5 products)
  {
    catSlug: "laptops",
    name: "Apple MacBook Air M3 (13-inch)",
    slug: "apple-macbook-air-m3-13",
    brand: "Apple",
    description: "Lean, mean M3 machine. Incredibly thin and fast with up to 18 hours of battery life and Liquid Retina display.",
    price: 114900,
    compareAtPrice: 119900,
    stockQuantity: 14,
    images: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: true,
    tags: ["laptop", "macbook", "m3", "apple"],
    specifications: { Chip: "Apple M3 8-core", RAM: "8GB Unified", Storage: "256GB SSD" },
  },
  {
    catSlug: "laptops",
    name: "Dell XPS 13 9340",
    slug: "dell-xps-13-9340",
    brand: "Dell",
    description: "Iconic minimalist design crafted with CNC aluminum and Gorilla Glass 3, powered by Intel Core Ultra 7 processors.",
    price: 139990,
    compareAtPrice: 154990,
    stockQuantity: 10,
    images: [
      "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["laptop", "dell", "ultrabook", "windows"],
    specifications: { Processor: "Intel Core Ultra 7", RAM: "16GB LPDDR5X", Storage: "512GB SSD" },
  },
  {
    catSlug: "laptops",
    name: "ASUS ROG Zephyrus G14",
    slug: "asus-rog-zephyrus-g14",
    brand: "ASUS",
    description: "Ultraportable gaming laptop equipped with AMD Ryzen 9, NVIDIA GeForce RTX 4060, and vibrant OLED ROG Nebula Display.",
    price: 149990,
    compareAtPrice: 169990,
    stockQuantity: 8,
    images: [
      "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: true,
    tags: ["laptop", "gaming", "asus", "rtx4060"],
    specifications: { GPU: "NVIDIA RTX 4060", Display: "14-inch 3K OLED 120Hz", Weight: "1.5 kg" },
  },
  {
    catSlug: "laptops",
    name: "HP Pavilion Plus 14",
    slug: "hp-pavilion-plus-14",
    brand: "HP",
    description: "Empower your workflow with Intel Core i5 13th Gen, 2.8K OLED display, and premium audio by B&O in an elegant aluminum chassis.",
    price: 68990,
    compareAtPrice: 79990,
    stockQuantity: 22,
    images: [
      "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["laptop", "hp", "oled", "productivity"],
    specifications: { Processor: "Intel Core i5-13500H", RAM: "16GB", Display: "14-inch 2.8K OLED" },
  },
  {
    catSlug: "laptops",
    name: "Lenovo Legion Pro 5i",
    slug: "lenovo-legion-pro-5i",
    brand: "Lenovo",
    description: "Pure performance gaming powerhouse with Intel Core i7 14th Gen, RTX 4070, and Coldfront 5.0 thermal technology.",
    price: 162990,
    compareAtPrice: 184990,
    stockQuantity: 6,
    images: [
      "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["laptop", "gaming", "lenovo", "rtx4070"],
    specifications: { Processor: "Intel Core i7-14700HX", GPU: "RTX 4070 8GB", Display: "16-inch WQXGA 240Hz" },
  },

  // Category 3: Audio & Headphones (5 products)
  {
    catSlug: "audio-headphones",
    name: "Sony WH-1000XM5 Wireless Headphones",
    slug: "sony-wh-1000xm5-wireless-headphones",
    brand: "Sony",
    description: "Industry-leading noise canceling with two processors and 8 microphones for unprecedented quiet and magnificent high-res audio.",
    price: 29990,
    compareAtPrice: 34990,
    stockQuantity: 35,
    images: [
      "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: true,
    tags: ["audio", "sony", "anc", "headphones"],
    specifications: { BatteryLife: "30 Hours", NoiseCancellation: "Dual Processor ANC", Weight: "250g" },
  },
  {
    catSlug: "audio-headphones",
    name: "Apple AirPods Pro (2nd Gen, USB-C)",
    slug: "apple-airpods-pro-2-usbc",
    brand: "Apple",
    description: "Up to 2x more Active Noise Cancellation, Adaptive Audio, Transparency mode, and Personalized Spatial Audio with dynamic head tracking.",
    price: 24900,
    compareAtPrice: 26900,
    stockQuantity: 40,
    images: [
      "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: true,
    tags: ["audio", "apple", "airpods", "tws"],
    specifications: { Chip: "Apple H2", Case: "MagSafe USB-C", WaterResistance: "IP54" },
  },
  {
    catSlug: "audio-headphones",
    name: "Bose QuietComfort Ultra Earbuds",
    slug: "bose-quietcomfort-ultra-earbuds",
    brand: "Bose",
    description: "Breakthrough spatialized audio for more immersive listening that makes your music feel realer than ever, plus world-class ANC.",
    price: 25900,
    compareAtPrice: 29900,
    stockQuantity: 20,
    images: [
      "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["audio", "bose", "tws", "spatial"],
    specifications: { Technology: "Bose Immersive Audio", Battery: "6 Hours (24 with case)", ANC: "CustomTune" },
  },
  {
    catSlug: "audio-headphones",
    name: "Marshall Stanmore III Bluetooth Speaker",
    slug: "marshall-stanmore-iii-bluetooth-speaker",
    brand: "Marshall",
    description: "Heavy-hitting classic rock aesthetic with home-filling expansive stereo sound and next-generation Bluetooth 5.2 connectivity.",
    price: 36999,
    compareAtPrice: 41999,
    stockQuantity: 12,
    images: [
      "https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["audio", "speaker", "marshall", "bluetooth"],
    specifications: { Power: "80W Class D", Connectivity: "Bluetooth 5.2 / RCA / AUX", Frequency: "45–20,000 Hz" },
  },
  {
    catSlug: "audio-headphones",
    name: "boAt Rockerz 550 Over-Ear Headphone",
    slug: "boat-rockerz-550-over-ear-headphone",
    brand: "boAt",
    description: "50mm dynamic drivers provide immersive audio with deep punchy bass, plush earcups, and up to 20 hours playback.",
    price: 1999,
    compareAtPrice: 4990,
    stockQuantity: 65,
    images: [
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["audio", "boat", "budget", "wireless"],
    specifications: { DriverSize: "50mm", Playback: "20 Hours", Bluetooth: "v5.0" },
  },

  // Category 4: Smartwatches (5 products)
  {
    catSlug: "smartwatches",
    name: "Apple Watch Series 9 GPS 45mm",
    slug: "apple-watch-series-9-gps-45mm",
    brand: "Apple",
    description: "S9 SiP enables a supersunny display and a magical new double-tap gesture to interact with Apple Watch without touching the screen.",
    price: 44900,
    compareAtPrice: 47900,
    stockQuantity: 18,
    images: [
      "https://images.unsplash.com/photo-1509741102003-ca64bfe5f069?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: true,
    tags: ["smartwatch", "apple", "watch", "fitness"],
    specifications: { CaseSize: "45mm", Chip: "Apple S9 SiP", Battery: "18 Hours All-Day" },
  },
  {
    catSlug: "smartwatches",
    name: "Samsung Galaxy Watch 6 Classic (47mm)",
    slug: "samsung-galaxy-watch-6-classic-47mm",
    brand: "Samsung",
    description: "Refined timeless rotating bezel, advanced sleep coaching, body composition analysis, and sapphire crystal glass display.",
    price: 36999,
    compareAtPrice: 42999,
    stockQuantity: 15,
    images: [
      "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["smartwatch", "samsung", "wearos"],
    specifications: { Bezel: "Physical Rotating Bezel", Screen: "1.5-inch Super AMOLED", Durability: "5ATM + IP68" },
  },
  {
    catSlug: "smartwatches",
    name: "Garmin Forerunner 265",
    slug: "garmin-forerunner-265",
    brand: "Garmin",
    description: "Dedicated GPS running smartwatch featuring brilliant AMOLED touchscreen, training readiness insights, and multi-band GNSS.",
    price: 50490,
    compareAtPrice: 53990,
    stockQuantity: 10,
    images: [
      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["smartwatch", "garmin", "running", "gps"],
    specifications: { BatteryLife: "Up to 13 days in smartwatch mode", Display: "1.3-inch AMOLED", GPS: "Multi-band" },
  },
  {
    catSlug: "smartwatches",
    name: "Amazfit GTR 4 Smart Watch",
    slug: "amazfit-gtr-4-smart-watch",
    brand: "Amazfit",
    description: "Dual-band circularly-polarized GPS antenna, 150+ sports modes, Bluetooth phone calls, and remarkable 14-day battery life.",
    price: 16999,
    compareAtPrice: 23999,
    stockQuantity: 28,
    images: [
      "https://images.unsplash.com/photo-1510017803434-a899398421b3?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["smartwatch", "amazfit", "fitness"],
    specifications: { Display: "1.43-inch HD AMOLED", Battery: "Up to 14 Days", Sensors: "BioTracker 4.0 PPG" },
  },
  {
    catSlug: "smartwatches",
    name: "Noise ColorFit Ultra 3",
    slug: "noise-colorfit-ultra-3",
    brand: "Noise",
    description: "Large 1.96-inch AMOLED display with functional metallic crown, Tru Sync Bluetooth calling, and 100+ customizable watch faces.",
    price: 2999,
    compareAtPrice: 7999,
    stockQuantity: 50,
    images: [
      "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["smartwatch", "noise", "budget"],
    specifications: { ScreenSize: "1.96-inch AMOLED", Calling: "Bluetooth v5.3", Battery: "Up to 7 Days" },
  },

  // Category 5: Accessories (5 products)
  {
    catSlug: "accessories",
    name: "Anker 737 Power Bank (PowerCore 24K)",
    slug: "anker-737-power-bank-24k",
    brand: "Anker",
    description: "Ultra-powerful 140W two-way fast charging with smart digital display, capable of charging laptops, tablets, and phones simultaneously.",
    price: 12999,
    compareAtPrice: 15999,
    stockQuantity: 30,
    images: [
      "https://images.unsplash.com/photo-1609592424368-80e227090b8f?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: true,
    tags: ["accessories", "anker", "powerbank", "140w"],
    specifications: { Capacity: "24,000mAh", OutputPower: "140W Max", Ports: "2x USB-C, 1x USB-A" },
  },
  {
    catSlug: "accessories",
    name: "Logitech MX Master 3S Wireless Mouse",
    slug: "logitech-mx-master-3s-wireless-mouse",
    brand: "Logitech",
    description: "Performance wireless mouse with 8K DPI any-surface sensor, quiet clicks, and electromagnetic MagSpeed scrolling wheel.",
    price: 8995,
    compareAtPrice: 10995,
    stockQuantity: 25,
    images: [
      "https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["accessories", "logitech", "mouse", "ergonomic"],
    specifications: { DPI: "8000 DPI Darkfield", Battery: "Up to 70 days", Connectivity: "Bluetooth & Logi Bolt" },
  },
  {
    catSlug: "accessories",
    name: "Keychron K2 V2 Wireless Mechanical Keyboard",
    slug: "keychron-k2-v2-wireless-keyboard",
    brand: "Keychron",
    description: "Compact 75% layout Bluetooth mechanical keyboard with Gateron G Pro switches, RGB backlighting, and Mac/Windows compatibility.",
    price: 7999,
    compareAtPrice: 9499,
    stockQuantity: 20,
    images: [
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["accessories", "keyboard", "keychron", "mechanical"],
    specifications: { Layout: "75% (84 Keys)", Switches: "Gateron G Pro Brown", Connectivity: "Wireless & Wired" },
  },
  {
    catSlug: "accessories",
    name: "Belkin BoostCharge Pro 3-in-1 MagSafe Charger",
    slug: "belkin-boostcharge-pro-3-in-1-magsafe",
    brand: "Belkin",
    description: "Premium fast wireless charging stand designed with official MagSafe 15W charging for iPhone, Apple Watch, and AirPods.",
    price: 13999,
    compareAtPrice: 15999,
    stockQuantity: 15,
    images: [
      "https://images.unsplash.com/photo-1622445262464-84b1456045b6?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["accessories", "belkin", "magsafe", "charger"],
    specifications: { Output: "15W MagSafe Fast Charge", Compatibility: "iPhone, Apple Watch, AirPods", Build: "Stainless Steel" },
  },
  {
    catSlug: "accessories",
    name: "SanDisk Extreme Portable SSD 1TB",
    slug: "sandisk-extreme-portable-ssd-1tb",
    brand: "SanDisk",
    description: "Rugged storage solution with NVMe solid state performance featuring up to 1050MB/s read speeds and IP55 water and dust resistance.",
    price: 8499,
    compareAtPrice: 12999,
    stockQuantity: 40,
    images: [
      "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=800&q=80"
    ],
    isFeatured: false,
    tags: ["accessories", "sandisk", "ssd", "storage"],
    specifications: { Speed: "Up to 1050MB/s", Interface: "USB 3.2 Gen 2 Type-C", Durability: "IP55 Resistance" },
  },
];

async function seed() {
  try {
    await mongoose.connect(uri);
    console.log("Connected to MongoDB Atlas");

    // Clean out dummy Category 1..10 and dummy Product 1..100
    const deletedDummyProducts = await Product.deleteMany({
      $or: [
        { name: /^Product \d+/ },
        { slug: /^product-\d+/ },
        { slug: { $in: productsData.map(p => p.slug) } }
      ]
    });
    console.log(`Cleaned up dummy products: ${deletedDummyProducts.deletedCount}`);

    const deletedDummyCategories = await Category.deleteMany({
      $or: [
        { name: /^Category \d+/ },
        { slug: /^category-\d+/ },
        { slug: { $in: categoriesData.map(c => c.slug) } }
      ]
    });
    console.log(`Cleaned up dummy categories: ${deletedDummyCategories.deletedCount}`);

    // Insert 5 Categories
    const insertedCategories = await Category.insertMany(categoriesData);
    console.log(`Successfully created ${insertedCategories.length} categories:`);
    insertedCategories.forEach(c => console.log(` - ${c.name} (${c.slug})`));

    // Map category slug to ObjectId
    const categoryMap = {};
    for (const c of insertedCategories) {
      categoryMap[c.slug] = c._id;
    }

    // Prepare products with correct categoryId
    const formattedProducts = productsData.map((p, index) => {
      const catId = categoryMap[p.catSlug];
      const sku = `SE-${p.brand.substring(0, 3).toUpperCase()}-${1000 + index}`;
      return {
        name: p.name,
        slug: p.slug,
        description: p.description,
        categoryId: catId,
        brand: p.brand,
        sku,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        stockQuantity: p.stockQuantity,
        images: p.images,
        specifications: p.specifications || {},
        tags: p.tags || [],
        isFeatured: p.isFeatured || false,
        active: true,
        variants: [],
      };
    });

    const insertedProducts = await Product.insertMany(formattedProducts);
    console.log(`Successfully created ${insertedProducts.length} products!`);

    const totalCats = await Category.countDocuments();
    const totalProds = await Product.countDocuments();
    console.log(`Atlas current status: ${totalCats} categories, ${totalProds} products in total.`);
  } catch (err) {
    console.error("Error during seeding:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

seed();
