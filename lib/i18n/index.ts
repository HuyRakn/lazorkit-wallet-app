import en from './en.json';

export type TranslationKey = string;

/**
 * Simple English-only translation function.
 * The i18n system has been simplified to English-only for RampFi.
 */
export const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
  const keys = key.split('.');
  let value: unknown = en;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return key;
    }
  }

  if (typeof value !== 'string') return key;

  if (params) {
    return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, p1) => {
      const v = params[p1 as keyof typeof params];
      return v !== undefined && v !== null ? String(v) : '';
    });
  }
  return value;
};
