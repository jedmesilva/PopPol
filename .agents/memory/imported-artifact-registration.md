---
name: Imported artifact registration
description: Imported projects may have artifact.toml files and runnable workflows without appearing in the artifact registry used by preview tooling.
---

Imported projects can contain valid artifact metadata while the artifact registry is empty. In that state, manually configured workflows can still serve the app and proxy checks can validate HTTP responses, but artifact-based screenshot/presentation tooling may report that the artifact does not exist.

**Why:** The imported files and runtime workflow state are not always registered together during project import.

**How to apply:** Prefer the existing artifact metadata and managed service commands; if the registry is empty, verify through workflow logs and the shared proxy rather than assuming the app is broken.