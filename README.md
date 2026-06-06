# Margdarshak Nirnay

Counsellor-facing CAP dashboard for managing MHT-CET students, groups, cutoffs, and final preference lists.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` from `.env.example` and use the same MargDarshak Supabase project as Landing and Khoj.

3. Add `VITE_SUPABASE_SERVICE_KEY` to `.env` for private counsellor admin access.

4. Run `supabase/cap_lists.sql` in the Supabase SQL editor.

5. Start the app:

   ```bash
   npm run dev
   ```

## Admin Login

```text
admin@margdarshak.in
MargAdmin2025
```

This app stores admin login state in `localStorage`.
