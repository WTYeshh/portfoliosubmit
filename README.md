# ⚡ PortfolioDrop — Student Submission Portal

> **Single-slide student portfolio & Vercel link collection with hidden Admin Vault and zero database setup.**

---

## 🚀 How to Run

```bash
npm start
# (or: node local-server.js)
```
Open **`http://localhost:3000`** in your browser.

---

## 📋 Collected Fields

Students only submit:
1. **Student Name** (Letters only, automatic UPPERCASE)
2. **USN** (Alphanumeric, automatic UPPERCASE)
3. **Portfolio / Vercel Link** (`https://xyz.vercel.app` with 1-click Vercel preset and clipboard paste)

All submissions are automatically saved to disk in:
- `portfolios.csv` (Ready for Excel & Google Sheets)
- `portfolios.json` (Structured JSON records)

---

## 🔐 Admin Access

The public view **hides** all collected submission links. Only admins can see and export submissions:

1. **How to access**: **Double-click the top-left logo** (`PortfolioDrop`).
2. **Admin Password**: `dsaandcode`
3. **Admin Features**:
   - Live view of all student submissions with Name, USN, and Links.
   - Search/filter in real-time by Name, USN, or URL.
   - 📥 **Export CSV** (Excel / Google Sheets).
   - 💾 **Export JSON**.
   - 📋 **Copy All Links**.
   - 🔒 **Auto-Locks on drawer close** (never persists login session).
