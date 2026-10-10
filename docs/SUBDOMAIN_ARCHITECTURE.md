# ReachOutOS Subdomain Architecture & Production Deployment Guide

ReachOutOS features a production-grade multi-subdomain routing architecture designed for high availability, enterprise isolation, white-label tenant environments, and separation of marketing from the application engine.

---

## 1. Domain Topology Overview

| Subdomain | Purpose | Target / Route | Description |
| :--- | :--- | :--- | :--- |
| **`reachoutos.com`** | **Marketing & Landing** | Public Web Portal | High-converting landing page, interactive ROI calculator, feature showcase, and signup CTA. |
| **`www.reachoutos.com`** | **Marketing (WWW)** | Canonical Alias | 301 redirects to `reachoutos.com`. |
| **`app.reachoutos.com`** | **Application Workspace** | `/` (Application) | Primary authenticated multi-tenant dashboard, campaign manager, smart inbox, AI copilot, and compliance registry. |
| **`api.reachoutos.com`** | **REST & Webhooks** | `/api/v1` | High-throughput API gateway for inbound WhatsApp/Email webhooks, CRM sync, and external integrations. |
| **`links.reachoutos.com`** | **Branded Shortlinks** | `/l/:slug` | High-speed redirector for click tracking, deliverability preservation, and custom branded shortlinks. |
| **`{tenant}.reachoutos.com`** | **Dedicated Workspaces** | Workspace Isolation | Custom tenant subdomains (e.g. `yarhoney.reachoutos.com`) with automated white-label logos, colors, and tenant scoping. |

---

## 2. Localhost & Development Testing

ReachOutOS includes seamless development support without requiring administrative hosts file edits:

### Method A: One-Click UI Switcher (Recommended)
Use the top **Subdomain Architecture Bar** at the top of the interface:
- Click **`reachoutos.com`** to view the public marketing landing page.
- Click **`app.reachoutos.com`** to immediately enter the application workspace.
- Click **`yarhoney.reachoutos.com`** to experience tenant-scoped white-label branding.

### Method B: Query Parameter Overrides
- Landing Page: `http://localhost:3000/?subdomain=landing`
- App Workspace: `http://localhost:3000/?subdomain=app`
- Tenant Workspace: `http://localhost:3000/?tenant=yarhoney`

### Method C: Browser Hostname Matching
Modern browsers (Chromium, Chrome, Edge, Firefox) natively resolve `*.localhost` to `127.0.0.1`:
- `http://app.localhost:3000`
- `http://api.localhost:3000`
- `http://links.localhost:3000`
- `http://yarhoney.localhost:3000`

---

## 3. Production DNS Configuration (Cloudflare / Namecheap / Route 53)

Configure these DNS records on your domain registrar:

| Type | Name | Content / Target | TTL | Proxy Status |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `@` | Server Public IPv4 (or Vercel `76.76.21.21`) | Auto | Proxied (Orange Cloud) |
| **CNAME** | `www` | `reachoutos.com` | Auto | Proxied |
| **CNAME** | `app` | `cname.vercel-dns.com` (or `@`) | Auto | Proxied |
| **CNAME** | `api` | `api.reachoutos.com` / Server IP | Auto | Proxied |
| **CNAME** | `links` | `links.reachoutos.com` / Server IP | Auto | Proxied |
| **CNAME** | `*` (Wildcard) | `cname.vercel-dns.com` (or `@`) | Auto | Proxied |

> **Wildcard Certificate**: Cloudflare Universal SSL automatically provides a wildcard certificate covering `reachoutos.com` and `*.reachoutos.com`.

---

## 4. Production Nginx Reverse Proxy Configuration

If deploying to a dedicated Linux VPS / EC2 / DigitalOcean Droplet:

```nginx
# 1. API Gateway: api.reachoutos.com
server {
    listen 443 ssl http2;
    server_name api.reachoutos.com;

    ssl_certificate /etc/letsencrypt/live/reachoutos.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reachoutos.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}

# 2. Branded Shortlinks: links.reachoutos.com
server {
    listen 443 ssl http2;
    server_name links.reachoutos.com;

    ssl_certificate /etc/letsencrypt/live/reachoutos.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reachoutos.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

# 3. Wildcard Application & Tenant Workspaces: app.reachoutos.com & *.reachoutos.com
server {
    listen 443 ssl http2;
    server_name app.reachoutos.com *.reachoutos.com;

    ssl_certificate /etc/letsencrypt/live/reachoutos.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reachoutos.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 4. Root Marketing Landing: reachoutos.com
server {
    listen 443 ssl http2;
    server_name reachoutos.com;

    ssl_certificate /etc/letsencrypt/live/reachoutos.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/reachoutos.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
    }
}
```

---

## 5. Single Sign-On (SSO) & Cookie Domain Sharing

For seamless authentication sharing between `app.reachoutos.com` and `{tenant}.reachoutos.com`:
- Set authentication cookie `Domain` to `.reachoutos.com` (prefixed with a dot).
- The `SubdomainRouter.getCookieDomain()` helper automatically computes `.reachoutos.com` in production and `localhost` in local development.
