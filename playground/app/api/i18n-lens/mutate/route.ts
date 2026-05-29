import { createI18nLensHandler } from 'next-i18n-lens/server';
import * as path from 'path';

const handler = createI18nLensHandler({
  localesPath: path.resolve('./locales'), // Adjust relative to project root
});

export const GET = handler;
export const POST = handler;
export const OPTIONS = handler;
