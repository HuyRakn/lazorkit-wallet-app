'use client';

import { AppHeader } from '@/components/app-header';
import { AppsTab } from '@/components/apps-tab';
import { t } from '@/lib/i18n';
import React from 'react';

export default function AppsPage() {
  return (
    <div className='min-h-screen bg-background flex flex-col pb-16'>
      <AppHeader />
      <main className='container mx-auto px-4 py-8 max-w-4xl flex-1'>
        <div className='space-y-6'>
          {/* Header */}
          <div className='space-y-1.5'>
            <h1 className='text-3xl font-extrabold tracking-tight text-foreground'>{t('apps.title')}</h1>
            <p className='text-sm text-muted-foreground'>{t('app.prototype')}</p>
          </div>

          <AppsTab />
        </div>
      </main>
    </div>
  );
}
