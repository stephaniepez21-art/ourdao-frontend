import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { backend } from '@/lib/backend'

export interface AdminAuditLogEntry {
  id: string | number
  action: string
  actor: string | null
  target?: string | null
  timestamp: number | string
}

const fetchAdminLog = backend.getAdminLog as unknown as (
  page: number,
  pageSize: number
) => Promise<AdminAuditLogEntry[]>

export function useAdminAuditLog(pageSize = 10) {
  const { data, isLoading, error, hasNextPage, fetchNextPage, refetch } = useInfiniteQuery({
    queryKey: ['adminAuditLog', pageSize],
    queryFn: ({ pageParam }) => fetchAdminLog(pageParam, pageSize),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPage.length === pageSize ? lastPageParam + 1 : undefined,
  })

  const entries = data?.pages.flat() ?? []

  const loadMore = useCallback(() => {
    if (!hasNextPage || isLoading) return
    void fetchNextPage()
  }, [fetchNextPage, hasNextPage, isLoading])

  return {
    entries,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Failed to load audit log') : null,
    hasMore: !!hasNextPage,
    loadMore,
    refetch,
  }
}
