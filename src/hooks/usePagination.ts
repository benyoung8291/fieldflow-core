import { useState } from 'react';

interface UsePaginationProps {
  initialPageSize?: number;
}

export function usePagination({ initialPageSize = 50 }: UsePaginationProps = {}) {
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(0);

  const getRange = () => {
    const from = currentPage * pageSize;
    const to = from + pageSize - 1;
    return { from, to };
  };

  const nextPage = () => setCurrentPage(prev => prev + 1);
  const prevPage = () => setCurrentPage(prev => Math.max(0, prev - 1));
  const goToPage = (page: number) => setCurrentPage(Math.max(0, page));
  const resetPage = () => setCurrentPage(0);

  return {
    pageSize,
    setPageSize,
    currentPage,
    nextPage,
    prevPage,
    goToPage,
    resetPage,
    getRange,
  };
}
