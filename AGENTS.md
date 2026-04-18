# Agent Guidelines

## Commit Messages

- Do NOT add `Co-Authored-By: Claude` or any AI attribution to commit messages.
- Write commit messages in Japanese.

## Dependencies

- After running `pnpm install`, always run `pnpm audit` and resolve any vulnerabilities before proceeding.
- If `pnpm audit` outputs any WARN or higher (deprecated subdependencies, moderate/high/critical vulnerabilities), report the details to the user and confirm whether action is required before proceeding.
