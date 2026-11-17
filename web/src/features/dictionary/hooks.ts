import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveDefinition,
  createDefinition,
  deactivateDefinition,
  getDefinition,
  listColumns,
  listDefinitions,
  listRelations,
  updateDefinition,
  type CreateDefinition,
  type UpdateDefinition,
} from '@/api/semantic';
import { auditKey } from '@/shared/AuditTimeline';

export const keys = {
  definitions: (ds: string) => ['definitions', ds] as const,
  definition: (ds: string, id: string) => ['definition', ds, id] as const,
  relations: (ds: string) => ['relations', ds] as const,
  columns: (ds: string, relationId: string) => ['columns', ds, relationId] as const,
};

/** Every definition of the source (all states): the list, names of concepts and dependencies come from it. */
export function useDefinitions(dataSourceId: string | undefined) {
  return useQuery({
    queryKey: keys.definitions(dataSourceId ?? ''),
    queryFn: () => listDefinitions(dataSourceId as string),
    enabled: !!dataSourceId,
  });
}

export function useDefinition(dataSourceId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: keys.definition(dataSourceId ?? '', id ?? ''),
    queryFn: () => getDefinition(dataSourceId as string, id as string),
    enabled: !!dataSourceId && !!id,
  });
}

export function useRelations(dataSourceId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: keys.relations(dataSourceId ?? ''),
    queryFn: () => listRelations(dataSourceId as string),
    enabled: enabled && !!dataSourceId,
    staleTime: 5 * 60_000,
  });
}

export function useColumns(dataSourceId: string | undefined, relationId: string | undefined) {
  return useQuery({
    queryKey: keys.columns(dataSourceId ?? '', relationId ?? ''),
    queryFn: () => listColumns(dataSourceId as string, relationId as string),
    enabled: !!dataSourceId && !!relationId,
    staleTime: 5 * 60_000,
  });
}

/** After any change, the list, the definition and its history are read again from Semantic (never assumed). */
function useRefresh(dataSourceId: string) {
  const client = useQueryClient();
  return (id?: string) => {
    void client.invalidateQueries({ queryKey: keys.definitions(dataSourceId) });
    if (id) {
      void client.invalidateQueries({ queryKey: keys.definition(dataSourceId, id) });
      void client.invalidateQueries({ queryKey: auditKey('SEMANTIC_DEFINITION', id) });
    }
  };
}

export function useCreateDefinition(dataSourceId: string) {
  const refresh = useRefresh(dataSourceId);
  return useMutation({
    mutationFn: (body: CreateDefinition) => createDefinition(dataSourceId, body),
    onSuccess: (r) => refresh(r.data.id),
  });
}

export function useUpdateDefinition(dataSourceId: string) {
  const refresh = useRefresh(dataSourceId);
  return useMutation({
    mutationFn: (v: { id: string; etag: string; body: UpdateDefinition }) => updateDefinition(dataSourceId, v.id, v.etag, v.body),
    onSettled: (_r, _e, v) => refresh(v.id),
  });
}

export function useApproveDefinition(dataSourceId: string) {
  const refresh = useRefresh(dataSourceId);
  return useMutation({
    mutationFn: (v: { id: string; etag: string }) => approveDefinition(dataSourceId, v.id, v.etag),
    onSettled: (_r, _e, v) => refresh(v.id),
  });
}

export function useDeactivateDefinition(dataSourceId: string) {
  const refresh = useRefresh(dataSourceId);
  return useMutation({
    mutationFn: (v: { id: string; etag: string; reason: string }) => deactivateDefinition(dataSourceId, v.id, v.etag, v.reason),
    onSettled: (_r, _e, v) => refresh(v.id),
  });
}
