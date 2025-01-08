import { parse as j2s } from './joi-to-swagger.js'

/**
 * @typedef {import('./route-schema').default} RouteSchema
 * Represents a RouteSchema class, including its static properties and methods.
 */

/**
 * @typedef {Object} SwaggerComponents
 * @property {Object} schemas - Object containing Swagger schemas.
 * @property {Object} parameters - Object containing Swagger parameters.
 */

/**
 * Primary entry point: convert a Joi-based RouteSchema class to Swagger documentation.
 * @param {RouteSchema} schemaClass - The schema class with paths, components, and tags.
 * @returns {Object} The generated Swagger documentation.
 */
export function schemaToSwagger(schemaClass) {
  // 1) Build all "components" (schemas + parameters)
  const { swaggerComponents, schemaMap, convertedSchemasMap } =
    buildSwaggerComponents(schemaClass)

  // 2) Build the "paths" section
  const swaggerPaths = buildSwaggerPaths(
    schemaClass,
    swaggerComponents,
    schemaMap,
    convertedSchemasMap
  )

  // Finally, return the fully assembled definition
  return {
    definition: {
      tags: schemaClass._tags || [],
      paths: swaggerPaths,
      components: swaggerComponents,
    },
  }
}

/**
 * Build the 'components' section (including 'schemas' and 'parameters').
 * We also return `schemaMap` and `convertedSchemasMap` so the path-building code
 * can reuse them (preventing duplicates).
 *
 * @param {RouteSchema} schemaClass - The schema class with paths, components, and tags.
 * @returns {Object} The Swagger components and supporting maps.
 * @returns {SwaggerComponents} return.swaggerComponents - The built components.
 * @returns {Map} return.schemaMap - Maps Joi object -> assigned schema name.
 * @returns {Map} return.convertedSchemasMap - Maps JSON string of Swagger schema -> schema name.
 */
function buildSwaggerComponents(schemaClass) {
  const components = schemaClass.components()
  const swaggerComponents = {
    schemas: {},
    parameters: {},
  }

  // We keep these to detect duplicates
  const schemaMap = new Map() // Maps Joi object -> assigned schema name
  const convertedSchemasMap = new Map() // Maps JSON string of swagger schema -> schema name

  // 1. Convert top-level schemas
  Object.keys(components.schemas).forEach((key) => {
    const joiSchema = components.schemas[key]
    const convertedSchema = j2s(joiSchema).swagger

    // Store directly under that key
    swaggerComponents.schemas[key] = convertedSchema

    // Cache the association
    schemaMap.set(joiSchema, key)
    convertedSchemasMap.set(JSON.stringify(convertedSchema), key)
  })

  // 2. Convert parameters
  const parameterKeyToNameMap = {}
  Object.keys(components.parameters).forEach((refName) => {
    const parameter = components.parameters[refName]
    if (parameter && typeof parameter.describe === 'function') {
      const swaggerParam = j2s(parameter).swagger
      const [paramName] = Object.keys(swaggerParam.properties || {})
      if (!paramName) {
        return
      }

      const paramDef = { ...swaggerParam.properties[paramName] }
      const isRequired = swaggerParam.required?.includes(paramName) || false

      const paramIn = paramName.startsWith('x-') ? 'header' : 'query'
      parameterKeyToNameMap[paramName] = refName

      const paramDescription = paramDef.description || ''
      delete paramDef.description

      swaggerComponents.parameters[refName] = {
        name: paramName,
        in: paramIn,
        required: isRequired,
        schema: paramDef,
        description: paramDescription,
      }
    }
  })

  // Return the components plus the "maps" so they can be reused for the path building
  return {
    swaggerComponents,
    schemaMap,
    convertedSchemasMap,
  }
}

/**
 * Build the 'paths' object from the route definitions in schemaClass._paths.
 * Reuses schema and conversion maps from `buildSwaggerComponents`.
 *
 * @param {RouteSchema} schemaClass - The schema class with paths, components, and tags.
 * @param {SwaggerComponents} swaggerComponents - The built Swagger components.
 * @param {Map} schemaMap - Maps Joi object -> assigned schema name.
 * @param {Map} convertedSchemasMap - Maps JSON string of Swagger schema -> schema name.
 * @returns {Object} The Swagger paths object.
 */
function buildSwaggerPaths(
  schemaClass,
  swaggerComponents,
  schemaMap,
  convertedSchemasMap
) {
  const swaggerPaths = {}
  const paths = schemaClass._paths

  // Build a quick paramName->refName map from the existing swaggerComponents:
  const paramNameToRefName = {}
  Object.entries(swaggerComponents.parameters).forEach(
    ([refName, paramObj]) => {
      paramNameToRefName[paramObj.name] = refName // Map param names to their references
    }
  )

  Object.keys(paths).forEach((path) => {
    const routeDef = paths[path]
    const [methodKey] = Object.keys(routeDef)
    const methodConfig = routeDef[methodKey]

    if (!methodConfig || !methodConfig.method) {
      return
    }

    const parameters = collectParameters(methodConfig, paramNameToRefName)
    const requestBody = buildRequestBody(
      methodConfig.body,
      swaggerComponents,
      schemaMap,
      convertedSchemasMap
    )
    const responses = buildResponses(
      methodConfig.responses,
      swaggerComponents,
      schemaMap,
      convertedSchemasMap
    )

    swaggerPaths[path] = {
      [methodKey]: {
        tags: methodConfig.tags || [],
        summary: methodConfig.summary || '',
        parameters,
        ...(requestBody && { requestBody }),
        responses,
      },
    }
  })

  return swaggerPaths
}

/**
 * Collect parameters from headers and query in method configuration.
 *
 * @param {Object} methodConfig - The route method configuration.
 * @param {Object} paramNameToRefName - Map of parameter names to reference names.
 * @returns {Array<Object>} Array of parameter references for Swagger.
 */
function collectParameters(methodConfig, paramNameToRefName) {
  const parameters = []

  // HEADERS
  if (
    methodConfig.headers &&
    typeof methodConfig.headers.describe === 'function'
  ) {
    const headerKeys = Object.keys(methodConfig.headers.describe().keys || {})
    headerKeys.forEach((k) => {
      const refName = paramNameToRefName[k] || k
      parameters.push({ $ref: `#/components/parameters/${refName}` })
    })
  }

  // QUERY
  if (methodConfig.query && typeof methodConfig.query.describe === 'function') {
    const queryKeys = Object.keys(methodConfig.query.describe().keys || {})
    queryKeys.forEach((k) => {
      const refName = paramNameToRefName[k] || k
      parameters.push({ $ref: `#/components/parameters/${refName}` })
    })
  }

  return parameters
}

/**
 * Build the requestBody for a route if a body configuration exists.
 *
 * @param {Object} bodyConfig - Configuration for the request body.
 * @param {SwaggerComponents} swaggerComponents - The built Swagger components.
 * @param {Map} schemaMap - Maps Joi object -> assigned schema name.
 * @param {Map} convertedSchemasMap - Maps JSON string of Swagger schema -> schema name.
 * @returns {Object|null} The requestBody object or null if not applicable.
 */
function buildRequestBody(
  bodyConfig,
  swaggerComponents,
  schemaMap,
  convertedSchemasMap
) {
  if (!bodyConfig || !bodyConfig.content) {
    return null
  }

  const content = {}
  Object.entries(bodyConfig.content).forEach(([mimeType, cfg]) => {
    const joiSchema = cfg.schema
    const schemaName = getSchemaNameFromObj(
      joiSchema,
      swaggerComponents.schemas,
      schemaMap,
      convertedSchemasMap
    )

    content[mimeType] = {
      schema: { $ref: `#/components/schemas/${schemaName}` },
    }
  })

  return {
    description: bodyConfig.description || '',
    required: !!bodyConfig.required,
    content,
  }
}

/**
 * Build the responses object for a route.
 *
 * @param {Object} responsesConfig - Configuration for the responses.
 * @param {SwaggerComponents} swaggerComponents - The built Swagger components.
 * @param {Map} schemaMap - Maps Joi object -> assigned schema name.
 * @param {Map} convertedSchemasMap - Maps JSON string of Swagger schema -> schema name.
 * @returns {Object} The responses object for Swagger.
 */
function buildResponses(
  responsesConfig,
  swaggerComponents,
  schemaMap,
  convertedSchemasMap
) {
  const responses = {}
  if (!responsesConfig) {
    return responses
  }

  Object.entries(responsesConfig).forEach(([statusCode, responseObj]) => {
    const { description, content } = responseObj
    const builtContent = {}

    if (content) {
      Object.entries(content).forEach(([mimeType, subObj]) => {
        const { schema: joiSchema, examples } = subObj
        const schemaName = getSchemaNameFromObj(
          joiSchema,
          swaggerComponents.schemas,
          schemaMap,
          convertedSchemasMap
        )

        builtContent[mimeType] = {
          schema: { $ref: `#/components/schemas/${schemaName}` },
        }

        // If the user included `examples`, attach them
        if (examples) {
          builtContent[mimeType].examples = examples
        }
      })
    }

    responses[statusCode] = {
      description,
      content: builtContent,
    }
  })

  return responses
}

/**
 * Helper function to get the schema name from a Joi object.
 * If the schema is already defined in the swaggerComponents, it will reuse it.
 * Otherwise, it will add it to the swaggerComponents and return the name.
 * @param {Joi.ObjectSchema} joiSchema
 * @param {Object} schemasObj - e.g. swaggerComponents.schemas
 * @param {Map<Joi.ObjectSchema, string>} schemaMap - Maps Joi object -> assigned schema name
 * @param {Map<string, string>} convertedSchemasMap - Maps JSON string of swagger schema -> schema name
 * @returns {string} The schema name.
 */
function getSchemaNameFromObj(
  joiSchema,
  schemasObj, // e.g. swaggerComponents.schemas
  schemaMap, // Map<JoiObject, schemaName>
  convertedSchemasMap // Map<stringifiedSwaggerSchema, schemaName>
) {
  // Already mapped by exact object reference?
  if (schemaMap.has(joiSchema)) {
    return schemaMap.get(joiSchema)
  }

  // Convert with joi-to-swagger
  const convertedSchema = j2s(joiSchema).swagger
  const str = JSON.stringify(convertedSchema)

  // If we already have an identical shape
  if (convertedSchemasMap.has(str)) {
    const existingName = convertedSchemasMap.get(str)
    // Link our current joi object to that name
    schemaMap.set(joiSchema, existingName)
    return existingName
  }

  // Attempt to use the label from `.label(...)`
  const chosenName = convertedSchema.title // might be undefined if no label

  if (!chosenName) {
    throw new Error(
      'Encountered a Joi schema without a label. ' +
        'Please add .label() to your joi object or define the schema in static schemas() for reuse.'
    )
  }

  // If the label is already used in 'schemasObj'
  if (chosenName && schemasObj[chosenName]) {
    // We have to check if the shape is truly the same
    const existingSchema = schemasObj[chosenName]
    const existingStr = JSON.stringify(existingSchema)

    if (existingStr === str) {
      // Exactly the same shape => reuse
      schemaMap.set(joiSchema, chosenName)
      convertedSchemasMap.set(str, chosenName)
      return chosenName
    } else {
      // Shapes differ => best practice is to raise an error
      // or rename automatically if you prefer.
      throw new Error(
        `Joi label "${chosenName}" is already used for a different schema shape. 
         Please ensure shapes match or use a different label.`
      )
    }
  }

  // Remove title to avoid duplication in final doc
  delete convertedSchema.title

  // Register in swagger components
  schemasObj[chosenName] = convertedSchema
  schemaMap.set(joiSchema, chosenName)
  convertedSchemasMap.set(str, chosenName)

  return chosenName
}

export default schemaToSwagger
