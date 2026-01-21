import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StockVideo {
  id: string;
  thumbnailUrl: string;
  previewUrl: string;
  downloadUrl: string;
  duration: number;
  width: number;
  height: number;
  source: 'pexels';
  attribution: string;
}

interface SearchResult {
  videos: StockVideo[];
  totalResults: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

interface SearchState {
  isLoading: boolean;
  results: StockVideo[];
  totalResults: number;
  page: number;
  hasMore: boolean;
  lastQuery: string;
}

export function useStockFootage() {
  const [state, setState] = useState<SearchState>({
    isLoading: false,
    results: [],
    totalResults: 0,
    page: 1,
    hasMore: false,
    lastQuery: '',
  });

  const searchVideos = useCallback(async (
    query: string, 
    options?: { 
      page?: number; 
      perPage?: number; 
      append?: boolean;
      orientation?: 'landscape' | 'portrait' | 'square';
    }
  ) => {
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return [];
    }

    const { page = 1, perPage = 6, append = false, orientation = 'landscape' } = options || {};

    setState(prev => ({ 
      ...prev, 
      isLoading: true,
      lastQuery: query,
    }));

    try {
      const { data, error } = await supabase.functions.invoke<SearchResult>('search-stock-footage', {
        body: { query, page, perPage, orientation },
      });

      if (error) throw error;
      if (!data) throw new Error('No data returned');

      setState(prev => ({
        isLoading: false,
        results: append ? [...prev.results, ...data.videos] : data.videos,
        totalResults: data.totalResults,
        page: data.page,
        hasMore: data.hasMore,
        lastQuery: query,
      }));

      return data.videos;
    } catch (error) {
      console.error('Stock footage search error:', error);
      toast.error('Failed to search stock footage');
      setState(prev => ({ ...prev, isLoading: false }));
      return [];
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.isLoading || !state.lastQuery) return;
    
    await searchVideos(state.lastQuery, {
      page: state.page + 1,
      append: true,
    });
  }, [state.hasMore, state.isLoading, state.lastQuery, state.page, searchVideos]);

  const clearResults = useCallback(() => {
    setState({
      isLoading: false,
      results: [],
      totalResults: 0,
      page: 1,
      hasMore: false,
      lastQuery: '',
    });
  }, []);

  return {
    ...state,
    searchVideos,
    loadMore,
    clearResults,
  };
}
