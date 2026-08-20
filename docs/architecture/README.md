# Architecture Model

The LikeC4 model is executable documentation of SlopStop's process, package, persistence, provider, and telemetry boundaries.

Validate it with:

```text
pnpm check:architecture
```

The model is descriptive, while dependency-cruiser enforces source import direction. Both checks are required because runtime relationships such as utility-process launch and optional Sentry reporting are not ordinary TypeScript imports.
