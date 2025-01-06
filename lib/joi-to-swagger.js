// CConversion library for transforming joi schema objects into swagger/OpenApi OAS 3.0 schema definitions.
'use strict'

import Joi from 'joi'
import _ from 'lodash'

const { isRef, object: _object, isSchema } = Joi

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
} = _

/**
 * Predefined regex patterns for string validations.
 */
const patterns = {
  alphanum: '^[a-zA-Z0-9]*$',
  alphanumLower: '^[a-z0-9]*$',
  alphanumUpper: '^[A-Z0-9]*$',
  token: '^[a-zA-Z0-9_]*$',
}

/**
 * Extracts metadata from a Joi schema.
 *
 * @param {Joi.Schema} schema - The Joi schema.
 * @param {string} key - The metadata key to retrieve.
 * @returns {*} The value associated with the metadata key.
 */
function meta(schema, key) {
  const flattened = Object.assign.apply(null, [{}].concat(schema.$_terms.metas))
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
  const swagger = {}
  for (let i = 0; i < schema._rules.length; i++) {
    const rule = schema._rules[i]
    if (rule.name === 'min') {
      swagger[`min${suffix}`] = rule.args.limit
    }

    if (rule.name === 'max') {
      swagger[`max${suffix}`] = rule.args.limit
    }

    if (rule.name === 'length') {
      swagger[`min${suffix}`] = rule.args.limit
      swagger[`max${suffix}`] = rule.args.limit
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
  const caseRule = find(schema._rules, { name: 'case' })
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
  const whens = get(schema, '$_terms.whens')
  const mode = whens.length > 1 ? 'anyOf' : 'oneOf'

  const alternatives = []
  for (const w of whens) {
    if (w.then) {
      alternatives.push(w.then)
    }
    if (w.otherwise) {
      alternatives.push(w.otherwise)
    }
    if (w.switch) {
      for (const s of w.switch) {
        if (s.then) {
          alternatives.push(s.then)
        }
        if (s.otherwise) {
          alternatives.push(s.otherwise)
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
  let swaggers = []
  for (const joiSchema of alternatives) {
    const { swagger, components } = parse(
      joiSchema,
      merge({}, existingComponents || {}, newComponentsByRef || {})
    )
    if (!swagger) {
      continue
    } // swagger is falsy if joi.forbidden()
    if (get(joiSchema, '_flags.presence') === 'required') {
      swagger['x-required'] = true
    }
    merge(newComponentsByRef, components || {})

    swaggers.push(swagger)
  }
  swaggers = uniqWith(swaggers, isEqual)

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
  const swagger = {}
  if (schema._valids) {
    const valids = schema._valids.values().filter(filterFunc)
    if (get(schema, '_flags.only') && valids.length) {
      swagger.enum = valids
    }
  }

  if (schema._invalids) {
    const invalids = schema._invalids.values().filter(filterFunc)
    if (invalids.length) {
      swagger.not = { enum: invalids }
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
  const refValues = meta(schema, 'refValues') || {}
  const refKey = ref.toString().replace(/^ref:/, '')
  return refValues[refKey] || fallback
}

/**
 * Parsers for different Joi types to Swagger schema.
 */
const parseAsType = {
  number: (schema) => {
    const swagger = {}

    if (find(schema._rules, { name: 'integer' })) {
      swagger.type = 'integer'
    } else {
      swagger.type = 'number'
      if (find(schema._rules, { name: 'precision' })) {
        swagger.format = 'double'
      } else {
        swagger.format = 'float'
      }
    }

    const sign = find(schema._rules, { name: 'sign' })
    if (sign) {
      if (sign.args.sign === 'positive') {
        swagger.minimum = 1
      } else if (sign.args.sign === 'negative') {
        swagger.maximum = -1
      }
    }

    const min = find(schema._rules, { name: 'min' })
    if (min) {
      swagger.minimum = isRef(min.args.limit)
        ? getRefValue(min.args.limit, schema, 0)
        : min.args.limit
    }

    const max = find(schema._rules, { name: 'max' })
    if (max) {
      swagger.maximum = isRef(max.args.limit)
        ? getRefValue(max.args.limit, schema, 0)
        : max.args.limit
    }

    Object.assign(
      swagger,
      parseValidsAndInvalids(schema, (s) => isNumber(s))
    )

    return swagger
  },
  string: (schema) => {
    const swagger = { type: 'string' }

    if (find(schema._rules, { name: 'alphanum' })) {
      const strict = get(schema, '_preferences.convert') === false
      swagger.pattern =
        patterns[`alphanum${strict ? getCaseSuffix(schema) : ''}`]
    }

    if (find(schema._rules, { name: 'token' })) {
      swagger.pattern = patterns.token
    }

    if (find(schema._rules, { name: 'email' })) {
      swagger.format = 'email'
      if (swagger.pattern) {
        delete swagger.pattern
      }
    }

    if (find(schema._rules, { name: 'isoDate' })) {
      swagger.format = 'date-time'
      if (swagger.pattern) {
        delete swagger.pattern
      }
    }

    if (find(schema._rules, { name: 'guid' })) {
      swagger.format = 'uuid'
      if (swagger.pattern) {
        delete swagger.pattern
      }
    }

    const pattern = find(schema._rules, { name: 'pattern' })
    if (pattern) {
      swagger.pattern = pattern.args.regex.toString().slice(1, -1)
    }

    Object.assign(swagger, getMinMax(schema))
    Object.assign(
      swagger,
      parseValidsAndInvalids(schema, (s) => isString(s))
    )

    return swagger
  },
  binary: (schema) => {
    const swagger = { type: 'string', format: 'binary' }

    if (get(schema, '_flags.encoding') === 'base64') {
      swagger.format = 'byte'
    }

    Object.assign(swagger, getMinMax(schema))

    return swagger
  },
  date: (schema) => {
    const swagger = { type: 'string', format: 'date-time' }
    if (get(schema, '_flags.format') === 'YYYY-MM-DD') {
      swagger.format = 'date'
    }
    return swagger
  },
  boolean: (/* schema */) => ({ type: 'boolean' }),
  alternatives: (schema, existingComponents, newComponentsByRef) => {
    const matches = get(schema, '$_terms.matches')
    const mode = `${get(schema, '_flags.match') || 'any'}Of`

    const alternatives = []
    for (const m of matches) {
      if (m.ref) {
        if (m.then) {
          alternatives.push(m.then)
        }
        if (m.otherwise) {
          alternatives.push(m.otherwise)
        }
        if (m.switch) {
          for (const s of m.switch) {
            if (s.then) {
              alternatives.push(s.then)
            }
            if (s.otherwise) {
              alternatives.push(s.otherwise)
            }
          }
        }
      } else {
        alternatives.push(m.schema)
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
    const items = get(schema, '$_terms.items')
    const mode = 'oneOf'

    const alternatives = items

    let swaggers = []
    for (const joiSchema of alternatives) {
      const { swagger, components } = parse(
        joiSchema,
        merge({}, existingComponents || {}, newComponentsByRef || {})
      )
      if (!swagger) {
        continue
      } // swagger is falsy if joi.forbidden()

      merge(newComponentsByRef, components || {})

      swaggers.push(swagger)
    }
    swaggers = uniqWith(swaggers, isEqual)

    const openapi = {
      type: 'array',
      items: { [mode]: swaggers },
    }
    if (swaggers.length <= 1) {
      openapi.items = get(swaggers, [0]) || {}
    }

    Object.assign(openapi, getMinMax(schema, 'Items'))

    if (find(schema._rules, { name: 'unique' })) {
      openapi.uniqueItems = true
    }

    return openapi
  },
  object: (schema, existingComponents, newComponentsByRef) => {
    const requireds = []
    const properties = {}
    let additionalProperties = {}

    const combinedComponents = merge(
      {},
      existingComponents || {},
      newComponentsByRef || {}
    )

    const children = get(schema, '$_terms.keys') || []
    children.forEach((child) => {
      const key = child.key
      const { swagger, components } = parse(child.schema, combinedComponents)
      if (!swagger) {
        // swagger is falsy if joi.forbidden()
        return
      }

      merge(newComponentsByRef, components || {})
      merge(combinedComponents, components || {})

      properties[key] = swagger

      if (get(child, 'schema._flags.presence') === 'required') {
        requireds.push(key)
      }
    })

    if (!children.length) {
      const keyPatterns = get(schema, '$_terms.patterns')
      if (keyPatterns) {
        keyPatterns.forEach((pattern) => {
          if (pattern.rule) {
            const { swagger, components } = parse(
              pattern.rule,
              combinedComponents
            )
            if (!swagger) {
              // swagger is falsy if joi.forbidden()
              return
            }

            merge(newComponentsByRef, components || {})
            merge(combinedComponents, components || {})

            additionalProperties = swagger
          }
        })
      }
    }

    const swagger = {
      type: 'object',
      properties,
    }
    if (requireds.length) {
      swagger.required = requireds
    }

    if (get(schema, '_flags.unknown') !== true) {
      swagger.additionalProperties = false
    }

    if (Object.keys(additionalProperties).length !== 0) {
      swagger.additionalProperties = additionalProperties
    }

    return swagger
  },
  any: (schema) => {
    const swagger = {}
    // convert property to file upload, if indicated by meta property
    if (meta(schema, 'swaggerType') === 'file') {
      swagger.type = 'file'
      swagger.in = 'formData'
    }

    Object.assign(
      swagger,
      parseValidsAndInvalids(schema, (s) => isString(s) || isNumber(s))
    )

    return swagger
  },
}

/**
 * Parses a Joi schema into Swagger/OpenAPI schema definitions.
 *
 * @param {joi.Schema|object} schema - The Joi schema or a plain object to be converted to a Joi object schema.
 * @param {object} [existingComponents={}] - Existing Swagger components to reference.
 * @param {boolean} [isSchemaOverride=false] - Indicates if the current schema is an override.
 * @returns {object|false} An object containing the Swagger schema and components or false if the schema is forbidden.
 * @throws {Error} If no schema is provided or schema is invalid.
 */
export function parse(
  schema,
  existingComponents = {},
  isSchemaOverride = false
) {
  if (!schema) {
    throw new Error('No schema was passed.')
  }

  if (isPlainObject(schema)) {
    schema = _object().keys(schema)
  }

  if (!isSchema(schema)) {
    throw new TypeError('Passed schema does not appear to be a joi schema.')
  }

  const flattenMeta = Object.assign.apply(
    null,
    [{}].concat(schema.$_terms.metas)
  )

  const schemaOverride = flattenMeta.schemaOverride
  if (schemaOverride) {
    if (isSchemaOverride) {
      throw new Error(
        'Cannot override the schema for one which is being used in another override (no nested schema overrides).'
      )
    }
    return parse(schemaOverride, existingComponents, true)
  }

  const components = {}
  const metaDefName = flattenMeta.className
  const metaDefType = flattenMeta.classTarget || 'schemas'

  const getReturnValue = (swagger) => {
    if (metaDefName) {
      set(components, [metaDefType, metaDefName], swagger)
      return { swagger: refDef(metaDefType, metaDefName), components }
    }

    return { swagger, components }
  }

  const override = flattenMeta.swagger
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

  const type = meta(schema, 'baseType') || schema.type

  if (!parseAsType[type]) {
    throw new TypeError(`${type} is not a recognized Joi type.`)
  }

  const swagger = parseAsType[type](schema, existingComponents, components)
  if (get(schema, '$_terms.whens')) {
    Object.assign(swagger, parseWhens(schema, existingComponents, components))
  }

  if (schema._valids && schema._valids.has(null)) {
    swagger.nullable = true
  }

  const description = get(schema, '_flags.description')
  if (description) {
    swagger.description = description
  }

  if (schema.$_terms.examples) {
    if (schema.$_terms.examples.length === 1) {
      swagger.example = schema.$_terms.examples[0]
    } else {
      swagger.examples = schema.$_terms.examples
    }
  }

  const label = get(schema, '_flags.label')
  if (label) {
    swagger.title = label
  }

  const defaultValue = get(schema, '_flags.default')
  if (
    (defaultValue || typeof defaultValue === 'boolean') &&
    typeof defaultValue !== 'function'
  ) {
    swagger.default = defaultValue
  }

  if (override) {
    Object.assign(swagger, override)
  }

  return getReturnValue(swagger)
}
