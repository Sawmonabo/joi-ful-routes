# CHANGELOG.md

## [1.0.0-beta.2] - 2025-01-07

### Summary

The `1.0.0-beta.2` release builds on the foundational beta, refining key features such as route autodiscovery, enhanced validation, and Swagger/OpenAPI support. This version also introduces updated configurations and documentation enhancements.

---

### Added

- **Route Autodiscovery**:

  - `RouteSchema.paths` now supports automatic route discovery, reducing boilerplate.
  - Static route definitions are streamlined for better maintainability.

- **Enhanced Swagger Integration**:

  - Improved `schemaToSwagger` generation with private tags and parameters for clearer OpenAPI documentation.
  - Expanded Swagger path components for comprehensive API definitions.

- **Release Drafter Integration**:
  - Added release drafter configuration to automate and standardize release notes generation.

---

### Changed

- **Refactored Documentation**:

  - Updated `README.md` with examples using static route methods.
  - Improved examples for clarity, focusing on developer usability.

- **Refined RouteSchema API**:

  - Made `tags` and `paths` methods private to encapsulate their functionality.

- **Validation Enhancements**:
  - Expanded Joi schemas to support stricter validation for file uploads and request bodies.

---

### Breaking Changes

- **Static Route Methods**:
  - RouteSchema methods (e.g., `getProduct`, `addProduct`) are now accessed as `static get` methods, ensuring consistency and simplifying inheritance.
