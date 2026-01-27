# GitHub Actions Workflows

This directory contains GitHub Actions workflow configurations for automated CI/CD.

## Workflows

### 1. CI Workflow (`ci.yml`)
**Triggers:** All branches on push and pull requests

**Jobs:**
- **Lint and Test**
  - Runs ESLint to check code quality
  - Runs all unit tests with Vitest
  
- **Build**
  - Builds the production bundle
  - Uploads build artifacts (kept for 7 days)

**Badge:**
```markdown
![CI](https://github.com/olwalgeorge/StarMock/workflows/CI/badge.svg)
```

### 2. Test Workflow (`test.yml`)
**Triggers:** Main and develop branches on push and pull requests

**Jobs:**
- **Test Matrix**
  - Tests on Node.js 18.x and 20.x
  - Runs linter
  - Runs all tests
  - Builds the project

**Badge:**
```markdown
![Test](https://github.com/olwalgeorge/StarMock/workflows/Test/badge.svg)
```

### 3. Code Coverage Workflow (`coverage.yml`)
**Triggers:** Main branch on push and pull requests

**Jobs:**
- **Coverage**
  - Runs tests with coverage reports
  - Uploads coverage to Codecov (optional)

**Badge:**
```markdown
![Coverage](https://github.com/olwalgeorge/StarMock/workflows/Code%20Coverage/badge.svg)
```

## Workflow Details

### CI Pipeline Steps
1. ✅ Checkout code
2. ✅ Setup Node.js environment
3. ✅ Install dependencies
4. ✅ Run ESLint
5. ✅ Run tests
6. ✅ Build project
7. ✅ Upload artifacts

### Matrix Testing
The test workflow runs on multiple Node.js versions to ensure compatibility:
- Node.js 18.x (LTS)
- Node.js 20.x (Current)

### Caching
All workflows use npm caching to speed up installations:
```yaml
cache: 'npm'
cache-dependency-path: app/package-lock.json
```

## Adding Status Badges to README

Add these badges to your `README.md`:

```markdown
[![CI](https://github.com/olwalgeorge/StarMock/workflows/CI/badge.svg)](https://github.com/olwalgeorge/StarMock/actions/workflows/ci.yml)
[![Test](https://github.com/olwalgeorge/StarMock/workflows/Test/badge.svg)](https://github.com/olwalgeorge/StarMock/actions/workflows/test.yml)
[![Coverage](https://github.com/olwalgeorge/StarMock/workflows/Code%20Coverage/badge.svg)](https://github.com/olwalgeorge/StarMock/actions/workflows/coverage.yml)
```

## Viewing Workflow Runs

Visit: https://github.com/olwalgeorge/StarMock/actions

## Modifying Workflows

To modify workflow behavior:
1. Edit the `.yml` files in `.github/workflows/`
2. Commit and push changes
3. Workflows will automatically use the new configuration

## Local Testing

Before pushing, test locally:
```bash
cd app
npm run lint   # Check linting
npm test       # Run tests
npm run build  # Build project
```

## Troubleshooting

### Workflow fails on lint
- Run `npm run lint` locally to see issues
- Fix linting errors before pushing

### Workflow fails on tests
- Run `npm test` locally to reproduce
- Check test logs in GitHub Actions

### Workflow fails on build
- Run `npm run build` locally
- Check for TypeScript errors
- Ensure all dependencies are installed

## Best Practices

1. **Always run locally first** - Test changes before pushing
2. **Keep workflows fast** - Use caching and parallel jobs
3. **Monitor failures** - Check failed workflows and fix issues
4. **Update Node versions** - Keep matrix testing current
5. **Review logs** - Check workflow logs for detailed information

---

For more information, see the [GitHub Actions documentation](https://docs.github.com/en/actions).
