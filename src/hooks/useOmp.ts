import { useQuery } from "@tanstack/react-query";
import { providersApi } from "@/lib/api";

/**
 * Centralized query keys for all OMP-related queries.
 */
export const ompKeys = {
  all: ["omp"] as const,
  liveProviderIds: ["omp", "liveProviderIds"] as const,
};

/**
 * Hook to fetch OMP live provider IDs from models.yml.
 * Used to determine which providers are already in the live config.
 */
export function useOmpLiveProviderIds(enabled: boolean) {
  return useQuery({
    queryKey: ompKeys.liveProviderIds,
    queryFn: () => providersApi.getOmpLiveProviderIds(),
    enabled,
  });
}
