# CHANGELOG.md

## [1.0.0-beta.1] - 2025-01-05

### Summary

The `1.0.0-beta.1` release marks the first beta version, introducing foundational features such as
request validation, Swagger documentation, and file upload support, alongside comprehensive testing
for reliability.

---

### Added

- **Request Validation Middleware**:

  - Introduced middleware for validating API requests using Joi schemas.
  - Provides robust input validation for consistent API behavior.

- **Swagger Documentation**:

  - Integrated automatic OpenAPI documentation generation using `schemaToSwagger`.
  - Ensures seamless developer onboarding and API exploration.

- **File Upload Support**:

  - Added file upload handling with custom validation using Multer.
  - Endpoint `/api-v1/product/upload` now supports secure file uploads.

- **Comprehensive Testing**:
  - Added test suites for:
    - Middleware validation.
    - Schema validation.
    - Swagger documentation generation.

---

### Changed

- **Documentation**:
  - Updated `README.md` with:
    - Examples for using API validation middleware.
    - Steps to integrate file uploads.
