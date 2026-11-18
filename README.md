# Grenada_MS_VFW_Website
This is a website for the non-profit government post of Grenada MS. I am making this in hopes of helping the local VFW modernize their approach in gaining members and donations. 

## Developers
- Blair Farrell
- Tyler Farrell

## How it works
- **Website:** React + Vite app in `VFW_Websites/`, hosted on Railway.
- **Database, logins, and photo storage:** [Supabase](https://supabase.com) (free plan is plenty).
- **Donations:** a [Zeffy](https://www.zeffy.com) form embedded on the Donations page. Card details go straight to Zeffy and never touch this site.
- **Admin Dashboard:** go to `/admin` (it isn't linked in the menu). Admins can edit the text, lists, and images on every page, and manage events, photos, and membership applications.

If Supabase isn't connected, the site still works and shows its built-in default text.

## One-time setup

### 1. Create the Supabase project
1. Sign up at [supabase.com](https://supabase.com) and create a new project. Save the database password somewhere safe.
2. Open **SQL Editor -> New query**, paste all of `VFW_Websites/supabase/schema.sql`, and click **Run**.
3. Go to **Authentication -> Sign In / Providers** and turn **off** "Allow new users to sign up". Admin accounts are created by hand (step 4), so nobody else can make an account.
4. Go to **Authentication -> URL Configuration**:
   - **Site URL:** `https://vfwgrenada.org`
   - **Redirect URLs:** add `https://vfwgrenada.org/admin` and `http://localhost:5173/admin`

### 2. Add an admin
1. **Authentication -> Users -> Add user -> Create new user.** Enter the person's email and a strong password (12+ characters), and check **Auto Confirm User**.
2. In the **SQL Editor**, run (with their email):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'person@example.com';
   ```
Only accounts on this admin list can change anything, even if they can sign in.

### 3. Connect the website to Supabase
In Supabase, open **Project Settings -> API** and copy the **Project URL** and the **anon / publishable** key.

- **Railway:** open the website service -> **Variables**, and add:
  - `VITE_SUPABASE_URL` = the Project URL
  - `VITE_SUPABASE_ANON_KEY` = the anon key

  Then redeploy.
- **Local development:** copy `VFW_Websites/.env.example` to `VFW_Websites/.env.local` and fill in the same two values.

> Never use the **service_role / secret** key in the website. It bypasses all security rules.

### 4. Turn on application emails
Every new application is emailed to the post, and admins can **Accept**, **Decline**, or **Request Info** from **Admin Dashboard -> Forms**, which emails the applicant at the address on their application. This runs in two Supabase Edge Functions (`VFW_Websites/supabase/functions/`) and sends mail through [Resend](https://resend.com) (free plan: 3,000 emails/month).

1. **Resend:** sign up, go to **Domains -> Add Domain**, enter `vfwgrenada.org`, and add the DNS records it shows at your domain host. Wait for it to say **Verified**. Then go to **API Keys -> Create API Key** and copy it.
2. **Database:** re-run all of `VFW_Websites/supabase/schema.sql` in the SQL Editor. It adds the "Info Requested" status, the private `dd214-documents` storage bucket for uploaded DD-214s, and makes new applications go through the email function.
3. **Deploy the functions** (needs the [Supabase CLI](https://supabase.com/docs/guides/cli)). From `VFW_Websites/`:
   ```sh
   npx supabase login
   npx supabase link --project-ref your-project-id
   npx supabase secrets set RESEND_API_KEY=re_xxx \
     EMAIL_FROM="VFW Post 4488 <applications@vfwgrenada.org>" \
     ADMIN_EMAIL=commander@vfwgrenada.org \
     POST_EMAIL=info@vfwgrenada.org
   npx supabase functions deploy submit-application --no-verify-jwt
   npx supabase functions deploy respond-to-application --no-verify-jwt
   ```
   - `ADMIN_EMAIL`: who gets each new application. Separate several with commas.
   - `POST_EMAIL`: where applicants' replies go.
   - `EMAIL_FROM`: must be on the domain verified in Resend.
4. Submit a test application with your own email, then accept it from the dashboard to check both emails arrive.

The email wording lives in `supabase/functions/respond-to-application/index.ts`. Uploaded DD-214s are never emailed. Admins open them with **Preview** or **Download** on the application, using links that expire after 5 minutes, and deleting an application deletes its DD-214 too. Changing a status with the dropdown on an application does **not** email anyone; only the three buttons do.

### 5. Connect Zeffy
1. In Zeffy, create a donation form, click **Share**, and copy the link.
2. In the Admin Dashboard, go to **Pages -> Donations Page**, paste it into **Zeffy donation form link**, and click **Save**.

## Running locally
```sh
cd VFW_Websites
npm install
npm run dev
```
