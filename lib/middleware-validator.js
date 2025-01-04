'use strict'
// eslint-disable-next-line no-unused-vars
import Joi from 'joi'

// These represent the incoming data containers that we might need to validate
const containers = {
  query: {
    convert: true,
    allowUnknown: false,
    abortEarly: true,
  },
  body: {
    convert: true,
    allowUnknown: false,
    abortEarly: false,
  },
  headers: {
    convert: true,
    allowUnknown: true,
    stripUnknown: false,
    abortEarly: false,
  },
  params: {
    convert: true,
    allowUnknown: false,
    abortEarly: false,
  },
  fields: {
    convert: true,
    allowUnknown: false,
    abortEarly: false,
  },
}

/**
 * Extracts the request ID from the request object.
 * Looks for the ID in the headers or the request object.
 *
 * @param {Object} req - The Express request object.
 * @returns {string|null} The extracted request ID or null if not found.
 */
const getRequestID = (req) =>
  req.headers['x-request-id'] || req.requestID || null

/**
 * Middleware for validating incoming request data against Joi schemas.
 *
 * @param {Object<string, Joi.ObjectSchema>} schema - The validation schema.
 * @returns {(req, res, next) => void} Express middleware function.
 */
const validateRequest = (schema) => (req, res, next) => {
  try {
    const requestID = getRequestID(req)

    for (const [container, options] of Object.entries(containers)) {
      if (schema?.[container] && req[container]) {
        // Handle multipart/form-data (file uploads)
        if (container === 'body' && req.file) {
          // Copy the file buffer AND the mimetype so Joi can validate them
          req.body.file = req.file.buffer
          req.body.mimetype = req.file.mimetype
        }

        // Handle content-type-specific schemas for the request body
        if (container === 'body' && schema.body?.content) {
          const contentType = req.headers['content-type']?.split(';')[0]
          const requestBodySchema = schema.body.content[contentType]?.schema

          if (requestBodySchema) {
            const { error, value } = requestBodySchema.validate(
              req.body,
              options
            )
            if (error) {
              return res.status(422).json({
                requestID,
                error: error.message,
              })
            }
            req.body = value // Set validated body
          } else {
            const message = `Unsupported content type: ${contentType}`
            return res.status(415).json({
              requestID,
              error: message,
            })
          }
        } else {
          const { error, value } = schema[container].validate(
            req[container],
            options
          )
          if (error) {
            return res.status(422).json({
              requestID,
              error: error.message,
            })
          }
          req[container] = value // Set validated container
        }
      }
    }

    // If everything passed validation, continue
    next()
  } catch (err) {
    if (!res.headersSent) {
      next(err)
    }
  }
}

export default validateRequest
