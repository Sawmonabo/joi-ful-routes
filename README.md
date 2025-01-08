# Joi-ful Routes

## Overview

Joi-ful Routes is a Node.js library designed to address common challenges in API development by
simplifying request validation and automating Swagger/OpenAPI documentation generation. Developers
often face repetitive and error-prone tasks, such as:

- Writing extensive request validation logic for each endpoint.
- Maintaining consistent validation rules across APIs.
- Keeping documentation up-to-date as the code evolves.

Joi-ful Routes solves these challenges by:

- **Automating** the generation of Swagger documentation based on Joi schemas.
- **Providing Middleware** to validate requests effortlessly.
- **Centralizing Validation Rules** for consistency and maintainability.

With seamless integration for middleware utilities and file upload handling, Joi-ful Routes reduces
development time, minimizes errors, and ensures that your APIs are robust, consistent, and
well-documented.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Example: Product API](#example-product-api)
- [Contribution](#contribution)
- [License](#license)

---

## Features

- **Middleware Validation**: Effortlessly validate API requests using Joi schemas.
- **Swagger Documentation**: Automatically generate OpenAPI documentation from your schemas.
- **File Upload Support**: Integrate file uploads with custom validation.
- **Reusable Schemas**: Centralize and reuse Joi schemas across routes.
- **Customizable**: Supports content-type-specific validation and schema overrides.

---

## Installation

Install Joi-ful Routes using npm:

```bash
npm install joi-ful-routes
```

---

## Usage

Below is an example that illustrates how to use Joi-ful Routes for validating and documenting a
Product API route.

### Example: Product API

```javascript
import express from 'express'
import Joi from 'joi'
import { validateRequest, RouteSchema, schemaToSwagger } from 'joi-ful-routes'
import multer from 'multer'

const upload = multer()

import Joi from 'joi'
import { RouteSchema } from 'joi-ful-routes'

class ProductSchema extends RouteSchema {
  static get tag() {
    return {
      name: 'ProductInfo',
      description: 'Endpoints for managing Product resources.',
    }
  }

  static schemas() {
    return {
      ProductMetadataResponse: Joi.object({
        productId: Joi.string(),
        name: Joi.string().required(),
        category: Joi.string().required(),
        price: Joi.number().positive().required(),
        stock: Joi.number().integer().min(0).required(),
        description: Joi.string().allow(null),
      }),

      ValidationErrorResponse: Joi.object({
        error: Joi.string().description('Description of the validation error.'),
        warning: Joi.string().description('Warning message if applicable.'),
      }),

      FileUploadSchema: Joi.object({
        mimetype: Joi.string()
          .valid('image/jpeg')
          .valid('image/png')
          .valid('application/pdf')
          .required()
          .error(
            new Error(
              'Invalid file type. Only JPEG, PNG, and PDF files are allowed.'
            )
          ),
        file: Joi.binary().required(),
      })
        .required()
        .description('The file to be uploaded and processed.'),
    }
  }

  static parameters() {
    return {
      RequestIdHeader: Joi.object({
        'x-request-id': Joi.string()
          .uuid()
          .optional()
          .description('Unique identifier for the HTTP request')
          .example('f47ac10b-58cc-4372-a567-0e02b2c3d479'),
      }).unknown(true),

      ProductIdParam: Joi.object({
        productId: Joi.string()
          .uuid()
          .description('A string that represents a valid UUID for the product')
          .example('123e4567-e89b-12d3-a456-426614174000')
          .required(),
      }),
    }
  }

  static getProduct() {
    const { ProductMetadataResponse, ValidationErrorResponse } = this.schemas()
    const { RequestIdHeader, ProductIdParam } = this.parameters()

    return this.createRoute({
      path: '/api-v1/product/get',
      method: 'get',
      summary: 'Retrieve product details by ID.',
      headers: RequestIdHeader,
      query: ProductIdParam,
      responses: {
        200: {
          description: 'Product details retrieved successfully.',
          content: {
            'application/json': {
              schema: ProductMetadataResponse,
            },
          },
        },
        400: {
          description: 'Bad Request - Invalid parameters.',
          content: {
            'application/json': {
              schema: ValidationErrorResponse,
            },
          },
        },
        500: {
          description: 'Internal server error.',
          content: {
            'application/json': {
              schema: Joi.object({
                error: Joi.string().default('Internal Server Error'),
              }).label('InternalServerError'),
            },
          },
        },
      },
    })
  }

  static uploadFile() {
    const { FileUploadSchema, ValidationErrorResponse } = this.schemas()
    const { RequestIdHeader } = this.parameters()

    return this.createRoute({
      path: '/api-v1/product/upload',
      method: 'post',
      summary: 'Upload a file associated with a product.',
      headers: RequestIdHeader,
      body: {
        description: 'File upload for product information.',
        required: true,
        content: {
          'multipart/form-data': {
            schema: FileUploadSchema,
          },
        },
      },
      responses: {
        200: {
          description: 'File uploaded successfully.',
          content: {
            'application/json': {
              schema: Joi.object({
                message: Joi.string().default('File uploaded successfully.'),
              }).label('FileUploadResponse'),
            },
          },
        },
        400: {
          description: 'Bad Request - Invalid file upload.',
          content: {
            'application/json': {
              schema: ValidationErrorResponse,
            },
          },
        },
        500: {
          description: 'Internal server error.',
          content: {
            'application/json': {
              schema: Joi.object({
                error: Joi.string().default('Internal Server Error'),
              }).label('InternalServerError'),
            },
          },
        },
      },
    })
  }
}

const app = express()
app.use(express.json())
app.use('/api', validateRequest(ProductSchema.getProduct))
app.post(
  '/api-v1/product/upload',
  upload.single('file'),
  validateRequest(ProductSchema.uploadFile),
  (req, res) => {
    res.status(200).json({
      message: `File uploaded successfully. Received file: ${req.file.originalname}`,
    })
  }
)

const swaggerDoc = schemaToSwagger(ProductSchema)
console.log(JSON.stringify(swaggerDoc, null, 2))

// Start Server
app.listen(3000, () => console.log('Server running on port 3000'))
```

---

## Contribution

Contributions are welcome! To get started:

1. Fork the repository.
2. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature
   ```

3. Make your changes, including tests for any new functionality.
4. Submit a pull request with a detailed description.

Please adhere to the [Contributor Covenant][homepage], version 2.1, available
at <https://www.contributor-covenant.org/version/2/1/code_of_conduct.html>.

[homepage]: https://www.contributor-covenant.org

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## Additional Resources

- [Joi Documentation](https://joi.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [OpenAPI/Swagger Specification](https://swagger.io/specification/)
