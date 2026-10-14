# Contributing to Repomova

Thank you for your interest in contributing to Repomova! Repomova is an open-source platform designed to unify multiple repositories, frameworks, and runtimes into a single, intuitive workspace.

We welcome contributions from developers of all skill levels—whether you are fixing a typo, improving documentation, reporting a bug, or submitting a new feature.

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing to ensure a welcoming and inclusive community for everyone.

---

## Ways to Contribute

There are many ways to contribute to Repomova:

1. **Reporting Bugs**: Help us identify defects or unexpected behavior.
2. **Suggesting Enhancements**: Share ideas for new features or usability improvements.
3. **Improving Documentation**: Fix typos, clarify setup guides, or add practical examples.
4. **Submitting Pull Requests**: Implement bug fixes, performance optimizations, or new capabilities.

---

## Reporting Issues

### Checking Existing Issues

Before opening a new issue, please use the [GitHub Issue Search](https://github.com/Elumugam/Repomova/issues) to check whether the problem or request has already been reported. If a relevant issue exists, please add your thoughts or reaction there instead of creating a duplicate.

### Bug Reports

When reporting a bug, please use the [Bug Report Template](https://github.com/Elumugam/Repomova/issues/new?template=bug_report.yml) and provide:
- A clear, descriptive title.
- Step-by-step instructions to reproduce the behavior.
- Expected behavior vs. actual behavior.
- Relevant screenshots or console error traces.
- Your environment details (Operating System, Node.js version, browser).
- **Security Reminder**: Never include private tokens, Supabase service keys, passwords, or personal credentials in issue reports.

### Feature Requests

For feature ideas, please use the [Feature Request Template](https://github.com/Elumugam/Repomova/issues/new?template=feature_request.yml) and explain:
- The problem you are trying to solve.
- Your proposed solution or workflow.
- Any alternatives or workarounds you considered.
- Additional context, wireframes, or references.

### Discussing Large Changes

If you plan to propose a substantial architecture change, add a new runtime adapter, or make major UI changes, please open an issue first to discuss the design with maintainers before investing significant time in implementation.

---

## Development Workflow

### Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS recommended; tested on Node 22)
- **Package Manager**: `npm` (v10+ bundled with Node)
- **Git**: Installed and configured on your system

### 1. Fork and Clone

1. Fork the repository on GitHub: [https://github.com/Elumugam/Repomova](https://github.com/Elumugam/Repomova)
2. Clone your personal fork locally:
   ```bash
   git clone https://github.com/<your-username>/Repomova.git
   cd Repomova
   ```
3. Set up the upstream remote:
   ```bash
   git remote add upstream https://github.com/Elumugam/Repomova.git
   ```

### 2. Create a Feature Branch

Create a dedicated branch for your work branching off `main`:
```bash
git checkout -b feat/your-feature-name
```
Use descriptive branch naming conventions:
- `feat/feature-name` for new features
- `fix/bug-description` for bug fixes
- `docs/documentation-update` for documentation changes
- `refactor/clean-up` for code refactoring

### 3. Install Dependencies

Install project dependencies using `npm`:
```bash
npm install
```

### 4. Configure Environment Variables

1. Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
   *(On Windows PowerShell: `Copy-Item .env.example .env`)*

2. Open `.env` and fill in your Supabase credentials if you wish to test cloud persistence. If left with default placeholders, Repomova automatically runs in offline/local demo mode using local filesystem storage.

### 5. Run the Local Development Server

Start the Vite development server with Hot Module Replacement (HMR):
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## Verification & Quality Checks

Before submitting a pull request, ensure all linting, type checks, and automated tests pass.

### Available Scripts

Repomova uses Oxlint for fast static analysis, TypeScript for compile-time safety, and Vitest with React Testing Library for unit and integration testing.

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Vite local development server at `http://localhost:5173` |
| `npm run lint` | Runs Oxlint across source files |
| `npm run test` | Runs the test suite via Vitest |
| `npm run build` | Runs TypeScript compilation (`tsc -b`) and Vite production bundle |
| `npm run preview` | Previews the production build locally |

### Running Checks

1. **Linting**:
   ```bash
   npm run lint
   ```
   Ensure 0 errors and 0 warnings are produced.

2. **Testing**:
   ```bash
   npm run test
   ```
   Ensure tests pass. If you add new functionality, please add corresponding unit or component tests in `src/test/`.

3. **Type Checking and Production Build**:
   ```bash
   npm run build
   ```
   Verify that TypeScript produces no type errors and Vite bundles the client assets successfully into `dist/`.

---

## Coding and Contribution Standards

- **Strict Scope**: Keep changes focused on the problem at hand. Avoid unrelated formatting, refactoring, or re-styling in the same PR.
- **Maintain Documentation Integrity**: Preserve existing comments, docstrings, and architectural conventions.
- **No Secrets**: Never commit real API keys, Supabase service role keys, tokens, or personal configuration files. Ensure `.env` is never staged (`git status`).
- **UI Changes**: If your pull request introduces or modifies UI components, include genuine before/after screenshots or an animated GIF in the pull request description.
- **Commit Messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
  - `feat(scope): concise description of feature`
  - `fix(scope): concise description of bug fix`
  - `docs(scope): documentation update`
  - `test(scope): test coverage improvements`
  - `chore(scope): build, dependency, or configuration updates`

---

## Submitting Pull Requests

1. Commit your changes:
   ```bash
   git add <modified-files>
   git commit -m "feat(workspace): add multi-window tab support"
   ```
2. Push the branch to your GitHub fork:
   ```bash
   git push origin feat/your-feature-name
   ```
3. Open a Pull Request:
   - Navigate to the [Repomova repository](https://github.com/Elumugam/Repomova).
   - Click **Compare & pull request**.
   - Complete the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).
   - Link any related issue numbers (e.g., `Fixes #42` or `Closes #15`).

---

## Review and Merge Process

- **Automated CI**: GitHub Actions runs automated lint checks, TypeScript verification, and build validation on every pull request.
- **Maintainer Review**: A maintainer will review your pull request for code quality, architectural consistency, and security.
- **Feedback & Revisions**: If changes are requested, commit the updates to your branch and push them; the pull request will update automatically.
- **Merging**: Once approved and all checks have passed, a maintainer will merge your contribution.
