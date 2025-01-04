// lib/route-schema.js

class RouteSchema {
  static get tag() {
    throw new Error(
      'You must implement the static getter "tag" in your subclass.'
    )
  }

  static get tags() {
    return [this.tag]
  }

  static schemas() {
    throw new Error('You must implement the schemas() method in your subclass.')
  }

  static parameters() {
    throw new Error(
      'You must implement the parameters() method in your subclass.'
    )
  }

  // Aggregate the schema definitions
  static components() {
    return {
      schemas: this.schemas(),
      parameters: this.parameters(),
    }
  }

  /**
   * Helper to define a route object for the final swagger
   * {
   *   path: '/some/path',
   *   method: 'get',
   *   summary: 'Some summary',
   *   tags: ['...'],
   *   headers: Joi.object() (optional),
   *   query: Joi.object() (optional),
   *   body: { content: { 'application/json': { schema: Joi.object() }}, ... } (optional),
   *   responses: {
   *     [statusCode]: {
   *       description: '',
   *       content: { ... }
   *     }
   *   },
   * }
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
      tags: this.tags.map((tag) => tag.name), // e.g. "ExampleRoute"
      ...(headers && { headers }),
      ...(query && { query }),
      ...(body && { body }),
      ...(responses && { responses }),
    }
  }
}

export default RouteSchema
