'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card' | 'chart';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
}: SkeletonProps) {
  const baseClass = 'skeleton animate-pulse';

  const variantStyles: Record<string, string> = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
    card: 'rounded-xl',
    chart: 'rounded-xl',
  };

  return (
    <div
      className={`${baseClass} ${variantStyles[variant]} ${className}`}
      style={{ width, height }}
    />
  );
}

/** Card skeleton with title + 3 lines */
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`glass-card rounded-xl p-4 space-y-3 ${className}`}>
      <div className='flex items-center gap-3'>
        <Skeleton variant='circular' width={40} height={40} />
        <div className='flex-1 space-y-2'>
          <Skeleton variant='text' className='w-1/3' />
          <Skeleton variant='text' className='w-1/2 h-3' />
        </div>
      </div>
      <Skeleton variant='text' className='w-full' />
      <Skeleton variant='text' className='w-4/5' />
    </div>
  );
}

/** Feed skeleton: multiple cards stacked */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className='space-y-4'>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Chart skeleton with header and chart area */
export function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`glass-card rounded-xl p-4 space-y-3 ${className}`}>
      <div className='flex items-center justify-between'>
        <Skeleton variant='text' className='w-1/4 h-5' />
        <div className='flex gap-2'>
          <Skeleton variant='rectangular' width={40} height={24} />
          <Skeleton variant='rectangular' width={40} height={24} />
          <Skeleton variant='rectangular' width={40} height={24} />
        </div>
      </div>
      <Skeleton variant='chart' className='w-full' height={200} />
    </div>
  );
}

/** Token list skeleton */
export function TokenListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className='space-y-2'>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className='flex items-center gap-3 p-3 rounded-lg'>
          <Skeleton variant='circular' width={36} height={36} />
          <div className='flex-1 space-y-1.5'>
            <Skeleton variant='text' className='w-16' />
            <Skeleton variant='text' className='w-24 h-3' />
          </div>
          <div className='text-right space-y-1.5'>
            <Skeleton variant='text' className='w-20 ml-auto' />
            <Skeleton variant='text' className='w-12 h-3 ml-auto' />
          </div>
        </div>
      ))}
    </div>
  );
}
