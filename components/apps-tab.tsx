'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, Grid, List, ChevronDown } from 'lucide-react';
import { AppCard } from '@/components/app-card';
import { AppDetailModal } from '@/components/app-detail-modal';
import { SearchBar } from '@/components/search-bar';
import { FiltersBar } from '@/components/filters-bar';
import { Pagination } from '@/components/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { ECOSYSTEM_APPS, AppCard as AppCardType } from '@/lib/store/wallet';
import { t } from '@/lib/i18n';
import React from 'react';

export function AppsTab() {
  const apps = ECOSYSTEM_APPS;
  const [selectedApp, setSelectedApp] = useState<AppCardType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>('popularity');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const itemsPerPage = 6;

  // initial skeleton delay 400–800ms
  useEffect(() => {
    const delay = 300 + Math.floor(Math.random() * 300);
    const id = setTimeout(() => setIsLoading(false), delay);
    return () => clearTimeout(id);
  }, []);

  // Filter and search apps
  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.intro.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.tags.some((tag) =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesCategory =
      selectedCategory === 'all' ||
      app.category.toLowerCase() === selectedCategory;
    const matchesVerified = !verifiedOnly || app.verified;

    return matchesSearch && matchesCategory && matchesVerified;
  });

  // Sort apps
  const sortedApps = [...filteredApps].sort((a, b) => {
    switch (sortBy) {
      case 'alphabetical':
        return a.name.localeCompare(b.name);
      case 'newest':
        return b.id.localeCompare(a.id);
      case 'popularity':
      default:
        return (b.verified ? 1 : 0) - (a.verified ? 1 : 0);
    }
  });

  // Paginate apps
  const totalPages = Math.ceil(sortedApps.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedApps = sortedApps.slice(startIndex, startIndex + itemsPerPage);

  const handleAppClick = (app: AppCardType) => {
    setSelectedApp(app);
  };

  return (
    <div className="w-full space-y-5 animate-fade-in pb-4">
      {/* Search and Filters */}
      <div className="space-y-2.5 w-full max-w-7xl mx-auto">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search ecosystem integrations..."
        />

        <FiltersBar
          category={selectedCategory}
          onCategoryChange={setSelectedCategory}
          verifiedOnly={verifiedOnly}
          onVerifiedChange={setVerifiedOnly}
          sortBy={sortBy}
          onSortChange={setSortBy}
        />
      </div>

      {/* Main Apps Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
          {Array.from({ length: itemsPerPage }).map((_, idx) => (
            <SkeletonList key={idx} />
          ))}
        </div>
      ) : filteredApps.length === 0 ? (
        <EmptyState
          title="No integrations found"
          description="Try adjusting your filters or search term to find what you're looking for."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto">
            {paginatedApps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                layout="list"
                onClick={() => setSelectedApp(app)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="w-full flex justify-center pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}

      {/* App Detail Modal */}
      {selectedApp && (
        <AppDetailModal
          app={selectedApp}
          open={!!selectedApp}
          onOpenChange={(open) => !open && setSelectedApp(null)}
        />
      )}
    </div>
  );
}
