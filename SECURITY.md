# Security Policy

The Repomova project takes the security and integrity of our codebase, infrastructure, and user data seriously. This document outlines our vulnerability reporting policy and guidelines for responsible disclosure.

---

## Supported Versions

Security updates and patches are actively applied to the latest release on the default branch:

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| < 1.0.0 | :white_check_mark: |

---

## Reporting a Vulnerability

**Please DO NOT open a public GitHub issue to report a potential security vulnerability.** Public disclosure puts all users and deployments at risk before a fix can be prepared.

### Preferred Method: GitHub Private Vulnerability Reporting

If Private Vulnerability Reporting is enabled for this repository:
1. Navigate to the [Repomova Security Advisories tab](https://github.com/Elumugam/Repomova/security/advisories).
2. Click **Report a vulnerability**.
3. Fill out the advisory form with detailed reproduction steps, potential impact, and suggested mitigations.

### Direct Email Contact

If GitHub Private Vulnerability Reporting is unavailable, please report security vulnerabilities directly to the maintainer via email:

- **Security Contact**: [elumugamelumugam@gmail.com](mailto:elumugamelumugam@gmail.com)
- **Subject**: `[SECURITY VULNERABILITY] Repomova - <Brief Description>`

### Information to Include in Your Report

To help us validate and triage the issue as quickly as possible, please provide:
- A clear description of the vulnerability.
- Steps to reproduce the issue, including proof-of-concept scripts or payload examples (where applicable).
- The attack scenario and potential severity / impact.
- Affected components (e.g., authentication flow, process runner, environment handling, Supabase client).
- Any proposed mitigations or patch suggestions.

---

## Maintainer Security Configuration Note

Repository administrators should ensure that **Private vulnerability reporting** is enabled on GitHub:
1. Go to repository **Settings** > **Code security and analysis**.
2. Under **Private vulnerability reporting**, click **Enable**.
3. Ensure automated Dependabot alerts and secret scanning are enabled.

---

## Disclosure and Response Timeline

- **Initial Response**: We will acknowledge receipt of your report within 48 to 72 hours.
- **Assessment**: We will confirm the vulnerability and provide an estimated timeline for a fix.
- **Fix & Release**: Once a patch is developed and verified, we will publish a security advisory and release the patch.
- **Credit**: If you wish, we will gladly credit you in the release notes and advisory for responsibly reporting the issue.
