# AI-Powered E-Commerce Recommendation & Customer Analytics System

> **University Capstone Project** — A full-stack analytics dashboard built on the Olist Brazilian E-Commerce dataset, combining PySpark MLlib machine learning (ALS + K-Means), scikit-learn revenue forecasting, and a React + Supabase real-time frontend.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Pages & Modules](#pages--modules)
- [Machine Learning Models](#machine-learning-models)
- [Database Schema](#database-schema)
- [Setup & Installation](#setup--installation)
- [Environment Variables](#environment-variables)
- [Running the PySpark Pipeline](#running-the-pyspark-pipeline)
- [Running the Frontend](#running-the-frontend)
- [Date Range Filtering System](#date-range-filtering-system)
- [Dataset](#dataset)
- [Design Decisions](#design-decisions)
- [Glossary](#glossary)

---

## Overview

This project is an end-to-end data analytics and machine learning platform built on the **Olist Brazilian E-Commerce** public dataset (Aug 2016 – Oct 2018). It provides business decision-makers with:

- Real-time **KPI dashboards** (revenue, orders, customers, AOV)
- **Revenue forecasting** with confidence bounds
- **Customer segmentation** via K-Means clustering on RFM features
- **Product recommendations** via ALS collaborative filtering
- **ML model performance monitoring** (silhouette, RMSE, Precision@K, R²)

All data flows from a PySpark + scikit-learn offline pipeline → Supabase (PostgreSQL) → React SPA with Recharts visualisations. The entire frontend is secured behind Supabase email/password authentication.

---

## Key Features

| Feature | Detail |
|---|---|
| **Global Date Range Filter** | Dropdown (Last 7 Days / 30 Days / 3 Months / 6 Months / 12 Months / All Time) — updates every chart, KPI card, and table across all pages simultaneously via React Context |
| **Revenue Dashboard** | Monthly area chart, 4 KPI cards (Revenue, Orders, Customers, AOV), recent-orders table |
| **Sales Analytics** | Channel & category bar charts, revenue trend, Apply Filter (region + channel) |
| **Customer Analytics** | K-Means scatter, RFM heatmap, segment pie chart, CSV export, column-view toggle |
| **Product Insights** | Category revenue chart, ranked product table, "View All Predictions" modal |
| **Visualization Center** | Configurable KPI widget board, global filters, CSV/JSON/PDF export |
| **AI Insights (ML)** | Radial metric cards, forecast chart, cluster grid, Full Model Run Log modal |
| **Recommendations** | ALS per-customer product recommendations with predicted rating & confidence |
| **Settings** | Profile photo picker, password change form, MFA toggle |
| **Auth** | Supabase email/password with PKCE flow and email confirmation callback |

---

## Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| Styling | Tailwind CSS (custom design tokens) |
| Charts | Recharts |
| Auth | Supabase JS Client (PKCE) |
| State | React Context — ThemeContext, AuthContext, DashboardContext |

### Backend / Database

| Layer | Technology |
|---|---|
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (email/password) |
| Views | v_kpi_summary, v_revenue_monthly, v_channel_performance, v_category_performance, v_customer_clusters, v_segment_distribution, v_ml_model_latest |

### ML Pipeline

| Layer | Technology |
|---|---|
| Runtime | Apache PySpark 3.5 |
| Recommendation | MLlib ALS (Alternating Least Squares, implicit feedback) |
| Segmentation | MLlib K-Means on RFM features |
| Forecasting | scikit-learn (RandomForestRegressor + LinearRegression) |
| Data wrangling | PySpark DataFrames, pandas |
| DB writes | psycopg2 (service-role connection, bypasses RLS) |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│               LAYER 1: FRONTEND (Client)                     │
│  React 18 + Vite + Tailwind + Recharts                       │
│  • React Router v6 — 8 protected routes + /login /signup     │
│  • DashboardContext — global date range + search state       │
│  • useSupabaseQuery — generic fetch hook (loading/error)     │
│  • Reads pre-computed analytics views via Supabase JS SDK    │
└────────────────────────┬─────────────────────────────────────┘
                         │  HTTPS / Supabase JS SDK
┌────────────────────────▼─────────────────────────────────────┐
│          LAYER 2: SUPABASE (Backend-as-a-Service)            │
│  PostgreSQL 15: raw Olist tables + analytics aggregates      │
│  11 dashboard views  •  Row Level Security (RLS)             │
│  Supabase Auth: email/password, PKCE, email confirmation     │
└────────────────────────▲─────────────────────────────────────┘
                         │  psycopg2 (service_role key)
┌────────────────────────┴─────────────────────────────────────┐
│        LAYER 3: OFFLINE ML PIPELINE (PySpark + sklearn)      │
│  PySpark 3.5: clean 8 Olist CSVs → join → RFM features      │
│  K-Means segmentation  •  ALS recommendations                │
│  scikit-learn: 30-day revenue forecast with CI bounds        │
│  All results → Supabase analytics tables                     │
└──────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
AI-Powered E-Commerce.../
│
├── frontend/                          # React + Vite SPA
│   ├── src/
│   │   ├── pages/                     # One file per route
│   │   │   ├── DashboardPage.jsx
│   │   │   ├── SalesAnalyticsPage.jsx
│   │   │   ├── CustomerAnalyticsPage.jsx
│   │   │   ├── ProductInsightsPage.jsx
│   │   │   ├── VisualizationCenterPage.jsx
│   │   │   ├── MLInsightsPage.jsx
│   │   │   ├── RecommendationPage.jsx
│   │   │   ├── SettingsPage.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── SignupPage.jsx
│   │   │   └── AuthCallbackPage.jsx
│   │   ├── context/
│   │   │   ├── DashboardContext.jsx   # Global date range + search (DATASET_MAX_DATE)
│   │   │   ├── AuthContext.jsx        # Supabase session management
│   │   │   └── ThemeContext.jsx       # Dark / light mode
│   │   ├── services/
│   │   │   ├── dashboardService.js    # KPI, revenue monthly, orders
│   │   │   ├── mlInsightsService.js   # Model metrics, forecast summary
│   │   │   └── supabaseClient.js      # Supabase JS initialisation
│   │   ├── charts/                    # Recharts wrapper components
│   │   │   ├── RevenueAreaChart.jsx
│   │   │   ├── RevenueBarChart.jsx
│   │   │   ├── CategoryBarChart.jsx
│   │   │   ├── SegmentPieChart.jsx
│   │   │   ├── ClusterScatter.jsx
│   │   │   └── HeatmapGrid.jsx
│   │   ├── layouts/
│   │   │   └── ProtectedLayout.jsx    # Auth guard — redirects to /login if no session
│   │   ├── hooks/
│   │   │   └── useSupabaseQuery.js    # { data, loading, error, refetch }
│   │   ├── App.jsx                    # Route definitions
│   │   └── main.jsx                   # Provider tree entry point
│   ├── public/favicon.svg
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/                           # PySpark + ML pipeline
│   ├── spark_utils/
│   │   ├── spark_session.py
│   │   ├── io_utils.py
│   │   └── db_writer.py              # psycopg2 upsert helper
│   ├── preprocessing/
│   │   ├── clean_*.py                # One cleaner per Olist CSV
│   │   ├── join_datasets.py          # Master fact table
│   │   └── feature_engineering.py   # RFM features per customer
│   ├── ml_models/
│   │   ├── kmeans_segmentation.py   # Spark MLlib K-Means
│   │   ├── als_recommender.py       # Spark MLlib ALS
│   │   └── sales_forecast.py        # scikit-learn forecaster
│   ├── analytics/
│   │   ├── revenue_analytics.py
│   │   ├── customer_analytics.py
│   │   └── product_analytics.py
│   ├── scripts/
│   │   ├── run_preprocessing.py     # Phase 6 CLI orchestrator
│   │   ├── run_ml_pipeline.py       # Phase 7 CLI orchestrator
│   │   └── seed_supabase.py         # One-shot: preprocess + ML + push
│   ├── requirements.txt
│   └── .env.example
│
├── database/
│   ├── schema.sql                   # 15 tables (8 raw Olist + 7 analytics)
│   ├── policies.sql                 # Row Level Security
│   ├── views.sql                    # 11 dashboard views (v_*)
│   └── seed.sql                     # Optional smoke-test seed
│
└── README.md
```

---

## Pages & Modules

### 1. Dashboard (`/dashboard`)
Home page. Shows four KPI cards (Total Revenue, Total Orders, Total Customers, Average Order Value), a 12-month revenue area chart, and a recent-orders table. All values are derived from `v_kpi_summary` and `v_revenue_monthly`. The global date range dropdown slices the monthly array and re-derives KPI totals from the filtered window.

### 2. Sales Analytics (`/sales`)
Channel performance bar chart (credit card, boleto, voucher, debit card) and category performance bar chart, both sourced from their respective views. An Apply Filter panel with region and channel dropdowns adjusts a local filter state. The revenue trend line responds to the global date range.

### 3. Customer Analytics (`/customers`)
K-Means cluster scatter plot (Recency vs. Monetary, colour-coded by segment), an RFM heatmap, and a segment distribution pie chart. Includes an inline search bar (filter by customer/state), an Export CSV button that serialises displayed rows, and a column-view toggle (compact / full-width).

### 4. Product Insights (`/products`)
Top-categories bar chart and a ranked product table showing predicted vs. actual performance. A "View All Predictions" modal opens a full scrollable list of all ML-predicted products sourced from `product_metrics`.

### 5. Visualization Center (`/visualization`)
A configurable KPI widget board. Users add KPI cards through an "Add KPI" modal. A global filters panel (region, category, channel sliders) scales displayed values. The Export panel offers CSV, JSON, and PDF download of the current view. All widgets respond to the global date range.

### 6. AI Insights — ML (`/ml-insights`)
Four radial metric cards: K-Means Silhouette, ALS RMSE, ALS Precision@K, Forecast R² — all read from `v_ml_model_latest`. Revenue forecast area chart (actuals vs. predicted from `sales_forecasts`). Cluster density heatmap from `v_segment_distribution`. The **Predicted Total Revenue** card: shows the ML pipeline's 30-day forecast sum when `sales_forecasts` has rows; otherwise shows a historical estimate (average monthly revenue from the currently selected date window × 1 month), so the card always shows a meaningful value and updates with the dropdown. A "Full Model Run Log" modal shows every row from `ml_model_runs`.

### 7. Recommendations (`/recommendations`)
ALS-generated personalised product recommendations per customer. Search by customer ID or name. Results show product title, category, predicted rating, and confidence score from the `recommendations` table.

### 8. Settings (`/settings`)
Profile section with a file-picker for avatar photos (preview rendered in-browser). Password change form (current → new → confirm) wired to Supabase `updateUser`. MFA toggle with a toast notification.

---

## Machine Learning Models

### ALS Collaborative Filtering (Spark MLlib)

- **Purpose:** Personalised product recommendations for each customer.
- **Input:** Customer–product interaction matrix. Implicit rating = purchase count per `(customer_unique_id, product_id)` pair.
- **Config:** `implicitPrefs=True`, `alpha=40`, 90/10 train/test split, `seed=42`.
- **Output:** Top-10 recommendations per customer → `public.recommendations`.
- **Metrics:** RMSE, Precision@10 → `public.ml_model_runs`.

### K-Means Customer Segmentation (Spark MLlib)

- **Purpose:** Group customers into behavioural segments (VIP / Loyal / At-Risk / New).
- **Input:** RFM features per `customer_unique_id` — Recency (days since last order anchored to `max(order_purchase_timestamp)`), Frequency (order count), Monetary (total spend). Features standardised with `StandardScaler` to prevent monetary from dominating.
- **Config:** `k=4`, `seed=42`.
- **Output:** Cluster labels → `public.customer_segments`.
- **Metrics:** Silhouette score → `public.ml_model_runs`.

> **Why `customer_unique_id`?** Olist assigns a fresh `customer_id` per order. Using `customer_id` would treat every order as a new customer. `customer_unique_id` is the stable person identifier.

### Revenue Forecasting (scikit-learn)

- **Purpose:** 30-day forward revenue projection with upper/lower confidence bounds.
- **Input:** Daily revenue time series from `v_revenue_monthly`. Engineered features: trend, day-of-week, month, lag_1, lag_7, roll_mean_7.
- **Default model:** `RandomForestRegressor`. `--forecast-model linreg` selects `LinearRegression`.
- **Output:** `public.sales_forecasts` (forecast_date, predicted_revenue, lower_bound, upper_bound).
- **Metrics:** RMSE, R² → `public.ml_model_runs`.
- **Confidence bounds:** ±1.96σ of residuals on the holdout set.

All model metrics are written to `ml_model_runs` and surfaced via `v_ml_model_latest` (DISTINCT ON model_name, metric_name — most recent per model).

---

## Database Schema

### Raw Olist Tables

| Table | Description |
|---|---|
| `orders` | All orders with status and timestamps |
| `order_payments` | Payment method, installments, value |
| `order_items` | Line items linking orders to products and sellers |
| `order_reviews` | Customer review scores and comments |
| `products` | Product catalogue with category |
| `customers` | Customer ID, geo location |
| `sellers` | Seller ID, geo location |
| `geolocation` | Postal code lat/lon lookup |

### Analytics Tables (pipeline output)

| Table | Description |
|---|---|
| `customer_segments` | K-Means cluster label per customer |
| `recommendations` | ALS top-10 products per customer |
| `kpi_snapshots` | Daily revenue, orders, customers, AOV |
| `product_metrics` | Per-product revenue, units, review avg |
| `ml_model_runs` | One row per training run (metric_name, metric_value, params, trained_at) |
| `sales_forecasts` | 30-day forward forecast with bounds |

### Dashboard Views (v_*)

| View | Feeds |
|---|---|
| `v_kpi_summary` | Dashboard KPI cards |
| `v_revenue_monthly` | Revenue area charts on all pages |
| `v_channel_performance` | Sales Analytics channel bar chart |
| `v_category_performance` | Sales Analytics & Product category charts |
| `v_customer_clusters` | Customer scatter plot |
| `v_segment_distribution` | Segment pie chart & cluster heatmap |
| `v_ml_model_latest` | AI Insights radial metric cards |

---

## Setup & Installation

### Prerequisites

- **Node.js** ≥ 18, npm ≥ 9
- **Python** 3.10 or 3.11 (PySpark 3.5 does not support 3.12+)
- **Java** 11 or 17 (required by Spark)
- **Apache Spark** 3.5
- A **Supabase** project (free tier is sufficient)
- The 8 **Olist CSV files** placed in `backend/data/raw/`

### 1. Clone the repository

```bash
git clone https://github.com/your-username/ecommerce-analytics.git
cd ecommerce-analytics
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
```

### 3. Configure environment variables

```bash
# Frontend
cp frontend/.env.local.example frontend/.env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

# Pipeline
cp backend/.env.example backend/.env
# Set SUPABASE_DB_URL and SUPABASE_SERVICE_KEY
```

### 4. Set up the Supabase database

Run these SQL files **in order** in your Supabase SQL Editor:

```
1. database/schema.sql     ← 15 tables
2. database/policies.sql   ← RLS policies
3. database/views.sql      ← 11 dashboard views
4. database/seed.sql       ← optional smoke-test seed
```

All four files are idempotent (safe to re-run).

### 5. Install Python dependencies

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

---

## Environment Variables

**`frontend/.env.local`**

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**`backend/.env`**

```env
SUPABASE_DB_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

---

## Running the PySpark Pipeline

```bash
cd backend

# Phase 6 — Clean Olist CSVs → join → RFM features → push raw tables
python -m scripts.run_preprocessing --push-to-db

# Phase 7 — K-Means + ALS + analytics + optional forecast → push analytics tables
python -m scripts.run_ml_pipeline --push-to-db

# One-shot — runs Phase 6 + Phase 7 end-to-end
python -m scripts.seed_supabase

# Optional: skip the forecast step (faster)
python -m scripts.run_ml_pipeline --push-to-db --skip-forecast

# Optional: use linear regression instead of random forest for forecast
python -m scripts.run_ml_pipeline --push-to-db --forecast-model linreg
```

**Typical runtimes on a 2020 laptop:**
- Phase 6: 3–5 minutes (~96k customer_features rows)
- Phase 7: 5–7 minutes (dominated by ALS training)

---

## Running the Frontend

```bash
cd frontend
npm run dev
# → http://localhost:5173
```

**Build for production:**

```bash
npm run build
npm run preview
```

All routes under `/dashboard`, `/customers`, `/sales`, `/products`, `/recommendations`, `/visualization`, `/ml-insights`, `/settings` are protected by `<ProtectedLayout />` and require a valid Supabase session. Unauthenticated visitors are redirected to `/login`.

---

## Date Range Filtering System

The global date range dropdown in the top-bar drives all data across every page simultaneously via `DashboardContext`.

| Dropdown Option | Monthly slices shown (`nMonths`) | Days back from dataset ceiling |
|---|---|---|
| Last 7 Days | 1 | 7 |
| Last 30 Days | 2 | 30 |
| Last 3 Months | 3 | 90 |
| Last 6 Months | 6 | 180 |
| Last 12 Months | 12 | 365 |
| All Time | All data | — |

**Implementation notes:**

- `DATASET_MAX_DATE = "2018-10-17"` — the Olist dataset ceiling. All bounds are computed relative to this constant, not `new Date()`, so ranges remain meaningful against historical data.
- Monthly chart data is filtered with `data.slice(-nMonths)` on the pre-sorted `v_revenue_monthly` array — format-agnostic and crash-proof.
- KPI cards (Revenue, Orders, Customers, AOV) are re-derived by summing/averaging `filteredTrend` rows, so they always match the chart window.
- If the optional `sales_forecasts` table is absent or empty, the AI Insights page falls back to a `historicalEstimate` computed from `filteredTrend`, ensuring the Predicted Revenue card always shows a value that responds to the dropdown.

---

## Dataset

**Olist Brazilian E-Commerce Public Dataset**

- **Source:** [Kaggle — olistbr/brazilian-ecommerce](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce)
- **Period:** August 2016 – October 2018
- **Scale:** ~100,000 orders · ~32,000 products · ~99,000 customers · 8 relational CSV files
- **License:** CC BY-NC-SA 4.0

Download the 8 CSVs and place them in `backend/data/raw/`.

---

## Design Decisions

| Decision | Reason |
|---|---|
| **PySpark over pandas** | Demonstrates distributed in-memory processing — core of the Big Data course rubric. Olist is also large enough to motivate it (~100k orders across 8 joined tables). |
| **Supabase over custom REST API** | Shifts focus to analytics and ML rather than auth boilerplate. PostgreSQL is production-grade; RLS provides real security. |
| **Offline ML pipeline** | Spark runs on the local machine, writes results to Postgres, and React reads pre-computed views. This mirrors how real analytics platforms (Shopify, Stripe) actually operate. |
| **RFM → K-Means** | Small, well-behaved, interpretable 3D feature space. A centroid with low recency + high monetary is naturally "VIP" without any label engineering. |
| **Recency anchored to `max(purchase_timestamp)`** | The dataset ends in 2018. Using `now()` would place every customer at 2400+ days recency and collapse all K-Means clusters. |
| **`customer_unique_id` not `customer_id`** | Olist issues a fresh `customer_id` per order. Segmenting on `customer_id` treats every purchase as a new customer. |
| **One view per chart** | `views.sql` defines an aggregation view for every Recharts component. Frontend stays thin; SQL and UI can evolve independently. |
| **`spark_utils/` not `pyspark/`** | A folder named `pyspark/` collides with the `pyspark` library on the Python import path. |
| **psycopg2 default; JDBC documented** | `df.write.jdbc(...)` requires the Postgres JDBC JAR on the Spark classpath — painful on Windows. psycopg2 just works. |
| **`data.slice(-nMonths)` for date filtering** | ISO date string comparison (`"2018-09-01" >= "2018-09-17"` is false) silently drops records at the boundary month. Array slicing on a pre-sorted list is always correct and format-agnostic. |

---

## Glossary

| Term | Meaning |
|---|---|
| **ALS** | Alternating Least Squares — Spark MLlib's matrix-factorisation collaborative filtering algorithm |
| **RFM** | Recency, Frequency, Monetary — a classic customer-analytics framework that produces three numeric features per customer |
| **K-Means** | Centroid-based clustering algorithm that assigns each customer to the nearest of k cluster centres |
| **Silhouette** | K-Means quality metric in [-1, 1]; higher is better (tighter, more separated clusters) |
| **Precision@K** | Fraction of the top-K recommended items that are relevant (actually purchased) |
| **RMSE** | Root Mean Squared Error — lower is better |
| **R²** | Coefficient of determination — proportion of variance explained by the forecast model; 1.0 is perfect |
| **RLS** | Row Level Security — Postgres feature that enforces auth at the SQL layer |
| **PKCE** | Proof Key for Code Exchange — OAuth 2.0 extension used by Supabase for secure browser-side auth |
| **Olist** | Brazilian e-commerce marketplace whose anonymised 2016–2018 order data is the public dataset used here |
| **DXA** | Twip unit used by the OOXML spec (1 inch = 1440 DXA), relevant to Word document generation |

---

## Sources

- Olist dataset: <https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce>
- Supabase docs: <https://supabase.com/docs>
- PySpark 3.5: <https://spark.apache.org/docs/3.5.1/api/python/>
- Spark MLlib K-Means: <https://spark.apache.org/docs/3.5.1/ml-clustering.html>
- Spark MLlib ALS: <https://spark.apache.org/docs/3.5.1/ml-collaborative-filtering.html>
- scikit-learn: <https://scikit-learn.org/stable/>
- Recharts: <https://recharts.org>
- React Router v6: <https://reactrouter.com>

---

*Built as a university capstone project demonstrating end-to-end data engineering, machine learning, and full-stack web development.*