import express from 'express'
import request from 'supertest'

import ProductRouter from './routes/product-route.js'

describe('Product API Routes', () => {
  let app

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))
    app.use('/api-v1/product', ProductRouter)
  })

  describe('GET /get', () => {
    it('should return product details for a valid productId', async () => {
      const response = await request(app)
        .get('/api-v1/product/get')
        .query({ productId: '123e4567-e89b-12d3-a456-426614174000' })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        productId: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Sample Product',
        category: 'Electronics',
        price: 199.99,
        stock: 10,
        description: 'A sample product for testing.',
      })
    })

    it('should return 422 for missing productId', async () => {
      const response = await request(app).get('/api-v1/product/get')

      expect(response.status).toBe(422)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /add', () => {
    it('should add a new product and return it', async () => {
      const newProduct = {
        productId: '123e4567-e89b-12d3-a456-426614174001',
        name: 'New Product',
        category: 'Books',
        price: 29.99,
        stock: 50,
        description: 'A new book for testing.',
      }

      const response = await request(app)
        .post('/api-v1/product/add')
        .send(newProduct)

      expect(response.status).toBe(201)
      expect(response.body).toEqual({
        message: 'Product added successfully.',
        product: newProduct,
      })
    })

    it('should return 422 for invalid product data', async () => {
      const invalidProduct = { name: '', price: -10 }

      const response = await request(app)
        .post('/api-v1/product/add')
        .send(invalidProduct)

      expect(response.status).toBe(422)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('PUT /update', () => {
    it('should update an existing product', async () => {
      const updatedProduct = {
        name: 'Updated Product',
        category: 'Home Appliances',
        price: 149.99,
        stock: 20,
        description: 'Updated product details.',
      }

      const response = await request(app)
        .put('/api-v1/product/update')
        .query({ productId: '123e4567-e89b-12d3-a456-426614174000' })
        .send(updatedProduct)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        message: 'Product updated successfully.',
        productId: '123e4567-e89b-12d3-a456-426614174000',
        updatedProduct,
      })
    })

    it('should return 422 for invalid product data', async () => {
      const response = await request(app)
        .put('/api-v1/product/update')
        .query({ productId: 'invalid-id' })
        .send({})

      expect(response.status).toBe(422)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('DELETE /delete', () => {
    it('should delete a product successfully', async () => {
      const response = await request(app)
        .delete('/api-v1/product/delete')
        .query({ productId: '123e4567-e89b-12d3-a456-426614174000' })

      expect(response.status).toBe(204)
    })

    it('should return 422 for invalid productId', async () => {
      const response = await request(app)
        .delete('/api-v1/product/delete')
        .query({ productId: 'invalid-id' })

      expect(response.status).toBe(422)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /upload', () => {
    it('should upload a valid file successfully', async () => {
      const response = await request(app)
        .post('/api-v1/product/upload')
        .attach('file', Buffer.from('Sample File Content'), {
          filename: 'sample.pdf',
          contentType: 'application/pdf',
        })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        message: 'File uploaded successfully. Received file: sample.pdf',
      })
    })

    it('should return 422 for invalid file type', async () => {
      const response = await request(app)
        .post('/api-v1/product/upload')
        .attach('file', Buffer.from('Sample File Content'), {
          filename: 'sample.txt',
          contentType: 'text/plain',
        })

      expect(response.status).toBe(422)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /swagger', () => {
    it('should return Swagger documentation', async () => {
      const response = await request(app).get('/api-v1/product/swagger')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        definition: {
          tags: [
            {
              name: 'ProductInfo',
              description: 'Endpoints for managing Product resources.',
            },
          ],
          paths: {
            '/api-v1/product/get': {
              get: {
                tags: ['ProductInfo'],
                summary: 'Retrieve product details by ID.',
                parameters: [
                  { $ref: '#/components/parameters/RequestIdHeader' },
                  { $ref: '#/components/parameters/ProductIdParam' },
                ],
                responses: {
                  200: {
                    description: 'Product details retrieved successfully.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/ProductMetadataResponse',
                        },
                      },
                    },
                  },
                  400: {
                    description: 'Bad Request - Invalid parameters.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/ValidationErrorResponse',
                        },
                      },
                    },
                  },
                  500: {
                    description: 'Internal server error.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/InternalServerError',
                        },
                      },
                    },
                  },
                },
              },
            },
            '/api-v1/product/add': {
              post: {
                tags: ['ProductInfo'],
                summary: 'Add a new product.',
                parameters: [],
                requestBody: {
                  description: 'Product details for the new product.',
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/ProductMetadataResponse',
                      },
                    },
                  },
                },
                responses: {
                  201: {
                    description: 'Product added successfully.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/ProductAddedResponse',
                        },
                      },
                    },
                  },
                  400: {
                    description: 'Bad Request - Invalid product data.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/ValidationErrorResponse',
                        },
                      },
                    },
                  },
                  500: {
                    description: 'Internal server error.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/InternalServerError',
                        },
                      },
                    },
                  },
                },
              },
            },
            '/api-v1/product/update': {
              put: {
                tags: ['ProductInfo'],
                summary: 'Update product details by ID.',
                parameters: [
                  { $ref: '#/components/parameters/ProductIdParam' },
                ],
                requestBody: {
                  description: 'Updated product details.',
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        $ref: '#/components/schemas/ProductMetadataResponse',
                      },
                    },
                  },
                },
                responses: {
                  200: {
                    description: 'Product updated successfully.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/ProductUpdatedResponse',
                        },
                      },
                    },
                  },
                  400: {
                    description: 'Bad Request - Invalid product data.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/ValidationErrorResponse',
                        },
                      },
                    },
                  },
                  404: {
                    description: 'Not Found - Product does not exist.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/ProductNotFound',
                        },
                      },
                    },
                  },
                  500: {
                    description: 'Internal server error.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/InternalServerError',
                        },
                      },
                    },
                  },
                },
              },
            },
            '/api-v1/product/delete': {
              delete: {
                tags: ['ProductInfo'],
                summary: 'Delete a product by ID.',
                parameters: [
                  { $ref: '#/components/parameters/ProductIdParam' },
                ],
                responses: {
                  204: {
                    description: 'Product deleted successfully.',
                    content: {},
                  },
                  400: {
                    description: 'Bad Request - Invalid product ID.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/ValidationErrorResponse',
                        },
                      },
                    },
                  },
                  404: {
                    description: 'Not Found - Product does not exist.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/ProductNotFound',
                        },
                      },
                    },
                  },
                  500: {
                    description: 'Internal server error.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/InternalServerError',
                        },
                      },
                    },
                  },
                },
              },
            },
            '/api-v1/product/upload': {
              post: {
                tags: ['ProductInfo'],
                summary: 'Upload a file associated with a product.',
                parameters: [
                  { $ref: '#/components/parameters/RequestIdHeader' },
                ],
                requestBody: {
                  description: 'File upload for product information.',
                  required: true,
                  content: {
                    'multipart/form-data': {
                      schema: {
                        $ref: '#/components/schemas/FileUploadSchema',
                      },
                    },
                  },
                },
                responses: {
                  200: {
                    description: 'File uploaded successfully.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/FileUploadResponse',
                        },
                      },
                    },
                  },
                  400: {
                    description: 'Bad Request - Invalid file upload.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/ValidationErrorResponse',
                        },
                      },
                    },
                  },
                  500: {
                    description: 'Internal server error.',
                    content: {
                      'application/json': {
                        schema: {
                          $ref: '#/components/schemas/InternalServerError',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          components: {
            schemas: {
              ProductMetadataResponse: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  name: { type: 'string' },
                  category: { type: 'string' },
                  price: { type: 'number', format: 'float', minimum: 1 },
                  stock: { type: 'integer', minimum: 0 },
                  description: { type: 'string', nullable: true },
                },
                required: ['name', 'category', 'price', 'stock'],
                additionalProperties: false,
              },
              ValidationErrorResponse: {
                type: 'object',
                properties: {
                  error: {
                    type: 'string',
                    description: 'Description of the validation error.',
                  },
                  warning: {
                    type: 'string',
                    description: 'Warning message if applicable.',
                  },
                },
                additionalProperties: false,
              },
              FileUploadSchema: {
                type: 'object',
                properties: {
                  mimetype: {
                    type: 'string',
                    enum: ['image/jpeg', 'image/png', 'application/pdf'],
                  },
                  file: { type: 'string', format: 'binary' },
                },
                required: ['mimetype', 'file'],
                additionalProperties: false,
                description: 'The file to be uploaded and processed.',
              },
              InternalServerError: {
                type: 'object',
                properties: {
                  error: { type: 'string', default: 'Internal Server Error' },
                },
                additionalProperties: false,
              },
              ProductAddedResponse: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    default: 'Product added successfully.',
                  },
                },
                additionalProperties: false,
              },
              ProductUpdatedResponse: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    default: 'Product updated successfully.',
                  },
                },
                additionalProperties: false,
              },
              ProductNotFound: {
                type: 'object',
                properties: {
                  error: { type: 'string', default: 'Product not found.' },
                },
                additionalProperties: false,
              },
              FileUploadResponse: {
                type: 'object',
                properties: {
                  message: {
                    type: 'string',
                    default: 'File uploaded successfully.',
                  },
                },
                additionalProperties: false,
              },
            },
            parameters: {
              RequestIdHeader: {
                name: 'x-request-id',
                in: 'header',
                required: false,
                schema: {
                  type: 'string',
                  format: 'uuid',
                  example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                },
                description: 'Unique identifier for the HTTP request',
              },
              ProductIdParam: {
                name: 'productId',
                in: 'query',
                required: true,
                schema: {
                  type: 'string',
                  format: 'uuid',
                  example: '123e4567-e89b-12d3-a456-426614174000',
                },
                description:
                  'A string that represents a valid UUID for the product',
              },
            },
          },
        },
      })
    })
  })
})
