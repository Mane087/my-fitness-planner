import { z } from 'zod';

export const idSchema = z.string().trim().min(1, 'El identificador es requerido.');

export const isoDateTimeSchema = z.iso.datetime({
  error: 'La fecha y hora deben usar formato ISO 8601.',
});

export const dateOnlySchema = z.iso.date({ error: 'La fecha debe usar el formato YYYY-MM-DD.' });

export const auditFieldsShape = {
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
};

export const secondsSchema = z
  .number()
  .int('Los segundos deben ser un número entero.')
  .positive('La duración debe ser mayor que cero.');

export const metersSchema = z
  .number()
  .int('Los metros deben ser un número entero.')
  .positive('La distancia debe ser mayor que cero.');
