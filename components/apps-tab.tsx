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
import { useWalletStore, AppCard as AppCardType } from '@/lib/store/wallet';
import { t } from '@/lib/i18n';
import React from 'react';

export function AppsTab() {
  const { apps } = useWalletStore();
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

  const handleLoadMore = () => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentPage((prev) => Math.min(prev + 1, totalPages));
      setIsLoading(false);
    }, 600);
  };

  return (
    <div className='w-full space-y-6 animate-fade-in'>
      {/* Search and Filters */}
      <div className='space-y-4 max-w-2xl'>
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

      {/* Apps List */}
      {isLoading ? (
        <SkeletonList count={4} />
      ) : paginatedApps.length > 0 ? (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl'>
          {paginatedApps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              layout='list'
              onClick={() => handleAppClick(app)}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No integrations found"
          description="Try clearing your search query or choosing another category filter."
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="max-w-2xl">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            onLoadMore={handleLoadMore}
            isLoading={isLoading}
          />
        </div>
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
