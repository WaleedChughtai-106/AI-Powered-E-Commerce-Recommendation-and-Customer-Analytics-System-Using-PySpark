# Quantuma AI — Project Deep Dive
**Every page explained · Data sources mapped · ML concepts demystified**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [How Data Flows: Backend → Database → Frontend](#2-how-data-flows-backend--database--frontend)
3. [Every Page — What It Does & Where Its Data Comes From](#3-every-page--what-it-does--where-its-data-comes-from)
4. [ML & Analytics Concepts Explained Simply](#4-ml--analytics-concepts-explained-simply)
5. [Technology Stack At-a-Glance](#5-technology-stack-at-a-glance)

---

## 1. Project Overview

Quantuma AI is an **enterprise e-commerce analytics platform** built on top of the real-world
[Olist Brazilian E-Commerce dataset](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce)
(~100,000 orders, Sept 2016 – Oct 2018).

The idea: take raw transactional data, run a PySpark + ML pipeline on it, push the results to a
Supabase (PostgreSQL) database, and display everything through a polished React dashboard.

**Three-layer architecture:**

```
Raw CSV files (Olist dataset)
        ↓
  PySpark Pipeline (Python backend)
  ├── Data cleaning & joining
  ├── Feature engineering (RFM scores)
  ├── ML models (K-Means, ALS, sklearn)
  └── Writes results to Supabase
        ↓
  Supabase (PostgreSQL)
  ├── Clean/joined tables
  ├── Analytics view tables
  └── ML result tables
        ↓
  React Frontend (Vite + Tailwind)
  └── Reads from Supabase via JS client
```

---

## 2. How Data Flows: Backend → Database → Frontend

### 2.1 Backend Pipeline Steps

The pipeline is run via `scripts/seed_supabase.py`, which calls each step in order:

| Step | Script | What it does |
|---|---|---|
| 1 | `run_preprocessing.py` | Cleans all 8 raw CSVs, joins them into one wide "master" table, computes RFM features |
| 2 | `run_ml_pipeline.py` | Runs K-Means, ALS, and sales forecasting; writes all results to Supabase |

### 2.2 Supabase Database Tables

After the pipeline runs, these tables/views exist in Supabase:

| Table / View | Written by | What's in it |
|---|---|---|
| `orders` | Preprocessing | Clean order records (status, timestamps, amounts) |
| `customers` | Preprocessing | Customer records with deduplicated IDs |
| `order_items` | Preprocessing | Per-item rows (product, seller, price, freight) |
| `order_payments` | Preprocessing | Payment type + value per order |
| `order_reviews` | Preprocessing | Review scores (1–5) per order |
| `products` | Preprocessing | Product metadata (category, dimensions, weight) |
| `sellers` | Preprocessing | Seller location info |
| `product_category_name_translation` | Preprocessing | Portuguese → English category names |
| `customer_rfm_features` | K-Means step | Each customer's Recency, Frequency, Monetary values + cluster label (VIP/Loyal/New/At Risk) |
| `customer_segments` | K-Means step | Aggregate counts per segment (e.g. "VIP: 1,042 customers") |
| `product_recommendations` | ALS step | Top-K product recommendations per customer_id |
| `product_analytics` | Product analytics | Per-product revenue, units sold, review score, inventory status |
| `category_analytics` | Category analytics | Per-category revenue, review scores |
| `revenue_analytics` | Revenue analytics | Monthly actual revenue + order counts + customer counts |
| `sales_forecasts` | Forecast step | Future daily revenue predictions with confidence bounds |
| `ml_model_runs` | All ML steps | Model name, metric name, metric value, trained_at timestamp |
| `v_kpi_summary` | DB view | Single-row summary: total revenue, orders, avg order value, active customers |

### 2.3 Frontend Service Layer

The frontend never queries Supabase directly from components. It goes through service files:

```
Component
  → useSupabaseQuery(fetchXxx)   ← hook managing loading/error/data state
      → fetchXxx()               ← service function in src/services/
          → supabase.from(table).select(...)  ← Supabase JS client
              → Supabase API (PostgreSQL)
```

---

## 3. Every Page — What It Does & Where Its Data Comes From

---

### 🏠 LandingPage (`/`)

**What it does:**
The public marketing page. Shows the Quantuma AI brand, feature highlights (KPI tracking,
predictive modeling, adaptive themes), and a hero card with a fake revenue chart. Two CTAs:
"Start Free Trial" → `/login` and "View Demo" → `/dashboard`.

**Data source:** None. Completely static — all numbers (like "$2.4M", "88.2% retention") are
hardcoded marketing copy, not live from the database.

**Key behaviour:** No auth required. Anyone can visit this page.

---

### 🔐 LoginPage (`/login`)

**What it does:**
Email + password sign-in form. Also has a "Forgot password?" flow that sends a Supabase password
reset email. If you're already signed in when you land here, it redirects you straight to `/dashboard`.

**Data source:**
- **Supabase Auth** — `signInWithEmail()` calls `supabase.auth.signInWithPassword()`
- `sendPasswordReset()` calls `supabase.auth.resetPasswordForEmail()`
- The redirect destination after login comes from `location.state.from` (set by ProtectedLayout
  when it bounces an unauthenticated user away from a protected route)

---

### ✍️ SignupPage (`/signup`)

**What it does:**
Registration form — full name, email, password. On submit it calls Supabase's sign-up endpoint.
Two outcomes: if email confirmation is ON in Supabase, it shows a "Check your inbox" screen;
if it's OFF, it navigates straight to `/dashboard` with an active session.

**Data source:**
- **Supabase Auth** — `signUpWithEmail()` calls `supabase.auth.signUp()`, and stores `full_name`
  inside `user_metadata` so `getDisplayName()` can retrieve it later on the Settings page.

---

### 🔗 AuthCallbackPage (`/auth/callback`)

**What it does:**
A landing pad that Supabase redirects to after the user clicks an email confirmation link or
completes an OAuth flow. It reads the URL for a `token_hash` parameter (PKCE flow) or an
`access_token` fragment (implicit flow), verifies the token with Supabase, then redirects to
`/dashboard` on success or shows an error message.

**Data source:**
- **Supabase Auth** — `supabase.auth.verifyOtp()` and `supabase.auth.getSession()`
- The token comes from the URL query parameters, not from the database

---

### 📊 DashboardPage (`/dashboard`) — The Hub

**What it does:**
The main overview screen. Shows four KPI cards at the top, then a revenue trend chart (toggle
between 7-day bar chart and 12-month area chart), a Daily Snapshot AI card, a recent orders
table with live search, and a customer segment pie chart.

The date range picker in the Topbar affects this page: when you pick "Last 3 Months" the KPI
cards and the monthly trend chart recalculate from the filtered data.

**Data sources:**

| Section | Service function | Supabase table |
|---|---|---|
| KPI Cards (Revenue, Orders, AOV, Active Customers) | `fetchKpiCards()` | `v_kpi_summary` view |
| Revenue Bar Chart (7-day) | `fetchRevenueLast7Days()` | `revenue_analytics` (last 7 daily rows) |
| Revenue Area Chart (12-month) | `fetchRevenueMonthlyWithForecast()` | `revenue_analytics` joined with `sales_forecasts` |
| Recent Orders table | `fetchRecentOrders(50)` | `orders` joined with `customers` |
| Customer Segments pie | `fetchSegmentDistribution()` | `customer_segments` |

**Key logic:**
When a date filter is active (`nMonths` is set), the KPI values are *re-derived* from the filtered
monthly trend rows rather than the static `v_kpi_summary` view — so if you pick "Last 3 Months"
you see revenue/orders/AOV for just those 3 months.

---

### 👥 CustomerAnalyticsPage (`/customers`)

**What it does:**
Deep-dive into customer behaviour. Four stat cards at top (total customers, VIP share, active
cluster count, at-risk count). Then a scatter plot showing customers plotted by purchase frequency
vs. average order value (coloured by cluster), a spending behaviour bar list, and a full
customer table with search, segment filter, engagement filter, and column visibility toggle.
Also has a CSV export button.

**Data sources:**

| Section | Service function | Supabase table |
|---|---|---|
| Segment stat cards | `fetchSegmentDistribution()` | `customer_segments` |
| Cluster scatter plot | `fetchClusterScatter(500)` | `customer_rfm_features` (random sample of 500 rows) |
| Spending behaviour list | `fetchSpendingBehavior(6)` | `category_analytics` (top 6 by revenue) |
| Customer detail table | `fetchCustomerTable(50)` | `customer_rfm_features` joined with `customer_segments` |

**Key logic:**
The `EngagementBars` component renders a 5-bar signal-strength icon (like mobile bars) coloured
red/blue/green based on the engagement level. The churn probability bar turns red above 50%,
amber between 25–50%, and green below 25%.

---

### 📈 SalesAnalyticsPage (`/sales`)

**What it does:**
Revenue analytics focused on channels and categories. Four stat cards (Total Revenue, AOV,
Total Orders, Active Customers). A monthly revenue area chart with forecast overlay. A payment
channel breakdown list (credit card, boleto, voucher, debit). A category performance section
with two view modes: a card grid (with colour intensity reflecting revenue share) or a horizontal
bar chart. Has region and channel filter dropdowns in the header.

**Data sources:**

| Section | Service function | Supabase table |
|---|---|---|
| Stat cards | `fetchKpiCards()` | `v_kpi_summary` |
| Revenue trend chart | `fetchRevenueMonthlyWithForecast()` | `revenue_analytics` + `sales_forecasts` |
| Payment channels list | `fetchChannelPerformance()` | `order_payments` aggregated by payment_type |
| Category performance | `fetchCategoryPerformance(12)` | `category_analytics` (top 12 categories) |

**Key logic:**
The region/channel filters in the header are "pending" vs "active" — you pick a region and a
channel but only apply them when you click "Apply Filters". This prevents half-filtered states
while the user is still deciding.

---

### 📦 ProductInsightsPage (`/products`)

**What it does:**
Intelligence for the product catalog. Two "hero" cards for the top 2 performing products
(with AI sentiment label), an Inventory Health card showing alert cards for low-stock or overstock
products (with a "View All Predictions" modal). A performance matrix (2D scatter showing revenue
on X and review score on Y), and a Top Catalog list with search.

**Data sources:**

| Section | Service function | Supabase table |
|---|---|---|
| Top performer hero cards | `fetchTopProducts(10)` | `product_analytics` |
| Inventory alerts card | `fetchInventoryAlerts(20)` | `product_analytics` (rows where inventory_status = LOW_STOCK or OVERSTOCK) |
| Performance matrix dots | Same `fetchTopProducts` data | `product_analytics` |
| Top Catalog list | Same `fetchTopProducts` data | `product_analytics` |

**Key logic:**
The `sentimentFromScore()` helper in `productService.js` converts a numeric review score into a
human label: ≥ 4.5 → "Strong Buy", ≥ 4.0 → "Buy", ≥ 3.5 → "Resilient", below → "Watch".
The `tagFromInventory()` helper converts the backend's `inventory_status` string (LOW_STOCK,
OVERSTOCK, IN_STOCK, OUT_OF_STOCK) into display tags like TRENDING, DECLINING, STABLE, GROWING.

---

### ✨ RecommendationPage (`/recommendations`)

**What it does:**
Showcases the ALS recommendation engine. An "engine hero" section showing live precision@10
accuracy. A smart recommendations list showing the top-K products for a random sampled customer
(with a "Sample another customer" button that re-fetches). An affinity categories panel showing
which product categories appear most in recommendations. A product grid view of the same picks.
Three "How it works" explanation cards at the bottom.

**Data sources:**

| Section | Service function | Supabase table |
|---|---|---|
| Recommendations list + grid | `fetchClusterRecommendations(4)` | `product_recommendations` (random customer sample) |
| Affinity categories | `fetchClusterTabs()` | `product_recommendations` (most-recommended categories) |
| Precision@10 headline stat | `fetchModelMetrics()` | `ml_model_runs` (ALS precision_at_k row) |

**Key logic:**
The `nonce` state increments each time "Sample another customer" is clicked. Because `nonce` is
passed to `useSupabaseQuery` as a dependency, the hook re-fires the fetch, and `fetchClusterRecommendations`
picks a random `customer_id` from the table each time — giving a different customer's picks.

---

### 🔬 MLInsightsPage (`/ml-insights`)

**What it does:**
The "engine room" view. Shows all ML model metrics as cards with radial gauge icons. A predictive
revenue forecast chart (12-month area with ±1.96σ confidence band). A "Neural Rationale" sidebar
explaining what each metric means in plain English. K-Means cluster density grid. A model run log
table. A full-screen "Full Model Run Log" modal with a complete table of all `ml_model_runs` rows
and an explanation guide. Has a JSON export button for all insights.

**Data sources:**

| Section | Service function | Supabase table |
|---|---|---|
| Model metric cards + radial gauges | `fetchModelMetrics()` | `ml_model_runs` |
| Revenue forecast area chart | `fetchRevenueMonthlyWithForecast()` | `revenue_analytics` + `sales_forecasts` |
| Predicted total / bounds box | `fetchForecastSummary()` | `sales_forecasts` (latest forecast run) |
| K-Means cluster density grid | `fetchSegmentDistribution()` | `customer_segments` |
| Model run log table | Same `fetchModelMetrics` data | `ml_model_runs` |

**Key logic:**
`projectToPercent()` in `mlInsightsService.js` normalises raw metric values (like silhouette score
0.304, or precision 0.74) into a 0–100 display percentage for the radial gauge. Different metrics
use different normalisation curves — e.g., RMSE is inverted (lower RMSE → higher display %).

---

### 📊 VisualizationCenterPage (`/visualization`)

**What it does:**
A "composable analytics workbench". Has a custom dashboard builder where you can add KPI cards
from a picker (live values pulled from Supabase), toggle preview mode, a revenue trend chart that
responds to region + category + date filters, a shopping activity heatmap (hour-of-day × day-of-week),
a sticky global filters sidebar, and export buttons (CSV, JSON, PDF). The PDF export opens a
formatted print dialog in a new tab.

**Data sources:**

| Section | Service function | Supabase table |
|---|---|---|
| Revenue trend chart | `fetchRevenueMonthlyWithForecast()` | `revenue_analytics` + `sales_forecasts` |
| Activity heatmap | `fetchHeatmap()` — inline function | `orders` table directly (last 5,000 rows, bucketed by hour + day-of-week) |
| Category revenue share (for scaling) | `fetchCategoryPerformance(20)` | `category_analytics` |
| Custom KPI card values | `fetchKpiCards()` + `fetchSegmentDistribution()` | `v_kpi_summary` + `customer_segments` |

**Key logic:**
The region filter doesn't actually re-query the database — it multiplies the revenue values by
a hardcoded `REGION_WEIGHT` constant (e.g., Brazil-Southeast = 0.65 of total). This is an
approximation based on the known Olist geographic distribution. Same for category scaling: it
divides the category's revenue by total revenue to get a fraction, then scales the trend rows.

---

### ⚙️ SettingsPage (`/settings`)

**What it does:**
User account management. Theme picker (dark/light). Account section with avatar (local preview
only — not uploaded to Supabase Storage), read-only email field, live password change using
`supabase.auth.updateUser()`, MFA toggle (UI-only, not wired to Supabase MFA yet), and sign-out.
AI Security Pulse card showing a risk assessment that changes when MFA is toggled.

**Data sources:**

| Section | Source |
|---|---|
| User's display name, initials, avatar URL | `useAuth()` hook → Supabase session user object → `user.user_metadata` |
| Password change | `supabase.auth.updateUser({ password })` — Supabase Auth API |
| Sign out | `supabase.auth.signOut()` |
| Theme state | `ThemeContext` → `localStorage` (`quantuma-theme` key) |

---

## 4. ML & Analytics Concepts Explained Simply

---

### 4.1 RFM Analysis — Who Are Your Best Customers?

**The idea:** Score every customer on three dimensions to rank how valuable they are.

| Letter | What it measures | Example |
|---|---|---|
| **R** — Recency | How recently did they buy? | Bought 3 days ago vs. 18 months ago |
| **F** — Frequency | How often do they buy? | 12 orders vs. 1 order |
| **M** — Monetary | How much have they spent total? | $5,000 lifetime vs. $20 lifetime |

**Real-world analogy:** Imagine a coffee shop. Your best customer is someone who came in yesterday
(high Recency), comes every morning (high Frequency), and always orders the big expensive drink
(high Monetary). That person is your VIP. Someone who came once two years ago and ordered the
cheapest thing is "At Risk" or "New."

**In this project:** `preprocessing/feature_engineering.py` computes these three numbers for every
customer from the Olist orders data. The results (one row per customer_id, with r_score, f_score,
m_score columns) go into `customer_rfm_features` in Supabase. K-Means then uses these numbers to
cluster customers.

---

### 4.2 K-Means Clustering — Grouping Customers Automatically

**The idea:** Given a set of data points (customers described by their RFM scores), find K natural
groups ("clusters") so that customers inside the same group are similar and customers in different
groups are different.

**How it works (step by step):**
1. Pick K = 4 (we want 4 segments: VIP, Loyal, At Risk, New).
2. Randomly place 4 "centroids" (imaginary average customers) in the data space.
3. Assign each real customer to the nearest centroid.
4. Move each centroid to the actual average of its assigned customers.
5. Repeat steps 3–4 until the centroids stop moving.

**Real-world analogy:** Imagine you have a map of a city with 10,000 people's home addresses and
you want to open 4 pizza delivery hubs. K-Means finds the 4 locations that minimise the average
delivery distance for everyone. Customers = people, centroids = pizza hubs, RFM space = map.

**In this project:** `ml_models/kmeans_segmentation.py` runs Spark MLlib's KMeans on the
RFM feature vectors. After training, it maps each cluster number (0, 1, 2, 3) to a human label
(VIP, Loyal, New, At Risk) by looking at which cluster has the highest average Monetary value
(that's VIP), which has the second highest, etc. The labelled results go into `customer_rfm_features`
and the aggregated counts go into `customer_segments`.

**Silhouette Score (how to know if the clustering is good):**
Ranges from -1 to +1. Closer to +1 means customers in the same cluster are very similar to each
other AND very different from customers in other clusters. A score of 0.3 (like this project gets)
is "okay but not excellent" — the customer segments overlap somewhat, which is expected for
e-commerce data where customer behaviour doesn't split into perfectly clean groups.

---

### 4.3 ALS Collaborative Filtering — "Customers Like You Also Bought..."

**The idea:** Predict which products a customer would enjoy based on what similar customers have
bought — without needing to know anything about the products themselves.

**"Collaborative"** means: recommendations come from the collective behaviour of all users, not
from product descriptions or categories.

**"Filtering"** means: we're filtering the huge product catalog down to the handful most relevant
to you.

**How it works (the simple version):**
Imagine a giant table with customers as rows and products as columns. Each cell = 1 if that
customer bought that product, 0 otherwise. This table is almost entirely zeros (most customers
haven't bought most products). ALS fills in the blanks by finding hidden patterns.

```
             Product A  Product B  Product C  Product D
Customer 1:     1          0          1          0        ← bought A and C
Customer 2:     1          1          0          0        ← bought A and B
Customer 3:     0          1          0          ?        ← bought B, should we recommend C?
```

Because Customer 3 bought B (like Customer 2) and Customer 2 also bought A (like Customer 1)
and Customer 1 bought C, the algorithm infers Customer 3 might like C. That's collaborative filtering.

**ALS (Alternating Least Squares)** is the specific mathematical method for filling in the blanks.
It represents every customer and every product as a vector of hidden ("latent") features (16
numbers in this project) and learns these vectors so that customer_vector · product_vector predicts
the purchase probability.

**"Implicit feedback"** — in this dataset, we don't have star ratings for products; we just know
whether someone bought something. So a purchase = weak positive signal (they bought it, probably
liked it). ALS with implicit feedback (the Hu/Koren/Volinsky 2008 formulation used here) handles
this correctly by weighting cells differently based on confidence.

**In this project:** `ml_models/als_recommender.py` runs Spark MLlib's ALS. It builds the customer×product
interaction matrix from `order_items`, trains ALS, then generates the top-10 recommended products
for every customer. These go into `product_recommendations` in Supabase.

**Precision@10 (how to measure if recommendations are good):**
Take the top-10 products the model recommends for a customer. Check how many of those 10 products
the customer actually bought (in a held-out test set). `precision@10 = correct picks / 10`.
A score of 0.74 means 7.4 out of 10 recommendations were products the customer actually bought —
that's quite good for an implicit-feedback recommender on a long-tail catalog.

---

### 4.4 Time-Series Revenue Forecasting — Predicting Future Sales

**The idea:** Given a sequence of past monthly revenue values, predict what revenue will be in
future months.

**Why it's hard:** Revenue is noisy. It spikes around holidays, dips in off-seasons, and has
a general upward (or downward) trend. A simple average would miss all of this.

**Feature engineering for forecasting** — instead of feeding raw dates into a model, this project
creates numerical features that capture time patterns:
- **Lag features:** "What was revenue 1 month ago? 3 months ago? 12 months ago?" — this teaches
  the model about month-over-month momentum and seasonality.
- **Month-of-year:** encoded as a number (Jan=1, Dec=12) to capture seasonal patterns.
- **Day-of-week / rolling averages:** for daily forecasting, smoothed averages reduce noise.

**The model:** `ml_models/sales_forecast.py` uses scikit-learn's `GradientBoostingRegressor` — a
type of decision tree ensemble that learns non-linear relationships between the lag features and
future revenue. It's not a neural network; think of it as "smart curve-fitting."

**In this project:** The model is trained on Olist's historical daily revenue data, then generates
predictions for future dates. Results (date, predicted_revenue, lower_bound, upper_bound) go into
`sales_forecasts`. The ±1.96σ confidence band means "we're 95% confident actual revenue will
land between lower_bound and upper_bound."

**R² score (how good is the forecast?):**
R² = 0.81 means the model explains 81% of the variance in daily revenue. The remaining 19% is
random noise or patterns the model hasn't captured. R² of 1.0 would be a perfect prediction;
R² of 0 means the model is no better than just predicting the average revenue every day.

**RMSE (another accuracy measure):**
Root Mean Squared Error — the average dollar amount the forecast is off by. If RMSE = $1,180, on
average the model's daily prediction is about $1,180 away from the true value.

---

### 4.5 PySpark — Why Not Just Use Pandas?

**The idea:** Pandas loads data into RAM on a single computer. PySpark distributes data across
many CPU cores (or many machines in a real cluster). For 100k rows, Pandas is fine. For 100 million
rows, Pandas runs out of memory; PySpark doesn't.

**In this project:** PySpark is used even though the Olist dataset fits in RAM, because:
1. It demonstrates real-world big-data architecture (the same code scales to production-size data).
2. Spark MLlib (the ML library) provides distributed K-Means and ALS out-of-the-box.
3. DataFrames in PySpark work almost identically to Pandas DataFrames — `df.groupBy().agg()`,
   `df.filter()`, `df.join()` — so the code is still readable.

**SparkSession:** The entry point to all Spark operations. This project uses a singleton
(one shared instance per process) with local mode (`local[*]` = use all CPU cores on the machine).

**AQE (Adaptive Query Execution):** A Spark 3.x optimization that automatically adjusts query
plans at runtime based on actual data statistics — can dramatically speed up joins and aggregations
without any code changes.

---

### 4.6 Supabase & Row-Level Security

**Supabase** is a hosted Postgres database with a REST+WebSocket API layer, built-in authentication
(email/password, OAuth), and a JavaScript client library. Think of it as "Firebase but on PostgreSQL."

**The anon key** (exposed in `.env.local`) is safe to ship to browsers because **Row Level Security
(RLS)** policies in Postgres control what each user can actually read/write — the key alone doesn't
grant access to everything.

**In this project:** The frontend reads analytics tables using the anon key. In production you'd
add RLS policies ensuring users only see their own data. Auth (login/signup) goes through Supabase
Auth which manages JWTs — access tokens auto-refresh before they expire (`autoRefreshToken: true`).

---

### 4.7 React Query Pattern (`useSupabaseQuery`)

Every data fetch in this app uses the `useSupabaseQuery` custom hook, which provides:
- `loading` — true while the fetch is in flight
- `data` — the result rows once loaded
- `error` — any error that occurred
- `refetch()` — call this to retry after an error

This hook also cancels stale requests: if you navigate away from a page before the fetch
completes, the result is discarded rather than updating state on an unmounted component
(preventing the "Can't perform a React state update on an unmounted component" warning).

---

### 4.8 RFM → Cluster Label Mapping (Why "VIP" and not "Cluster 0")

After K-Means runs, the clusters are numbered 0, 1, 2, 3 — but numbers have no meaning.
`_label_clusters()` in `kmeans_segmentation.py` sorts the clusters by their average Monetary score
(descending) and assigns names:
- Rank 1 (highest avg spend) → **VIP**
- Rank 2 → **Loyal**
- Rank 3 → **New** (or At Risk — disambiguated by average Recency; newer = New, older = At Risk)
- Rank 4 (lowest spend) → **At Risk** (or New)

This makes the labels deterministic regardless of which random seed K-Means used.

---

## 5. Technology Stack At-a-Glance

| Layer | Technology | Why |
|---|---|---|
| Data processing | PySpark (Apache Spark via PySpark) | Distributed data processing; scales to big data |
| ML models | Spark MLlib (K-Means, ALS) + scikit-learn (GradientBoosting) | MLlib for large-scale; sklearn for forecasting |
| Database | Supabase (PostgreSQL) | Hosted Postgres + auth + JS client in one |
| Backend language | Python 3.x | Data science ecosystem (PySpark, sklearn, psycopg2) |
| Frontend framework | React 18 + Vite | Fast dev builds; component-based UI |
| Styling | Tailwind CSS + custom CSS variables | Utility-first; consistent dark/light theming |
| Charting | Recharts | SVG-based; integrates naturally with React |
| Routing | React Router v6 | Declarative SPA routing with protected routes |
| Auth | Supabase Auth (email + OAuth) | Built into the database; JWTs auto-managed |
| Dataset | Olist Brazilian E-Commerce (Kaggle) | Real ~100k order transactional dataset |

---

*This document was auto-generated from source code analysis of the Quantuma AI project.*
