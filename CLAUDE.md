# Project rulebook (face/IP)

Personal project. These rules apply to everything done in this folder.

## No company credentials or services

- Never use company-related credentials, accounts, tokens, or identities for anything: GitHub, npm, cloud, APIs, or any other service.
- Use personal accounts and credentials only.
- GitHub: do not use the company GitHub MCP server or any company-authenticated `gh` session. Do not use the company email (employinc.com) for git author/committer identity. Check `git config user.email` and `gh auth status` before any git or GitHub action, and stop if either shows a company identity.
- Do not use the company's Atlassian, Salesforce, Slack, Notion, Microsoft 365, or any other connected company MCP integrations for this project.

## No company npm

- Do not use the company's npm registry, scopes, packages, or tokens.
- Do not read, copy, or write company `.npmrc` settings, `NPM_TOKEN`, or similar env vars. If a project-level `.npmrc` is needed, it must point at the public registry (https://registry.npmjs.org) with no auth.
- Do not install or depend on company-internal (private/scoped) packages.
- Before running any `npm`/`npx`/`yarn`/`pnpm` command, confirm the effective registry is the public one (`npm config get registry`). If it is a company registry, stop and ask.

## Memory stays local to this folder

- Keep all memory and notes for this project in this folder only (this file and any notes files next to it).
- Do not write project memory to `~/.claude/` or any location outside this folder.

## Git and shipping (from global rules)

- Never commit, push, open a PR, merge, or deploy unless explicitly told by name. Leave changes as uncommitted working-tree edits and report the changed files.
