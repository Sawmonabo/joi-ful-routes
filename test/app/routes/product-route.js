import express from 'express'
import { validateRequest, schemaToSwagger } from 'joi-ful-routes'

import MulterWrapper from '../lib/multer.js'
import ProductSchema from '../schemas/product-schema.js'

const uploadMiddleware = new MulterWrapper(
  2400000,
  ['image/jpeg', 'image/png', 'application/pdf'],
  'memory'
)
const router = express.Router()

// Route: Get Product by ID
router.get(
  '/get',
  validateRequest(ProductSchema.getProduct),
  async (req, res) => {
    const { productId } = req.query
    // Mocked response for demonstration
    res.status(200).json({
      productId,
      name: 'Sample Product',
      category: 'Electronics',
      price: 199.99,
      stock: 10,
      description: 'A sample product for testing.',
    })
  }
)

// Route: Add a new Product
router.post(
  '/add',
  validateRequest(ProductSchema.addProduct),
  async (req, res) => {
    const product = req.body
    // Mocked response for demonstration
    res.status(201).json({
      message: 'Product added successfully.',
      product,
    })
  }
)

// Route: Update Product by ID
router.put(
  '/update',
  validateRequest(ProductSchema.updateProduct),
  async (req, res) => {
    const { productId } = req.query
    const updatedProduct = req.body
    // Mocked response for demonstration
    res.status(200).json({
      message: 'Product updated successfully.',
      productId,
      updatedProduct,
    })
  }
)

// Route: Delete Product by ID
router.delete(
  '/delete',
  validateRequest(ProductSchema.deleteProduct),
  async (req, res) => {
    const { productId } = req.query // eslint-disable-line no-unused-vars
    // Mocked response for demonstration
    res.status(204).send() // No content
  }
)

// Route: Upload a file
router.post(
  '/upload',
  uploadMiddleware.single('file'),
  validateRequest(ProductSchema.uploadFile),
  async (req, res) => {
    if (!req.file) {
      return res.status(500).json({ error: 'File upload failed' })
    }
    res.status(200).json({
      message: `File uploaded successfully. Received file: ${req.file.originalname}`,
    })
  }
)

// Route: Swagger Documentation
router.get('/swagger', (req, res) => {
  const swaggerDefinition = schemaToSwagger(ProductSchema)
  res.status(200).json(swaggerDefinition)
})

export default router
