'use client';

/**
 * Language hook — simplified to English-only for RampFi.
 * Kept for backward compatibility with settings-tab.
 */
export const useLanguage = () => {
  return {
    language: 'en' as const,
    setLanguage: (_lang: string) => {
      // No-op — RampFi is English-only
    },
  };
};
