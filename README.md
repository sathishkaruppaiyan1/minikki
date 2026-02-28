# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

### Deploy `dist` to your own server (Apache, Nginx, etc.)

1. Build: `npm run build` → output in `dist/`
2. Upload the **entire `dist`** folder (or its contents) to your server’s document root.

**Fix 404 on refresh** (e.g. opening or refreshing `/about-us`, `/product/123`): the server must serve `index.html` for those paths so the SPA can handle routing.

- **CloudPanel (VPS)**  
  1. Upload the **contents** of `dist/` (e.g. `index.html`, `assets/`, `logo.webp`, …) into the site’s document root (e.g. `…/htdocs/yourdomain.com/public`).  
  2. In CloudPanel: **Sites** → your site → **Vhost**.  
  3. In the Nginx config, find the `location / { ... }` block.  
  4. Inside it, add or replace with: `try_files $uri $uri/ /index.html;`  
  5. **Save**. CloudPanel will check the config and reload Nginx.  
  See: `deploy/cloudpanel-spa.conf`

- **Apache** (cPanel, shared hosting): `dist` already includes `public/.htaccess` → `dist/.htaccess`. Ensure `mod_rewrite` is enabled.

- **Nginx** (manual): in your `server { }` block, add:
  ```nginx
  location / {
    root /path/to/your/dist;
    try_files $uri $uri/ /index.html;
  }
  ```
  Example: `deploy/nginx-spa.conf`

- **Netlify**: `public/_redirects` is copied to `dist`. Set Publish directory to `dist`.

- **Vercel**: `vercel.json` in the project root configures rewrites.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
