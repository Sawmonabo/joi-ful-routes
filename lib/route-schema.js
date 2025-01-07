/**
 * Base class for all schemas. Provides utilities for creating and managing route definitions.
 */
export default class RouteSchema {
  /**
   * Subclasses must override this getter to provide a "tag" object used in Swagger documentation.
   * Example:
   *   { name: 'ExampleTag', description: 'Detailed description of the tag.' }
   * @throws {Error} If not implemented in a subclass.
   */
  static get tag() {
    throw new Error(
      'You must implement the static getter "tag" in your subclass.'
    )
  }

  /**
   * Subclasses must override this method to provide Joi schemas for request validation.
   * @throws {Error} If not implemented in a subclass.
   */
  static schemas() {
    throw new Error('You must implement the schemas() method in your subclass.')
  }

  /**
   * Subclasses must override this method to provide Joi schemas for route parameters, if applicable.
   * @throws {Error} If not implemented in a subclass.
   */
  static parameters() {
    throw new Error(
      'You must implement the parameters() method in your subclass.'
    )
  }

  /**
   * Aggregates schemas and parameters into a structure for OpenAPI components.
   * This is consumed by Swagger or other documentation generators.
   * @returns {Object} An object containing `schemas` and `parameters`.
   */
  static components() {
    return {
      schemas: this.schemas(),
      parameters: this.parameters(),
    }
  }

  /**
   * Utility method for constructing API route definitions.
   * Subclasses should use this to define their routes.
   * @param {Object} options - Options for defining a route.
   * @param {string} options.path - The API endpoint path.
   * @param {string} options.method - The HTTP method (e.g., 'get', 'post').
   * @param {string} options.summary - A summary of the route's purpose.
   * @param {Object} [options.headers] - Optional headers schema.
   * @param {Object} [options.query] - Optional query parameter schema.
   * @param {Object} [options.body] - Optional request body schema.
   * @param {Object} [options.responses] - Optional response schemas.
   * @throws {Error} If `path`, `method`, or `summary` is missing.
   * @returns {Object} A route definition object.
   */
  static createRoute({
    path,
    method,
    summary,
    headers,
    query,
    body,
    responses,
  }) {
    if (!path || !method || !summary) {
      throw new Error(
        'Path, method, and summary are required to define an API route.'
      )
    }

    return {
      path,
      method,
      summary,
      // The "tags" property helps group operations in OpenAPI docs.
      tags: this._tags.map((tag) => tag.name),
      ...(headers && { headers }),
      ...(query && { query }),
      ...(body && { body }),
      ...(responses && { responses }),
    }
  }

  /**
   * Internal method for generating OpenAPI tags.
   * Tags are used for grouping routes in the documentation.
   * Subclasses should define their `tag` to leverage this grouping.
   * @returns {Array} An array of tag objects.
   * @private
   */
  static get _tags() {
    return [this.tag]
  }

  /**
   * Internal method for generating a reflection-based structure of paths.
   * This scans static properties of the class and identifies route definitions.
   * @returns {Object} A Swagger-compatible "paths" object.
   * @private
   */
  static get _paths() {
    const allProps = Object.getOwnPropertyNames(this)
    const swaggerPaths = {}

    for (const propName of allProps) {
      // Skip built-ins or known base methods
      if (['length', 'name', 'prototype'].includes(propName)) {
        continue
      }
      // Skip known base methods
      if (
        [
          'createRoute',
          'schemas',
          'parameters',
          'components',
          'tag',
          '_tags',
          '_paths', // itself
        ].includes(propName)
      ) {
        continue
      }

      // Check if this static property looks like a route object
      const potentialRoute = this[propName]
      if (
        potentialRoute &&
        typeof potentialRoute === 'object' &&
        potentialRoute.path &&
        potentialRoute.method
      ) {
        // e.g. potentialRoute = { path: '/some', method: 'get', summary: '...' }
        const { path, method } = potentialRoute
        if (!swaggerPaths[path]) {
          swaggerPaths[path] = {}
        }
        swaggerPaths[path][method] = potentialRoute
      }
    }
    return swaggerPaths
  }
}
