# FeedMill ERP - Complete Deployment Guide

## Prerequisites

Before starting, make sure you have:
- [ ] Git installed on your computer
- [ ] GitHub account (free)
- [ ] Render account (free)
- [ ] Vercel account (free)
- [ ] Node.js 18+ installed

---

## Step 1: Push Code to GitHub

If you haven't pushed your code to GitHub yet:

### 1.1 Create a GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click the **+** icon in the top right → "New repository"
3. Fill in:
   - **Repository name**: `feedmill-erp`
   - **Description**: Cattle Feed Manufacturing ERP
   - **Visibility**: Public (or Private if you prefer)
4. Click "Create repository"

### 1.2 Push Your Code

In your terminal, navigate to your project folder and run:

```bash
git init
git add .
git commit -m "Initial commit - FeedMill ERP"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/feedmill-erp.git
git push -u origin main
```

> **Note:** Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2: Create Render PostgreSQL Database

### 2.1 Log in to Render

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click "Sign Up" if you don't have an account
3. Connect with GitHub (recommended)

### 2.2 Create Database

1. Click **"New"** → **"PostgreSQL"**
2. Fill in the form:
   - **Name**: `feedmill-db`
   - **Database**: `feedmill_erp`
   - **User**: `feedmill`
   - **Password**: Create a strong password (e.g., `FeedMill2024!`)
   - **Plan**: Free (leave as default)
3. Click **"Create Database"**
4. Wait 1-2 minutes for it to provision

### 2.3 Get Connection String

1. Once ready, you'll see a **"Internal Database URL"**
2. Copy it (it looks like: `postgres://feedmill:password@host.render.com:5432/feedmill_erp`)
3. **Save this somewhere safe** - you'll need it for the next steps

---

## Step 3: Deploy Backend to Render

### 3.1 Create Web Service

1. In Render dashboard, click **"New"** → **"Web Service"**
2. Select your GitHub repository (`feedmill-erp`)
3. Configure:
   - **Name**: `feedmill-api`
   - **Root Directory**: (leave empty)
   - **Build Command**: `npm install`
   - **Start Command**: `node server/index.js`
   - **Plan**: Free

### 3.2 Add Environment Variables

Scroll down to the "Environment Variables" section and add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | [Paste from Step 2.3] |
| `JWT_SECRET` | [Generate random string - see below] |
| `SESSION_SECRET` | [Generate random string - see below] |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |

#### How to Generate JWT_SECRET:

Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copy the output and paste as `JWT_SECRET` and `SESSION_SECRET`.

### 3.3 Deploy

1. Click **"Create Web Service"**
2. Wait 3-5 minutes for build and deploy
3. Once complete, you'll see a URL like: `https://feedmill-api.onrender.com`
4. **Test it**: Visit `https://feedmill-api.onrender.com/api/health`

---

## Step 4: Deploy Frontend to Vercel

### 4.1 Create Vercel Project

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Select your GitHub repository (`feedmill-erp`)
4. Configure:
   - **Framework Preset**: `Vue.js` (or "Other" if not detected)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 4.2 Add Environment Variables

Add these environment variables:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://feedmill-api.onrender.com/api` |

> **Important:** Replace `feedmill-api` with your actual Render service name.

### 4.3 Deploy

1. Click **"Deploy"**
2. Wait 1-2 minutes
3. You'll get a URL like: `https://feedmill-erp.vercel.app`

---

## Step 5: Final Configuration

### 5.1 Update Render Environment Variables

1. Go back to Render dashboard
2. Click on your `feedmill-api` web service
3. Go to **"Environment"**
4. Update `ALLOWED_ORIGINS` with your actual Vercel URL:
   - Example: `https://feedmill-erp.vercel.app`
5. Click **"Save Changes"**

### 5.2 Test the Application

1. Open your Vercel URL in a browser
2. You should see the login page
3. Login with:
   - **Username**: `admin`
   - **Password**: `admin123`

---

## Important Notes

### First Time Setup

On first login, the system will automatically:
1. Create a tenant schema for your organization
2. Create all necessary tables in PostgreSQL
3. Initialize default settings

### Creating New Tenants

When a new company signs up through `/signup`:
1. A new PostgreSQL schema is created (`tenant_<id>`)
2. All 60+ tables are created in that schema
3. Data is fully isolated from other tenants

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Database connection failed" | Check DATABASE_URL is correct in Render |
| "CORS error" | Update ALLOWED_ORIGINS in Render with your Vercel URL |
| "Page not found" | Check VITE_API_URL ends with `/api` |
| Build failed | Check Node version is 18+ in render.yaml |

---

## Quick Reference

### Important URLs After Deployment

| Service | URL Example |
|---------|-------------|
| Backend API | `https://feedmill-api.onrender.com` |
| Frontend | `https://feedmill-erp.vercel.app` |
| Health Check | `https://feedmill-api.onrender.com/api/health` |

### Default Credentials

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |
| Email | `admin@feedmill.com` |

---

## File Structure Added

```
feedmill-erp/
├── .env.example              # Environment variables template
├── render.yaml               # Render deployment config
├── frontend/
│   └── vercel.json           # Vercel config
├── server/
│   ├── config/
│   │   └── postgres.js       # PostgreSQL connection
│   ├── utils/
│   │   └── schemaManager.js  # Tenant schema management
│   └── utils/
│       └── tenantDb.js       # Updated for PostgreSQL
└── scripts/
    └── setup-postgres.js    # Database setup script
```

---

## Next Steps

After deployment, you can:
- [ ] Configure custom domain (optional)
- [ ] Set up email notifications (optional)
- [ ] Add more users and roles
- [ ] Import initial data (products, suppliers, etc.)

---

**Need Help?** If you encounter any issues, check the logs in Render dashboard or contact support.