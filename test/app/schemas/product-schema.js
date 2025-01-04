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

  static addProduct() {
    const { ProductMetadataResponse, ValidationErrorResponse } = this.schemas()

    return this.createRoute({
      path: '/api-v1/product/add',
      method: 'post',
      summary: 'Add a new product.',
      body: {
        description: 'Product details for the new product.',
        required: true,
        content: {
          'application/json': {
            schema: ProductMetadataResponse,
          },
        },
      },
      responses: {
        201: {
          description: 'Product added successfully.',
          content: {
            'application/json': {
              schema: Joi.object({
                message: Joi.string().default('Product added successfully.'),
              }).label('ProductAddedResponse'),
            },
          },
        },
        400: {
          description: 'Bad Request - Invalid product data.',
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

  static updateProduct() {
    const { ProductMetadataResponse, ValidationErrorResponse } = this.schemas()
    const { ProductIdParam } = this.parameters()

    return this.createRoute({
      path: '/api-v1/product/update',
      method: 'put',
      summary: 'Update product details by ID.',
      query: ProductIdParam,
      body: {
        description: 'Updated product details.',
        required: true,
        content: {
          'application/json': {
            schema: ProductMetadataResponse,
          },
        },
      },
      responses: {
        200: {
          description: 'Product updated successfully.',
          content: {
            'application/json': {
              schema: Joi.object({
                message: Joi.string().default('Product updated successfully.'),
              }).label('ProductUpdatedResponse'),
            },
          },
        },
        400: {
          description: 'Bad Request - Invalid product data.',
          content: {
            'application/json': {
              schema: ValidationErrorResponse,
            },
          },
        },
        404: {
          description: 'Not Found - Product does not exist.',
          content: {
            'application/json': {
              schema: Joi.object({
                error: Joi.string().default('Product not found.'),
              }).label('ProductNotFound'),
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

  static deleteProduct() {
    const { ValidationErrorResponse } = this.schemas()
    const { ProductIdParam } = this.parameters()

    return this.createRoute({
      path: '/api-v1/product/delete',
      method: 'delete',
      summary: 'Delete a product by ID.',
      query: ProductIdParam,
      responses: {
        204: {
          description: 'Product deleted successfully.',
          content: {},
        },
        400: {
          description: 'Bad Request - Invalid product ID.',
          content: {
            'application/json': {
              schema: ValidationErrorResponse,
            },
          },
        },
        404: {
          description: 'Not Found - Product does not exist.',
          content: {
            'application/json': {
              schema: Joi.object({
                error: Joi.string().default('Product not found.'),
              }).label('ProductNotFound'),
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

  static get paths() {
    const getProductRoute = this.getProduct()
    const addProductRoute = this.addProduct()
    const updateProductRoute = this.updateProduct()
    const deleteProductRoute = this.deleteProduct()
    const uploadFileRoute = this.uploadFile()

    return {
      [getProductRoute.path]: {
        [getProductRoute.method]: getProductRoute,
      },
      [addProductRoute.path]: {
        [addProductRoute.method]: addProductRoute,
      },
      [updateProductRoute.path]: {
        [updateProductRoute.method]: updateProductRoute,
      },
      [deleteProductRoute.path]: {
        [deleteProductRoute.method]: deleteProductRoute,
      },
      [uploadFileRoute.path]: {
        [uploadFileRoute.method]: uploadFileRoute,
      },
    }
  }
}

export default ProductSchema
