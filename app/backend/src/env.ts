import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET muss mindestens 16 Zeichen lang sein'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3001'),
  APP_BASE_URL: z.string().url().default('http://localhost:3001'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Ungültige Environment-Variablen:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
