# Deployment Guide

This document covers the automated deployment pipeline and manual deployment options for StarMock.

## Table of Contents

- [Automated Deployment (CD Pipeline)](#automated-deployment-cd-pipeline)
- [GitHub Pages Setup](#github-pages-setup)
- [Environment Configuration](#environment-configuration)
- [Alternative Deployment Platforms](#alternative-deployment-platforms)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring](#monitoring)

---

## Automated Deployment (CD Pipeline)

### GitHub Pages (Default)

The project is automatically deployed to GitHub Pages when code is pushed to the `main` branch.

**Workflow:** `.github/workflows/deploy.yml`

**Pipeline Stages:**
1. **Build** - Compiles the application, runs tests, generates production bundle
2. **Deploy** - Uploads to GitHub Pages
3. **Health Check** - Verifies deployment success
4. **Notify** - Reports deployment status

**Trigger Methods:**
- **Automatic**: Push to `main` branch
- **Manual**: 
  ```bash
  # Via GitHub UI: Actions → Deploy → Run workflow
  # Or via GitHub CLI:
  gh workflow run deploy.yml
  ```

**Build Artifacts:**
- Stored for 30 days
- Includes build metadata (commit SHA, timestamp, actor)
- Downloadable from Actions tab

---

## GitHub Pages Setup

### Initial Configuration (One-Time)

1. **Enable GitHub Pages:**
   - Go to repository **Settings** → **Pages**
   - Source: **GitHub Actions**
   - Click **Save**

2. **Update Base Path:**
   - The app is configured for `/StarMock/` base path (repository name)
   - Already set in `.env.production`

3. **Verify Deployment:**
   - After first deploy, your site will be available at:
     ```
     https://olwalgeorge.github.io/StarMock/
     ```

4. **Update README with Live URL:**
   ```markdown
   ## 🌐 Live Demo
   [View StarMock Live](https://olwalgeorge.github.io/StarMock/)
   ```

### Permissions

The deploy workflow requires:
- `contents: read` - Read repository code
- `pages: write` - Write to GitHub Pages
- `id-token: write` - Generate deployment token

These are already configured in `deploy.yml`.

---

## Environment Configuration

### Environment Files

```
app/
├── .env.example       # Template with all variables
├── .env.production    # Production settings (committed)
└── .env.local         # Local overrides (gitignored)
```

### Using Environment Variables

**In Code:**
```typescript
// Access environment variables with VITE_ prefix
const apiUrl = import.meta.env.VITE_API_URL
const appName = import.meta.env.VITE_APP_NAME
const isDev = import.meta.env.DEV
const isProd = import.meta.env.PROD
```

**Available by Default:**
- `import.meta.env.MODE` - `development` or `production`
- `import.meta.env.DEV` - Boolean, true in development
- `import.meta.env.PROD` - Boolean, true in production
- `import.meta.env.BASE_URL` - Base path from vite config

### Local Development

1. Copy example file:
   ```bash
   cd app
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your settings

3. Start dev server:
   ```bash
   npm run dev
   ```

### Adding New Variables

1. Add to `.env.example` (documentation)
2. Add to `.env.production` (production value)
3. Use in code with `import.meta.env.VITE_YOUR_VAR`
4. **Important**: Only `VITE_` prefixed variables are exposed to client

---

## Alternative Deployment Platforms

### Vercel

**One-Click Deploy:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd app
vercel --prod
```

**Configuration** (`vercel.json`):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

### Netlify

**Deploy via CLI:**
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy
cd app
netlify deploy --prod --dir=dist
```

**Configuration** (`netlify.toml`):
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Docker Deployment

**Dockerfile** (place in `app/`):
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**Build & Run:**
```bash
docker build -t starmock:latest ./app
docker run -p 8080:80 starmock:latest
```

### Azure Static Web Apps

```bash
# Install Azure Static Web Apps CLI
npm i -g @azure/static-web-apps-cli

# Deploy
cd app
swa deploy --app-location . --output-location dist
```

---

## Rollback Procedures

### Option 1: Revert via Git

```bash
# Find the last working commit
git log --oneline

# Revert to that commit
git revert <commit-sha>
git push origin main

# Deployment will automatically trigger
```

### Option 2: Re-run Previous Workflow

1. Go to **Actions** tab
2. Find successful deployment
3. Click **Re-run all jobs**

### Option 3: Download Previous Artifact

1. Go to **Actions** → Successful deploy run
2. Download `production-build` artifact
3. Manual deploy:
   ```bash
   unzip production-build.zip
   # Upload to hosting platform manually
   ```

### Emergency Rollback

If automated deployment fails:

1. **Disable workflow:**
   ```bash
   # Rename workflow file temporarily
   git mv .github/workflows/deploy.yml .github/workflows/deploy.yml.disabled
   git commit -m "chore: temporarily disable deployment"
   git push
   ```

2. **Deploy manually** using previous build

3. **Investigate and fix** deployment issue

4. **Re-enable workflow**

---

## Monitoring

### Deployment Status

**Check deployment:**
```bash
# Via GitHub CLI
gh run list --workflow=deploy.yml

# View latest run
gh run view --workflow=deploy.yml
```

**View logs:**
```bash
gh run view <run-id> --log
```

### Build Info Endpoint

Every deployment includes build metadata at `/build-info.json`:

```json
{
  "buildTime": "2026-01-27T12:00:00Z",
  "commit": "abc123...",
  "branch": "main",
  "workflow": "123456789",
  "actor": "username"
}
```

**Access it:**
```bash
curl https://olwalgeorge.github.io/StarMock/build-info.json
```

### Health Checks

The pipeline includes automated health checks after deployment. Monitor:

1. **GitHub Actions Summary** - Shows deployment status
2. **Deployment URL** - Verify site loads
3. **Browser Console** - Check for runtime errors
4. **Build Info** - Verify correct version deployed

### Setting Up Monitoring (Optional)

**Add error tracking** (e.g., Sentry):

1. Install Sentry:
   ```bash
   npm install @sentry/react
   ```

2. Configure in `main.tsx`:
   ```typescript
   import * as Sentry from '@sentry/react'
   
   if (import.meta.env.PROD) {
     Sentry.init({
       dsn: import.meta.env.VITE_SENTRY_DSN,
       environment: import.meta.env.MODE,
     })
   }
   ```

3. Add to `.env.production`:
   ```
   VITE_SENTRY_DSN=your_sentry_dsn
   ```

---

## Deployment Checklist

Before deploying to production:

- [ ] All tests passing (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Environment variables configured
- [ ] GitHub Pages enabled in repository settings
- [ ] Base path set correctly in `.env.production`
- [ ] README updated with live URL
- [ ] Deployment workflow permissions granted

---

## Troubleshooting

### Deployment fails with "Permission denied"

**Solution:** Enable GitHub Pages and verify workflow permissions in Settings → Actions.

### Site shows 404 on GitHub Pages

**Solution:** Check base path configuration:
- `.env.production` has `VITE_BASE_PATH=/StarMock/`
- `vite.config.ts` reads `process.env.VITE_BASE_PATH`

### Assets not loading (404 errors)

**Solution:** Base path mismatch. Verify:
```bash
# In browser console:
console.log(import.meta.env.BASE_URL)
# Should be '/StarMock/' not '/'
```

### Build artifacts missing

**Solution:** Check workflow run logs:
```bash
gh run view --workflow=deploy.yml --log | grep -A 10 "Build production bundle"
```

### Deployment stuck on old version

**Solution:** Hard refresh browser cache:
- Chrome/Edge: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
- Firefox: `Ctrl+F5` (Windows) or `Cmd+Shift+R` (Mac)

---

## Security Considerations

- Never commit `.env.local` (gitignored by default)
- Only `VITE_` prefixed variables are exposed to client
- Sensitive keys belong in GitHub Secrets
- Review deployment logs for leaked credentials

**Using Secrets in Deployment:**

1. Add to GitHub Secrets (Settings → Secrets → Actions)
2. Reference in workflow:
   ```yaml
   - name: Build
     env:
       VITE_API_KEY: ${{ secrets.VITE_API_KEY }}
     run: npm run build
   ```

---

## Next Steps

1. **Enable GitHub Pages** (see setup instructions above)
2. **Run first deployment** (push to main or manual trigger)
3. **Verify live site** at deployment URL
4. **Update README** with live demo link
5. **Set up monitoring** (optional but recommended)

For questions or issues, check the [workflow logs](../../actions/workflows/deploy.yml) or open an issue.
