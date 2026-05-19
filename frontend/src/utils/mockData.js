/**
 * Mock data shaped exactly like what the PySpark pipeline will write
 * to Supabase in Phases 6–8. Swapping mocks → real data later will
 * only require changing the data source, not the components.
 */

/* ---------------------------------------------------------------- */
/* DASHBOARD KPIs                                                   */
/* ---------------------------------------------------------------- */
export const KPI_CARDS = [
  {
    key: "revenue",
    label: "Total Revenue",
    value: 1240000,
    change: 12,
    type: "currency",
    icon: "wallet",
    accent: "emerald",
  },
  {
    key: "orders",
    label: "Total Orders",
    value: 14200,
    change: 5,
    type: "number",
    icon: "shopping-bag",
    accent: "blue",
  },
  {
    key: "aov",
    label: "Avg Order Value",
    value: 85,
    change: -2,
    type: "currency",
    icon: "receipt",
    accent: "purple",
  },
  {
    key: "growth",
    label: "Sales Growth",
    value: 24,
    change: 8,
    type: "percent",
    icon: "trending-up",
    accent: "emerald",
  },
];

/* ---------------------------------------------------------------- */
/* REVENUE TREND                                                    */
/* ---------------------------------------------------------------- */
export const REVENUE_TREND_7D = [
  { day: "Mon", revenue: 124000, predicted: 120000 },
  { day: "Tue", revenue: 158000, predicted: 152000 },
  { day: "Wed", revenue: 142000, predicted: 148000 },
  { day: "Thu", revenue: 195000, predicted: 178000 },
  { day: "Fri", revenue: 178000, predicted: 175000 },
  { day: "Sat", revenue: 110000, predicted: 118000 },
  { day: "Sun", revenue: 145000, predicted: 140000 },
];

export const REVENUE_TREND_YEAR = [
  { month: "Jan", actual: 820000, predicted: 800000 },
  { month: "Feb", actual: 910000, predicted: 880000 },
  { month: "Mar", actual: 1010000, predicted: 970000 },
  { month: "Apr", actual: 1180000, predicted: 1100000 },
  { month: "May", actual: 1240000, predicted: 1210000 },
  { month: "Jun", actual: 1395000, predicted: 1340000 },
  { month: "Jul", actual: 1510000, predicted: 1490000 },
  { month: "Aug", actual: 1605000, predicted: 1600000 },
  { month: "Sep", actual: 1745000, predicted: 1710000 },
  { month: "Oct", actual: 1860000, predicted: 1840000 },
  { month: "Nov", actual: 2050000, predicted: 1980000 },
  { month: "Dec", actual: 2400000, predicted: 2280000 },
];

/* ---------------------------------------------------------------- */
/* RECENT ORDERS                                                    */
/* ---------------------------------------------------------------- */
export const RECENT_ORDERS = [
  { id: "ORD-7732", customer: "Alexander West", status: "Delivered", date: "2024-10-24", amount: 1240 },
  { id: "ORD-7731", customer: "Sarah Jenkins", status: "Processing", date: "2024-10-24", amount: 450 },
  { id: "ORD-7730", customer: "Marcus Thorne", status: "Delivered", date: "2024-10-23", amount: 89 },
  { id: "ORD-7729", customer: "Elena Rodriguez", status: "Cancelled", date: "2024-10-23", amount: 2100 },
  { id: "ORD-7728", customer: "Tomas Becker", status: "Delivered", date: "2024-10-22", amount: 540 },
  { id: "ORD-7727", customer: "Priya Naik", status: "Processing", date: "2024-10-22", amount: 318 },
];

/* ---------------------------------------------------------------- */
/* CUSTOMER SEGMENTATION (output of K-Means)                        */
/* ---------------------------------------------------------------- */
export const SEGMENT_DISTRIBUTION = [
  { name: "VIP", value: 42, customers: 1042 },
  { name: "Loyal", value: 28, customers: 694 },
  { name: "At Risk", value: 18, customers: 446 },
  { name: "New", value: 12, customers: 297 },
];

export const CLUSTER_SCATTER = [
  ...Array.from({ length: 35 }, () => ({
    cluster: "VIP",
    frequency: 4 + Math.random() * 4,
    monetary: 250 + Math.random() * 350,
  })),
  ...Array.from({ length: 30 }, () => ({
    cluster: "Loyal",
    frequency: 2 + Math.random() * 3,
    monetary: 120 + Math.random() * 180,
  })),
  ...Array.from({ length: 25 }, () => ({
    cluster: "At Risk",
    frequency: 0.5 + Math.random() * 1.5,
    monetary: 30 + Math.random() * 80,
  })),
  ...Array.from({ length: 20 }, () => ({
    cluster: "New",
    frequency: 1 + Math.random() * 1.5,
    monetary: 40 + Math.random() * 60,
  })),
];

export const SPENDING_BEHAVIOR = [
  { category: "Enterprise SaaS", value: 1200000 },
  { category: "Data Infrastructure", value: 840000 },
  { category: "Consulting Services", value: 420000 },
  { category: "Maintenance", value: 120000 },
];

export const CUSTOMER_TABLE = [
  { id: "VANGUARD-01-SYS", name: "Vanguard Systems", segment: "VIP", ltv: 248400, engagement: "High", churnProb: 4 },
  { id: "NEXUS-GLOBAL-LX", name: "Nexus Logistics", segment: "At Risk", ltv: 112000, engagement: "Low", churnProb: 78 },
  { id: "ALPHA-STR-MEDIA", name: "Alpha Streams", segment: "New", ltv: 45000, engagement: "Medium", churnProb: 21 },
  { id: "HELIX-BIO-LAB", name: "Helix BioLabs", segment: "Loyal", ltv: 165000, engagement: "High", churnProb: 8 },
  { id: "ORION-FINTECH", name: "Orion Fintech", segment: "VIP", ltv: 312000, engagement: "High", churnProb: 3 },
  { id: "ZENITH-RETAIL", name: "Zenith Retail Co.", segment: "At Risk", ltv: 92000, engagement: "Low", churnProb: 65 },
];

/* ---------------------------------------------------------------- */
/* SALES ANALYTICS                                                  */
/* ---------------------------------------------------------------- */
export const CATEGORY_PERFORMANCE = [
  { category: "Electronics", revenue: 842000, margin: 32 },
  { category: "Apparel", revenue: 521000, margin: 48 },
  { category: "Home", revenue: 310000, margin: 25 },
  { category: "Accessories", revenue: 1100000, margin: 18 },
  { category: "Garden", revenue: 82000, margin: 8 },
  { category: "Other", revenue: 15000, margin: 0 },
];

export const CHANNEL_PERFORMANCE = [
  { channel: "Direct Sales", value: 842000, change: 18 },
  { channel: "Amazon Marketplace", value: 621000, change: 24 },
  { channel: "Shopify Store", value: 455000, change: -5 },
  { channel: "B2B Wholesale", value: 312000, change: 12 },
];

/* ---------------------------------------------------------------- */
/* PRODUCT INSIGHTS                                                 */
/* ---------------------------------------------------------------- */
export const TOP_PRODUCTS = [
  { id: "QC-V2", name: "Quantum Core v2", revenue: 2400000, change: 14.2, sentiment: "Strong Buy", tag: "TRENDING" },
  { id: "TS-S", name: "Titanium S-Series", revenue: 1800000, change: 6.1, sentiment: "Resilient", tag: "STABLE" },
  { id: "AM-R", name: "Aurora Mesh Router", revenue: 950000, change: 9.4, sentiment: "Buy", tag: "GROWING" },
  { id: "LC-C", name: "Legacy Cobalt Cable", revenue: 220000, change: -3.2, sentiment: "Watch", tag: "DECLINING" },
];

export const INVENTORY_ALERTS = [
  {
    type: "LOW_STOCK",
    product: "Aurora Mesh Router",
    detail: "AI suggests immediate restock of 250 units to avoid $45k revenue loss.",
    severity: "high",
    eta: "4 days",
  },
  {
    type: "OVERSTOCK",
    product: "Legacy Cobalt Cable",
    detail: "AI recommends 15% promotional discount to clear 800 excess units.",
    severity: "medium",
    eta: "$1.2k/mo holding",
  },
];

/* ---------------------------------------------------------------- */
/* RECOMMENDATIONS (output of ALS Collaborative Filtering)          */
/* ---------------------------------------------------------------- */
export const UPSELL_PAIRS = [
  { a: "Zenith Watch", b: "Audio Pro Headphones", uplift: 84, rate: 42 },
  { a: "Audio Monitors", b: "XLR Cable Kit", uplift: 22.5, rate: 61 },
  { a: "Lumix Camera", b: "ErgoPro Standing Desk", uplift: 95, rate: 28 },
];

export const GROWTH_TAGS = [
  { tag: "VIRAL POTENTIAL", product: "Mechanical Keyboards", note: "Predicted 34% growth in 14 days from social sentiment.", color: "purple" },
  { tag: "SMART STOCK", product: "Solar Chargers", note: "Inventory alert: low stock predicted before seasonal peak.", color: "blue" },
  { tag: "STEADY DEMAND", product: "USB-C Hubs", note: "Stable conversion across all segments.", color: "emerald" },
];

export const CLUSTER_RECOMMENDATIONS = [
  { id: "ErgoPro Standing Desk", price: 549, match: 98 },
  { id: "Lumix S5 II Camera", price: 1999, match: 92 },
  { id: "Smart Hub Max", price: 129, match: 89 },
  { id: "Ultrabook X1 Carbon", price: 1450, match: 85 },
];

/* ---------------------------------------------------------------- */
/* ML MODEL METRICS                                                 */
/* ---------------------------------------------------------------- */
export const MODEL_METRICS = [
  { name: "Accuracy", value: 98.2, change: 0.4, color: "emerald" },
  { name: "Precision", value: 94.8, change: 1.2, color: "emerald" },
  { name: "Recall", value: 91.4, change: -0.3, color: "coral" },
  { name: "F1 Score", value: 93.1, change: 0, color: "blue" },
];

export const ANOMALIES = [
  {
    title: "Unusual Traffic Spike",
    detail: "400% increase in checkout attempts from US-East region. Possible bot attack or viral referral.",
    age: "2 mins ago",
    severity: "high",
  },
  {
    title: "Average Order Value Dip",
    detail: "AOV dropped by $45. Correlation found with recent mobile UI update in checkout flow.",
    age: "45 mins ago",
    severity: "medium",
  },
  {
    title: "Positive Cohort Shift",
    detail: "Q1 cohort showing 15% higher retention than historical baseline. Anomaly score: 2.4σ.",
    age: "3 hours ago",
    severity: "low",
  },
];

/* ---------------------------------------------------------------- */
/* HEATMAP (Hour-of-day × Day-of-week) — for Visualization Center   */
/* ---------------------------------------------------------------- */
export const HEATMAP_DATA = (() => {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const grid = [];
  for (let h = 0; h < 24; h++) {
    for (const d of days) {
      const isPeak = (h >= 10 && h <= 14) || (h >= 19 && h <= 22);
      const base = isPeak ? 0.55 : 0.18;
      const noise = Math.random() * 0.45;
      grid.push({ hour: h, day: d, value: Math.min(1, base + noise) });
    }
  }
  return grid;
})();
