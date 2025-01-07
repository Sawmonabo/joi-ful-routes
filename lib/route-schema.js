// route-schema.js

/**
 * Base class for all schemas. Provides a helper to create route definitions.
 */
export default class RouteSchema {
  /**
   * Subclasses must override this to provide a "tag" object used in Swagger docs:
   *   { name: 'ExampleTag', description: '...' }
   */
  static get tag() {
    throw new Error(
      'You must implement the static getter "tag" in your subclass.'
    )
  }

  /**
   * For OpenAPI grouping, any routes created from this class
   * will appear under these tags in the generated docs.
   */
  static get tags() {
    return [this.tag]
  }

  /**
   * Subclasses must override to provide Joi schemas used for request validation.
   */
  static schemas() {
    throw new Error('You must implement the schemas() method in your subclass.')
  }

  /**
   * Subclasses must override to provide Joi parameter schemas, if any.
   */
  static parameters() {
    throw new Error(
      'You must implement the parameters() method in your subclass.'
    )
  }

  /**
   * This aggregates all schemas and parameters for use by
   * the swagger generator, or any other consumers.
   */
  static components() {
    return {
      schemas: this.schemas(),
      parameters: this.parameters(),
    }
  }

  /**
   * The "core" route construction utility.
   * All routes in subclasses should be created via this method.
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
      tags: this.tags.map((tag) => tag.name),
      ...(headers && { headers }),
      ...(query && { query }),
      ...(body && { body }),
      ...(responses && { responses }),
    }
  }

  /**
   * By default, we provide a reflection-based "paths" getter.
   * This looks at every static property of the class. If the property
   * is an object containing { path, method }, we fold it into the "paths" structure
   * needed by the swagger generator.
   */
  static get paths() {
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
          'tags',
          'paths', // itself
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
