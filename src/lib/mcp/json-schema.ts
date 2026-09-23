import { z } from 'zod';

/**
 * Conversion minima de un esquema zod a JSON Schema, para declarar los
 * argumentos de cada herramienta MCP con la misma fuente que los valida.
 * Cubre solo los tipos que usan las herramientas.
 */
export function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const description = schema.description ? { description: schema.description } : {};
  const def = schema._def as { typeName: z.ZodFirstPartyTypeKind };

  switch (def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = toJsonSchema(value as z.ZodTypeAny);
        if (!(value as z.ZodTypeAny).isOptional()) required.push(key);
      }
      return {
        type: 'object',
        properties,
        ...(required.length ? { required } : {}),
        additionalProperties: false,
        ...description,
      };
    }
    case z.ZodFirstPartyTypeKind.ZodString: {
      const out: Record<string, unknown> = { type: 'string', ...description };
      for (const check of (schema as z.ZodString)._def.checks) {
        if (check.kind === 'min') out.minLength = check.value;
        if (check.kind === 'max') out.maxLength = check.value;
        if (check.kind === 'regex') out.pattern = check.regex.source;
      }
      return out;
    }
    case z.ZodFirstPartyTypeKind.ZodNumber: {
      const out: Record<string, unknown> = { type: 'number', ...description };
      for (const check of (schema as z.ZodNumber)._def.checks) {
        if (check.kind === 'int') out.type = 'integer';
        if (check.kind === 'min') out[check.inclusive ? 'minimum' : 'exclusiveMinimum'] = check.value;
        if (check.kind === 'max') out[check.inclusive ? 'maximum' : 'exclusiveMaximum'] = check.value;
      }
      return out;
    }
    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return { type: 'boolean', ...description };
    case z.ZodFirstPartyTypeKind.ZodEnum:
      return { type: 'string', enum: (schema as z.ZodEnum<[string]>).options, ...description };
    case z.ZodFirstPartyTypeKind.ZodArray:
      return {
        type: 'array',
        items: toJsonSchema((schema as z.ZodArray<z.ZodTypeAny>).element),
        ...description,
      };
    case z.ZodFirstPartyTypeKind.ZodRecord:
      return {
        type: 'object',
        additionalProperties: toJsonSchema((schema as z.ZodRecord)._def.valueType),
        ...description,
      };
    case z.ZodFirstPartyTypeKind.ZodOptional:
      return { ...toJsonSchema((schema as z.ZodOptional<z.ZodTypeAny>).unwrap()), ...description };
    case z.ZodFirstPartyTypeKind.ZodDefault: {
      const inner = (schema as z.ZodDefault<z.ZodTypeAny>)._def;
      return { ...toJsonSchema(inner.innerType), default: inner.defaultValue(), ...description };
    }
    case z.ZodFirstPartyTypeKind.ZodEffects:
      return { ...toJsonSchema((schema as z.ZodEffects<z.ZodTypeAny>).innerType()), ...description };
    case z.ZodFirstPartyTypeKind.ZodUnion:
      return {
        anyOf: (schema as z.ZodUnion<[z.ZodTypeAny]>).options.map(toJsonSchema),
        ...description,
      };
    default:
      return { ...description };
  }
}
