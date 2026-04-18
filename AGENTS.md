# Agent Guidelines

## Commit Messages

- Do NOT add `Co-Authored-By: Claude` or any AI attribution to commit messages.
- Write commit messages in Japanese.

## Testing

- Before committing, always run `pnpm test` and ensure all tests pass.

## Git

- Before pushing, always run `git pull --rebase` to incorporate the latest `articles.json` commit from GitHub Actions.

## Dependencies

- After running `pnpm install`, always run `pnpm audit` and resolve any vulnerabilities before proceeding.
- If `pnpm audit` outputs any WARN or higher (deprecated subdependencies, moderate/high/critical vulnerabilities), report the details to the user and confirm whether action is required before proceeding.
