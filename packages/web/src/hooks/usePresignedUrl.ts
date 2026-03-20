import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { queryKeys } from "../lib/query-keys";

export function usePresignedUrl(fileId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.files.download(fileId ?? ""),
    queryFn: async () => {
      const res = await api.get<{ url: string }>(`/api/files/${fileId}/download`);
      return (res as any).url as string;
    },
    enabled: enabled && !!fileId,
    staleTime: 45 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
