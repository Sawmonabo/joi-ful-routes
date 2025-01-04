import express from 'express'
import request from 'supertest'

import ProductRouter from './routes/product-route.js'

describe('Product API Routes', () => {
  let app

  beforeAll(() => {
    app = express()
    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))
    app.use('/api-v2/productinfo', ProductRouter)
  })

  describe('GET /get', () => {
    it('should return product details for a valid productId', async () => {
      const response = await request(app)
        .get('/api-v2/productinfo/get')
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
      const response = await request(app).get('/api-v2/productinfo/get')

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
        .post('/api-v2/productinfo/add')
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
        .post('/api-v2/productinfo/add')
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
        .put('/api-v2/productinfo/update')
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
        .put('/api-v2/productinfo/update')
        .query({ productId: 'invalid-id' })
        .send({})

      expect(response.status).toBe(422)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('DELETE /delete', () => {
    it('should delete a product successfully', async () => {
      const response = await request(app)
        .delete('/api-v2/productinfo/delete')
        .query({ productId: '123e4567-e89b-12d3-a456-426614174000' })

      expect(response.status).toBe(204)
    })

    it('should return 422 for invalid productId', async () => {
      const response = await request(app)
        .delete('/api-v2/productinfo/delete')
        .query({ productId: 'invalid-id' })

      expect(response.status).toBe(422)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('POST /upload', () => {
    it('should upload a valid file successfully', async () => {
      const response = await request(app)
        .post('/api-v2/productinfo/upload')
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
        .post('/api-v2/productinfo/upload')
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
      const response = await request(app).get('/api-v2/productinfo/swagger')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('swaggerDefinition')
    })
  })
})
