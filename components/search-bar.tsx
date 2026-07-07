'use client';

import { Search } from 'lucide-react';
import { Input } from './ui/input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar = ({
  value,
  onChange,
  placeholder,
  className,
}: SearchBarProps) => {
  return (
    <div className={`relative w-full ${className}`}>
      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-12 pl-12 pr-4 bg-slate-950/60 hover:bg-slate-950/80 focus:bg-slate-950 border border-white/5 hover:border-white/15 focus:border-primary/50 text-white rounded-xl placeholder:text-muted-foreground/60 text-sm focus:outline-none transition-all duration-300 shadow-lg shadow-black/20 focus:shadow-primary/5"
      />
    </div>
  );
};
