'use strict';

var Joi = require('joi');
var _ = require('lodash');

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
};

/**
 * Extracts the request ID from the request object.
 * Looks for the ID in the headers or the request object.
 *
 * @param {Object} req - The Express request object.
 * @returns {string|null} The extracted request ID or null if not found.
 */
const getRequestID = (req) =>
  req.headers['x-request-id'] || req.requestID || null;

/**
 * Middleware for validating incoming request data against Joi schemas.
 *
 * @param {Object<string, Joi.ObjectSchema>} schema - The validation schema.
 * @returns {(req, res, next) => void} Express middleware function.
 */
const validateRequest = (schema) => (req, res, next) => {
  try {
    const requestID = getRequestID(req);

    for (const [container, options] of Object.entries(containers)) {
      if (schema?.[container] && req[container]) {
        // Handle multipart/form-data (file uploads)
        if (container === 'body' && req.file) {
          // Copy the file buffer AND the mimetype so Joi can validate them
          req.body.file = req.file.buffer;
          req.body.mimetype = req.file.mimetype;
        }

        // Handle content-type-specific schemas for the request body
        if (container === 'body' && schema.body?.content) {
          const contentType = req.headers['content-type']?.split(';')[0];
          const requestBodySchema = schema.body.content[contentType]?.schema;

          if (requestBodySchema) {
            const { error, value } = requestBodySchema.validate(
              req.body,
              options
            );
            if (error) {
              return res.status(422).json({
                requestID,
                error: error.message,
              })
            }
            req.body = value; // Set validated body
          } else {
            const message = `Unsupported content type: ${contentType}`;
            return res.status(415).json({
              requestID,
              error: message,
            })
          }
        } else {
          const { error, value } = schema[container].validate(
            req[container],
            options
          );
          if (error) {
            return res.status(422).json({
              requestID,
              error: error.message,
            })
          }
          req[container] = value; // Set validated container
        }
      }
    }

    // If everything passed validation, continue
    next();
  } catch (err) {
    if (!res.headersSent) {
      next(err);
    }
  }
};

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

// Conversion library for transforming joi schema objects into swagger/OpenApi OAS 3.0 schema definitions.

const { isRef, object: _object, isSchema } = Joi;

const {
  find,
  get,
  isEqual,
  isNumber,
  isPlainObject,
  isString,
  merge,
  set,
  uniqWith,
} = _;

/**
 * Predefined regex patterns for string validations.
 */
const patterns = {
  alphanum: '^[a-zA-Z0-9]*$',
  alphanumLower: '^[a-z0-9]*$',
  alphanumUpper: '^[A-Z0-9]*$',
  token: '^[a-zA-Z0-9_]*$',
};

/**
 * Extracts metadata from a Joi schema.
 *
 * @param {Joi.Schema} schema - The Joi schema.
 * @param {string} key - The metadata key to retrieve.
 * @returns {*} The value associated with the metadata key.
 */
function meta(schema, key) {
  const flattened = Object.assign.apply(null, [{}].concat(schema.$_terms.metas));
  return get(flattened, key)
}

/**
 * Creates a Swagger reference definition.
 *
 * @param {string} type - The component type (e.g., 'schemas').
 * @param {string} name - The name of the component.
 * @returns {object} The Swagger reference object.
 */
function refDef(type, name) {
  return { $ref: `#/components/${type}/${name}` }
}

/**
 * Retrieves minimum and maximum constraints from a Joi schema.
 *
 * @param {Joi.Schema} schema - The Joi schema.
 * @param {string} [suffix='Length'] - The suffix to append to min/max keys.
 * @returns {object} An object containing min and max constraints.
 */
function getMinMax(schema, suffix = 'Length') {
  const swagger = {};
  for (let i = 0; i < schema._rules.length; i++) {
    const rule = schema._rules[i];
    if (rule.name === 'min') {
      swagger[`min${suffix}`] = rule.args.limit;
    }

    if (rule.name === 'max') {
      swagger[`max${suffix}`] = rule.args.limit;
    }

    if (rule.name === 'length') {
      swagger[`min${suffix}`] = rule.args.limit;
      swagger[`max${suffix}`] = rule.args.limit;
    }
  }
  return swagger
}

/**
 * Determines the case suffix based on Joi's case transformation rules.
 *
 * @param {Joi.Schema} schema - The Joi schema.
 * @returns {string} The case suffix ('Lower', 'Upper', or '').
 */
function getCaseSuffix(schema) {
  const caseRule = find(schema._rules, { name: 'case' });
  if (caseRule && caseRule.args.direction === 'lower') {
    return 'Lower'
  } else if (caseRule && caseRule.args.direction === 'upper') {
    return 'Upper'
  }
  return ''
}

/**
 * Parses conditional schemas (when clauses) in Joi schemas.
 *
 * @param {Joi.Schema} schema - The Joi schema containing when clauses.
 * @param {object} existingComponents - Existing Swagger components.
 * @param {object} newComponentsByRef - Newly added components by reference.
 * @returns {object} The Swagger schema for conditional alternatives.
 */
function parseWhens(schema, existingComponents, newComponentsByRef) {
  const whens = get(schema, '$_terms.whens');
  const mode = whens.length > 1 ? 'anyOf' : 'oneOf';

  const alternatives = [];
  for (const w of whens) {
    if (w.then) {
      alternatives.push(w.then);
    }
    if (w.otherwise) {
      alternatives.push(w.otherwise);
    }
    if (w.switch) {
      for (const s of w.switch) {
        if (s.then) {
          alternatives.push(s.then);
        }
        if (s.otherwise) {
          alternatives.push(s.otherwise);
        }
      }
    }
  }

  return schemaForAlternatives(
    alternatives,
    existingComponents,
    newComponentsByRef,
    mode
  )
}

/**
 * Constructs Swagger schema for alternative Joi schemas.
 *
 * @param {joi.Schema[]} alternatives - The alternative Joi schemas.
 * @param {object} existingComponents - Existing Swagger components.
 * @param {object} newComponentsByRef - Newly added components by reference.
 * @param {string} mode - The OpenAPI mode ('anyOf', 'oneOf', etc.).
 * @returns {object} The Swagger schema for alternatives.
 */
function schemaForAlternatives(
  alternatives,
  existingComponents,
  newComponentsByRef,
  mode
) {
  let swaggers = [];
  for (const joiSchema of alternatives) {
    const { swagger, components } = parse(
      joiSchema,
      merge({}, existingComponents || {}, newComponentsByRef || {})
    );
    if (!swagger) {
      continue
    } // swagger is falsy if joi.forbidden()
    if (get(joiSchema, '_flags.presence') === 'required') {
      swagger['x-required'] = true;
    }
    merge(newComponentsByRef, components || {});

    swaggers.push(swagger);
  }
  swaggers = uniqWith(swaggers, isEqual);

  return swaggers.length > 0 ? { [mode]: swaggers } : {}
}

/**
 * Parses valid and invalid values from a Joi schema.
 *
 * @param {Joi.Schema} schema - The Joi schema.
 * @param {Function} filterFunc - The function to filter values.
 * @returns {object} An object containing enum or not constraints.
 */
function parseValidsAndInvalids(schema, filterFunc) {
  const swagger = {};
  if (schema._valids) {
    const valids = schema._valids.values().filter(filterFunc);
    if (get(schema, '_flags.only') && valids.length) {
      swagger.enum = valids;
    }
  }

  if (schema._invalids) {
    const invalids = schema._invalids.values().filter(filterFunc);
    if (invalids.length) {
      swagger.not = { enum: invalids };
    }
  }

  return swagger
}

/**
 * Retrieves the reference value from metadata or fallback.
 *
 * @param {joi.Ref} ref - The Joi reference.
 * @param {Joi.Schema} schema - The Joi schema.
 * @param {*} fallback - The fallback value if reference is not found.
 * @returns {*} The resolved reference value or fallback.
 */
function getRefValue(ref, schema, fallback) {
  const refValues = meta(schema, 'refValues') || {};
  const refKey = ref.toString().replace(/^ref:/, '');
  return refValues[refKey] || fallback
}

/**
 * Parsers for different Joi types to Swagger schema.
 */
const parseAsType = {
  number: (schema) => {
    const swagger = {};

    if (find(schema._rules, { name: 'integer' })) {
      swagger.type = 'integer';
    } else {
      swagger.type = 'number';
      if (find(schema._rules, { name: 'precision' })) {
        swagger.format = 'double';
      } else {
        swagger.format = 'float';
      }
    }

    const sign = find(schema._rules, { name: 'sign' });
    if (sign) {
      if (sign.args.sign === 'positive') {
        swagger.minimum = 1;
      } else if (sign.args.sign === 'negative') {
        swagger.maximum = -1;
      }
    }

    const min = find(schema._rules, { name: 'min' });
    if (min) {
      swagger.minimum = isRef(min.args.limit)
        ? getRefValue(min.args.limit, schema, 0)
        : min.args.limit;
    }

    const max = find(schema._rules, { name: 'max' });
    if (max) {
      swagger.maximum = isRef(max.args.limit)
        ? getRefValue(max.args.limit, schema, 0)
        : max.args.limit;
    }

    Object.assign(
      swagger,
      parseValidsAndInvalids(schema, (s) => isNumber(s))
    );

    return swagger
  },
  string: (schema) => {
    const swagger = { type: 'string' };

    if (find(schema._rules, { name: 'alphanum' })) {
      const strict = get(schema, '_preferences.convert') === false;
      swagger.pattern =
        patterns[`alphanum${strict ? getCaseSuffix(schema) : ''}`];
    }

    if (find(schema._rules, { name: 'token' })) {
      swagger.pattern = patterns.token;
    }

    if (find(schema._rules, { name: 'email' })) {
      swagger.format = 'email';
      if (swagger.pattern) {
        delete swagger.pattern;
      }
    }

    if (find(schema._rules, { name: 'isoDate' })) {
      swagger.format = 'date-time';
      if (swagger.pattern) {
        delete swagger.pattern;
      }
    }

    if (find(schema._rules, { name: 'guid' })) {
      swagger.format = 'uuid';
      if (swagger.pattern) {
        delete swagger.pattern;
      }
    }

    const pattern = find(schema._rules, { name: 'pattern' });
    if (pattern) {
      swagger.pattern = pattern.args.regex.toString().slice(1, -1);
    }

    Object.assign(swagger, getMinMax(schema));
    Object.assign(
      swagger,
      parseValidsAndInvalids(schema, (s) => isString(s))
    );

    return swagger
  },
  binary: (schema) => {
    const swagger = { type: 'string', format: 'binary' };

    if (get(schema, '_flags.encoding') === 'base64') {
      swagger.format = 'byte';
    }

    Object.assign(swagger, getMinMax(schema));

    return swagger
  },
  date: (schema) => {
    const swagger = { type: 'string', format: 'date-time' };
    if (get(schema, '_flags.format') === 'YYYY-MM-DD') {
      swagger.format = 'date';
    }
    return swagger
  },
  boolean: (/* schema */) => ({ type: 'boolean' }),
  alternatives: (schema, existingComponents, newComponentsByRef) => {
    const matches = get(schema, '$_terms.matches');
    const mode = `${get(schema, '_flags.match') || 'any'}Of`;

    const alternatives = [];
    for (const m of matches) {
      if (m.ref) {
        if (m.then) {
          alternatives.push(m.then);
        }
        if (m.otherwise) {
          alternatives.push(m.otherwise);
        }
        if (m.switch) {
          for (const s of m.switch) {
            if (s.then) {
              alternatives.push(s.then);
            }
            if (s.otherwise) {
              alternatives.push(s.otherwise);
            }
          }
        }
      } else {
        alternatives.push(m.schema);
      }
    }

    return schemaForAlternatives(
      alternatives,
      existingComponents,
      newComponentsByRef,
      mode
    )
  },
  array: (schema, existingComponents, newComponentsByRef) => {
    const items = get(schema, '$_terms.items');
    const mode = 'oneOf';

    const alternatives = items;

    let swaggers = [];
    for (const joiSchema of alternatives) {
      const { swagger, components } = parse(
        joiSchema,
        merge({}, existingComponents || {}, newComponentsByRef || {})
      );
      if (!swagger) {
        continue
      } // swagger is falsy if joi.forbidden()

      merge(newComponentsByRef, components || {});

      swaggers.push(swagger);
    }
    swaggers = uniqWith(swaggers, isEqual);

    const openapi = {
      type: 'array',
      items: { [mode]: swaggers },
    };
    if (swaggers.length <= 1) {
      openapi.items = get(swaggers, [0]) || {};
    }

    Object.assign(openapi, getMinMax(schema, 'Items'));

    if (find(schema._rules, { name: 'unique' })) {
      openapi.uniqueItems = true;
    }

    return openapi
  },
  object: (schema, existingComponents, newComponentsByRef) => {
    const requireds = [];
    const properties = {};
    let additionalProperties = {};

    const combinedComponents = merge(
      {},
      existingComponents || {},
      newComponentsByRef || {}
    );

    const children = get(schema, '$_terms.keys') || [];
    children.forEach((child) => {
      const key = child.key;
      const { swagger, components } = parse(child.schema, combinedComponents);
      if (!swagger) {
        // swagger is falsy if joi.forbidden()
        return
      }

      merge(newComponentsByRef, components || {});
      merge(combinedComponents, components || {});

      properties[key] = swagger;

      if (get(child, 'schema._flags.presence') === 'required') {
        requireds.push(key);
      }
    });

    if (!children.length) {
      const keyPatterns = get(schema, '$_terms.patterns');
      if (keyPatterns) {
        keyPatterns.forEach((pattern) => {
          if (pattern.rule) {
            const { swagger, components } = parse(
              pattern.rule,
              combinedComponents
            );
            if (!swagger) {
              // swagger is falsy if joi.forbidden()
              return
            }

            merge(newComponentsByRef, components || {});
            merge(combinedComponents, components || {});

            additionalProperties = swagger;
          }
        });
      }
    }

    const swagger = {
      type: 'object',
      properties,
    };
    if (requireds.length) {
      swagger.required = requireds;
    }

    if (get(schema, '_flags.unknown') !== true) {
      swagger.additionalProperties = false;
    }

    if (Object.keys(additionalProperties).length !== 0) {
      swagger.additionalProperties = additionalProperties;
    }

    return swagger
  },
  any: (schema) => {
    const swagger = {};
    // convert property to file upload, if indicated by meta property
    if (meta(schema, 'swaggerType') === 'file') {
      swagger.type = 'file';
      swagger.in = 'formData';
    }

    Object.assign(
      swagger,
      parseValidsAndInvalids(schema, (s) => isString(s) || isNumber(s))
    );

    return swagger
  },
};

/**
 * Parses a Joi schema into Swagger/OpenAPI schema definitions.
 *
 * @param {joi.Schema|object} schema - The Joi schema or a plain object to be converted to a Joi object schema.
 * @param {object} [existingComponents={}] - Existing Swagger components to reference.
 * @param {boolean} [isSchemaOverride=false] - Indicates if the current schema is an override.
 * @returns {object|false} An object containing the Swagger schema and components or false if the schema is forbidden.
 * @throws {Error} If no schema is provided or schema is invalid.
 */
function parse(
  schema,
  existingComponents = {},
  isSchemaOverride = false
) {
  if (!schema) {
    throw new Error('No schema was passed.')
  }

  if (isPlainObject(schema)) {
    schema = _object().keys(schema);
  }

  if (!isSchema(schema)) {
    throw new TypeError('Passed schema does not appear to be a joi schema.')
  }

  const flattenMeta = Object.assign.apply(
    null,
    [{}].concat(schema.$_terms.metas)
  );

  const schemaOverride = flattenMeta.schemaOverride;
  if (schemaOverride) {
    if (isSchemaOverride) {
      throw new Error(
        'Cannot override the schema for one which is being used in another override (no nested schema overrides).'
      )
    }
    return parse(schemaOverride, existingComponents, true)
  }

  const components = {};
  const metaDefName = flattenMeta.className;
  const metaDefType = flattenMeta.classTarget || 'schemas';

  const getReturnValue = (swagger) => {
    if (metaDefName) {
      set(components, [metaDefType, metaDefName], swagger);
      return { swagger: refDef(metaDefType, metaDefName), components }
    }

    return { swagger, components }
  };

  const override = flattenMeta.swagger;
  if (override && flattenMeta.swaggerOverride) {
    return getReturnValue(override)
  }

  // if the schema has a definition class name, and that
  // definition is already defined, just use that definition
  if (metaDefName && get(existingComponents, [metaDefType, metaDefName])) {
    return { swagger: refDef(metaDefType, metaDefName), components }
  }

  if (get(schema, '_flags.presence') === 'forbidden') {
    return false
  }

  const type = meta(schema, 'baseType') || schema.type;

  if (!parseAsType[type]) {
    throw new TypeError(`${type} is not a recognized Joi type.`)
  }

  const swagger = parseAsType[type](schema, existingComponents, components);
  if (get(schema, '$_terms.whens')) {
    Object.assign(swagger, parseWhens(schema, existingComponents, components));
  }

  if (schema._valids && schema._valids.has(null)) {
    swagger.nullable = true;
  }

  const description = get(schema, '_flags.description');
  if (description) {
    swagger.description = description;
  }

  if (schema.$_terms.examples) {
    if (schema.$_terms.examples.length === 1) {
      swagger.example = schema.$_terms.examples[0];
    } else {
      swagger.examples = schema.$_terms.examples;
    }
  }

  const label = get(schema, '_flags.label');
  if (label) {
    swagger.title = label;
  }

  const defaultValue = get(schema, '_flags.default');
  if (
    (defaultValue || typeof defaultValue === 'boolean') &&
    typeof defaultValue !== 'function'
  ) {
    swagger.default = defaultValue;
  }

  if (override) {
    Object.assign(swagger, override);
  }

  return getReturnValue(swagger)
}

/**
 * Primary entry point: convert a Joi-based RouteSchema class to Swagger documentation.
 * @param {Object} schemaClass - The schema class with paths, components, and tags.
 * @returns {Object} The generated Swagger documentation.
 */
function schemaToSwagger(schemaClass) {
  // 1) Build all "components" (schemas + parameters)
  const { swaggerComponents, schemaMap, convertedSchemasMap } =
    buildSwaggerComponents(schemaClass);

  // 2) Build the "paths" section
  const swaggerPaths = buildSwaggerPaths(
    schemaClass,
    swaggerComponents,
    schemaMap,
    convertedSchemasMap
  );

  // Finally, return the fully assembled definition
  return {
    definition: {
      tags: schemaClass.tags || [],
      paths: swaggerPaths,
      components: swaggerComponents,
    },
  }
}

/**
 * Step 1: Build the 'components' section (including 'schemas' and 'parameters').
 * We also return `schemaMap` and `convertedSchemasMap` so the path-building code
 * can reuse them (preventing duplicates).
 */
function buildSwaggerComponents(schemaClass) {
  const components = schemaClass.components();
  const swaggerComponents = {
    schemas: {},
    parameters: {},
  };

  // We keep these to detect duplicates
  const schemaMap = new Map(); // Maps Joi object -> assigned schema name
  const convertedSchemasMap = new Map(); // Maps JSON string of swagger schema -> schema name

  // 1. Convert top-level schemas
  Object.keys(components.schemas).forEach((key) => {
    const joiSchema = components.schemas[key];
    const convertedSchema = parse(joiSchema).swagger;

    // Store directly under that key
    swaggerComponents.schemas[key] = convertedSchema;

    // Cache the association
    schemaMap.set(joiSchema, key);
    convertedSchemasMap.set(JSON.stringify(convertedSchema), key);
  });
  Object.keys(components.parameters).forEach((refName) => {
    const parameter = components.parameters[refName];
    if (parameter && typeof parameter.describe === 'function') {
      const swaggerParam = parse(parameter).swagger;
      const [paramName] = Object.keys(swaggerParam.properties || {});
      if (!paramName) {
        return
      }

      const paramDef = { ...swaggerParam.properties[paramName] };
      const isRequired = swaggerParam.required?.includes(paramName) || false;

      const paramIn = paramName.startsWith('x-') ? 'header' : 'query';

      const paramDescription = paramDef.description || '';
      delete paramDef.description;

      swaggerComponents.parameters[refName] = {
        name: paramName,
        in: paramIn,
        required: isRequired,
        schema: paramDef,
        description: paramDescription,
      };
    }
  });

  // Return the components plus the "maps" so they can be reused for the path building
  return {
    swaggerComponents,
    schemaMap,
    convertedSchemasMap,
  }
}

/**
 * Step 2: Build the 'paths' object from the route definitions in schemaClass.paths.
 * Reuses the 'schemaMap' and 'convertedSchemasMap' from buildSwaggerComponents() to avoid duplicates.
 */
function buildSwaggerPaths(
  schemaClass,
  swaggerComponents,
  schemaMap,
  convertedSchemasMap
) {
  const swaggerPaths = {};
  const { paths } = schemaClass;

  // We may need parameter key->name map. In your original code, it was built inline,
  // but we've integrated a partial approach in buildSwaggerComponents. For clarity,
  // let's read from swaggerComponents.parameters if needed, or we can keep your approach.
  //
  // We'll build a quick paramName->refName map from the existing swaggerComponents:
  const paramNameToRefName = {};
  Object.entries(swaggerComponents.parameters).forEach(
    ([refName, paramObj]) => {
      paramNameToRefName[paramObj.name] = refName; // e.g. paramObj.name = "domain" => refName = "CustomDomainParam"
    }
  );

  Object.keys(paths).forEach((path) => {
    const routeDef = paths[path];
    const [methodKey] = Object.keys(routeDef);
    const methodConfig = routeDef[methodKey];

    if (!methodConfig || !methodConfig.method) {
      return
    }

    // Collect parameters from headers/query
    const parameters = collectParameters(methodConfig, paramNameToRefName);

    // Build requestBody if defined
    const requestBody = buildRequestBody(
      methodConfig.body,
      swaggerComponents,
      schemaMap,
      convertedSchemasMap
    );

    // Build responses
    const responses = buildResponses(
      methodConfig.responses,
      swaggerComponents,
      schemaMap,
      convertedSchemasMap
    );

    swaggerPaths[path] = {
      [methodKey]: {
        tags: methodConfig.tags || [],
        summary: methodConfig.summary || '',
        parameters,
        ...(requestBody && { requestBody }),
        responses,
      },
    };
  });

  return swaggerPaths
}

/**
 * Collect parameters from methodConfig.headers and methodConfig.query,
 * referencing #/components/parameters/<refName>.
 */
function collectParameters(methodConfig, paramNameToRefName) {
  const parameters = [];

  // HEADERS
  if (
    methodConfig.headers &&
    typeof methodConfig.headers.describe === 'function'
  ) {
    const headerKeys = Object.keys(methodConfig.headers.describe().keys || {});
    headerKeys.forEach((k) => {
      const refName = paramNameToRefName[k] || k;
      parameters.push({ $ref: `#/components/parameters/${refName}` });
    });
  }

  // QUERY
  if (methodConfig.query && typeof methodConfig.query.describe === 'function') {
    const queryKeys = Object.keys(methodConfig.query.describe().keys || {});
    queryKeys.forEach((k) => {
      const refName = paramNameToRefName[k] || k;
      parameters.push({ $ref: `#/components/parameters/${refName}` });
    });
  }

  return parameters
}

/**
 * Build the requestBody if methodConfig.body exists.
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

  const content = {};
  Object.entries(bodyConfig.content).forEach(([mimeType, cfg]) => {
    const joiSchema = cfg.schema;
    const schemaName = getSchemaNameFromObj(
      joiSchema,
      swaggerComponents.schemas,
      schemaMap,
      convertedSchemasMap
    );

    content[mimeType] = {
      schema: { $ref: `#/components/schemas/${schemaName}` },
    };
  });

  return {
    description: bodyConfig.description || '',
    required: !!bodyConfig.required,
    content,
  }
}

/**
 * Build the responses for each status code in methodConfig.responses.
 */
function buildResponses(
  responsesConfig,
  swaggerComponents,
  schemaMap,
  convertedSchemasMap
) {
  const responses = {};
  if (!responsesConfig) {
    return responses
  }

  Object.entries(responsesConfig).forEach(([statusCode, responseObj]) => {
    const { description, content } = responseObj;
    const builtContent = {};

    if (content) {
      Object.entries(content).forEach(([mimeType, subObj]) => {
        const { schema: joiSchema, examples } = subObj;
        const schemaName = getSchemaNameFromObj(
          joiSchema,
          swaggerComponents.schemas,
          schemaMap,
          convertedSchemasMap
        );

        builtContent[mimeType] = {
          schema: { $ref: `#/components/schemas/${schemaName}` },
        };

        // If the user included `examples`, attach them
        if (examples) {
          builtContent[mimeType].examples = examples;
        }
      });
    }

    responses[statusCode] = {
      description,
      content: builtContent,
    };
  });

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
  const convertedSchema = parse(joiSchema).swagger;
  const str = JSON.stringify(convertedSchema);

  // If we already have an identical shape
  if (convertedSchemasMap.has(str)) {
    const existingName = convertedSchemasMap.get(str);
    // Link our current joi object to that name
    schemaMap.set(joiSchema, existingName);
    return existingName
  }

  // Attempt to use the label from `.label(...)`
  const chosenName = convertedSchema.title; // might be undefined if no label

  if (!chosenName) {
    throw new Error(
      'Encountered a Joi schema without a label. ' +
        'Please define a label() or define the schema in static schemas() for reuse.'
    )
  }

  // If the label is already used in 'schemasObj'
  if (chosenName && schemasObj[chosenName]) {
    // We have to check if the shape is truly the same
    const existingSchema = schemasObj[chosenName];
    const existingStr = JSON.stringify(existingSchema);

    if (existingStr === str) {
      // Exactly the same shape => reuse
      schemaMap.set(joiSchema, chosenName);
      convertedSchemasMap.set(str, chosenName);
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
  delete convertedSchema.title;

  // Register in swagger components
  schemasObj[chosenName] = convertedSchema;
  schemaMap.set(joiSchema, chosenName);
  convertedSchemasMap.set(str, chosenName);

  return chosenName
}

exports.RouteSchema = RouteSchema;
exports.schemaToSwagger = schemaToSwagger;
exports.validateRequest = validateRequest;
