# Contributing

Open an issue before a large architectural change. Keep pull requests focused, include tests for behavior changes, and use Conventional Commit subjects. All commits must pass TypeScript type checking, unit tests, the production build, Python SDK lint/type checks, and container builds.

Security-sensitive changes to canonical signing, quota accounting, sandbox configuration, consensus, or the credit ledger require two maintainers and an explicit threat-model note in the pull request. Never weaken a containment default to make a test pass.
