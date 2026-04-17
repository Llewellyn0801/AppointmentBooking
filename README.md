# 🍎 Parent-Teacher Booking System 🚀

Welcome to the **Parent-Teacher Booking System**! Built for speed, concurrency, and style. 

Ever had that moment where two parents click "Book" on the exact same 3:00 PM Tuesday time slot? Chaos ensues. But not here! This app elegantly solves the notorious **Double-Booking Problem** using a Serverless BaaS architecture combined with rock-solid atomic PostgreSQL queries. 

## ✨ Features
- 🛡️ **Mathematically Perfect Concurrency:** Powered by Supabase, the app uses an atomic SQL `UPDATE` to physically guarantee that only one person wins the race. No double booking anywhere!
- ⚡ **Real-time Magic:** Watch slots disappear the *millisecond* someone else claims them, powered by Supabase Realtime WebSockets.
- 📱 **Mobile-First Glassmorphism UI:** Because teachers and parents both deserve beautiful tools that just work on their phones.
- 🚫 **Zero Backend Servers:** We threw away the middleman. We use React directly talking to PostgreSQL via Row Level Security (RLS) rules!

---

## 🛠️ Tech Stack & Architecture
* **Frontend:** React (Bootstrapped with Vite)
* **Design:** Custom Vanilla CSS (Modern aesthetic using flex grids, gradients, and blurs)
* **Backend BaaS:** Supabase
* **Database:** PostgreSQL (Cloud-hosted)
* **Deployment:** Pre-configured for GitHub Pages static artifact pushes!

---

## 🏎️ How Concurrency Safety Works Under the Hood
To avoid explicit transaction deadlocks while maintaining an instant user-experience, we skip traditional REST APIs. The React frontend directly calls a secure PostgreSQL `FUNCTION` running on Supabase:

```sql
  UPDATE public.slots
  SET booked_by = parent_name, 
      booked_at = NOW()
  WHERE id = target_slot_id AND booked_by IS NULL
```

If multiple requests hit the server at the exact same millisecond, PostgreSQL inherently queues them. The first request mutates `booked_by` from `NULL` to a name. The second request checks `WHERE booked_by IS NULL`, notices the row is now locked and modified, and predictably updates **0 rows**. 

Our backend treats a 0-row update organically as a `409 Conflict`, firing back the error *"Slot already taken!"* while the real-time websocket instantly updates all connected screens turning the card Red! 🛑

---

## 🚀 Quick Setup Guide

### 1. The Supabase Cloud
1. Create a free account and project at [Supabase](https://supabase.com/).
2. Jump into your **SQL Editor** on the dashboard.
3. Paste and run the entire contents of the `supabase_setup.sql` file provided in this repository. 
   *(This creates your table, applies the strict Security Policies, and injects the Atomic function!).*

### 2. The Local Engine
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   npm install
   ```
2. Copy the example environment variables:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and fill in your Supabase `URL` and `Anon Key` (found in your Supabase Project Settings).
4. **Boot it up!**
   ```bash
   npm run dev
   ```

### 3. Deploy to the World 🌐
This app is ready for GitHub pages:
1. Double check `frontend/vite.config.js` has `base: './'` (or your repository base path).
2. Inside `/frontend`, just run:
   ```bash
   npm run deploy
   ```
   *(Assuming you configured the package.json scripts with gh-pages)*

---

### 🎉 Enjoy!
Grab an apple, sit back, and let the parents book their meetings without any scheduling conflicts. Happy organizing!
