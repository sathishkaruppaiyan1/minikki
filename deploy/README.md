# Deploying `dist/` — fixing 404 on refresh

## The cause

This is a single-page app. `/checkout` and `/product/123` are routes React
Router creates **in the browser**; no such files exist on disk.

- Loading the home page works — `index.html` is a real file.
- Pressing **refresh** on `/checkout`, or opening a **shared link**, asks the
  server for a path it cannot find → the server's own 404. The app never runs.

The fix is always the same idea: *any request that is not a real file must
return `index.html` with HTTP 200.* Only the syntax differs per server.

## Pick your server

| Panel / server | Reads `.htaccess`? | What to do |
|---|---|---|
| **CloudPanel** | **No** — Nginx | Edit the vhost → `deploy/cloudpanel-spa.conf` |
| Plain Nginx / VPS / Docker | No | `deploy/nginx-spa.conf` |
| Hostinger hPanel (LiteSpeed) | Yes | Nothing — `.htaccess` ships in `dist/` |
| cPanel / Apache | Yes | Nothing — `.htaccess` ships in `dist/` |
| Netlify | n/a | Nothing — `_redirects` ships in `dist/` |
| Vercel | n/a | Nothing — `vercel.json` at the repo root |

> **CloudPanel is Nginx.** Uploading `.htaccess` there does nothing at all —
> Nginx never reads it. The vhost edit is the only fix.

## Checklist

1. **Build**

   ```bash
   npm run build
   ```

2. **Upload the *contents* of `dist/`** into the document root — not the
   `dist` folder itself. The root must contain `index.html` directly:

   ```
   htdocs/minikki.in/
     ├── index.html      ← must be here, not in a dist/ subfolder
     ├── assets/
     ├── .htaccess
     └── …
   ```

   Make sure your upload includes **dotfiles**; many FTP clients hide
   `.htaccess` by default.

3. **Apply the server config** for your row in the table above.

4. **Verify** — these must all return `200`, not `404`:

   ```bash
   curl -I https://minikki.in/
   curl -I https://minikki.in/checkout
   curl -I https://minikki.in/product/123
   curl -I https://minikki.in/size-chart
   ```

   A `200` on a deep link means the fallback is live. A `404` means the server
   config has not taken effect.

## If you cannot edit the vhost

When the site is a **PHP** site in CloudPanel, Nginx already routes unknown
paths to `index.php`. Dropping this one-line file in the document root then
serves the SPA without touching the vhost:

```php
<?php readfile(__DIR__ . '/index.html');
```

This is a workaround, not a fix — it adds a PHP round trip to every page load.
Prefer the `try_files` change.

## After every redeploy

`index.html` must not be cached. It references content-hashed asset filenames
(`index-5ipAA1xI.js`); a cached copy points at files the new deploy deleted,
and the site loads as a blank white page. Both configs here set
`Cache-Control: no-cache` on `index.html` — keep it that way.

If you hit a white page right after deploying, hard-reload (Ctrl+Shift+R) to
confirm it is caching, then check that header is being sent:

```bash
curl -I https://minikki.in/ | grep -i cache-control
```
