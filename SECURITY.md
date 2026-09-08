# Security Policy

## Reporting a Vulnerability

Typejoy is a client-side browser framework — it ships no server code, handles no
user accounts, and stores nothing beyond the current game session. Most security
concerns are therefore low-severity (a malicious plugin is trusted code by design).

Still, if you find a genuine vulnerability, we'd appreciate a heads-up before a
public disclosure:

- **Do NOT open a public issue** for a confirmed exploit.
- Email the maintainers via the address in the latest commit or open a
  **private vulnerability report** through GitHub's Security tab:
  `https://github.com/ahrazzle/typejoy/security/advisories/new`

### What we ask you to include

- Affected version / commit hash
- A minimal reproduction (steps or a tiny HTML/JS snippet)
- Impact — what an attacker could actually do
- Suggested fix, if you have one

### Our promise

We aim to acknowledge within 48 hours and triage within one week. We will not
take legal action against researchers acting in good faith.

## Trust Model

- **Plugins are trusted code.** A `GamePlugin` gets full access to the feedback
  layer and canvas. If you load third-party plugins, you are running their code —
  only install plugins you trust.
- **No telemetry.** The framework phones home nowhere. Content you type never
  leaves the browser.
