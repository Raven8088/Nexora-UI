import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveRelationship,
  createRelationship,
  createRelationshipFromForeignKey,
  deactivateRelationship,
  getRelationship,
  listRelationships,
  relationshipCandidates,
  updateRelationship,
  type CreateFromForeignKey,
  type CreateRelationship,
  type UpdateRelationship,
} from '@/api/semantic';
import { auditKey } from '@/shared/AuditTimeline';

export const relationshipKeys = {
  list: (ds: string) => ['relationships', ds] as const,
  one: (ds: string, id: string) => ['relationship', ds, id] as const,
  candidates: (ds: string, objectId: string) => ['relationship-candidates', ds, objectId] as const,
};

/** Every relationship of the source (all states): the list is searched and filtered in the browser. */
export function useRelationships(dataSourceId: string | undefined) {
  return useQuery({
    queryKey: relationshipKeys.list(dataSourceId ?? ''),
    queryFn: () => listRelationships(dataSourceId as string),
    enabled: !!dataSourceId,
  });
}

export function useRelationship(dataSourceId: string | undefined, id: string | undefined) {
  return useQuery({
    queryKey: relationshipKeys.one(dataSourceId ?? '', id ?? ''),
    queryFn: () => getRelationship(dataSourceId as string, id as string),
    enabled: !!dataSourceId && !!id,
  });
}

/** Candidates are computed by Semantic on each call (nothing is stored): only when the person asks for them. */
export function useCandidates(dataSourceId: string, objectId: string, enabled: boolean) {
  return useQuery({
    queryKey: relationshipKeys.candidates(dataSourceId, objectId),
    queryFn: () => relationshipCandidates(dataSourceId, objectId || undefined),
    enabled,
    staleTime: 60_000,
  });
}

/** After any change, the list, the relationship and its history are read again from Semantic (never assumed). */
function useRefresh(dataSourceId: string) {
  const client = useQueryClient();
  return (id?: string) => {
    void client.invalidateQueries({ queryKey: relationshipKeys.list(dataSourceId) });
    void client.invalidateQueries({ queryKey: ['relationship-candidates', dataSourceId] });
    if (id) {
      void client.invalidateQueries({ queryKey: relationshipKeys.one(dataSourceId, id) });
      void client.invalidateQueries({ queryKey: auditKey('SEMANTIC_RELATIONSHIP', id) });
    }
  };
}

export function useCreateRelationship(dataSourceId: string) {
  const refresh = useRefresh(dataSourceId);
  return useMutation({
    mutationFn: (body: CreateRelationship) => createRelationship(dataSourceId, body),
    onSuccess: (r) => refresh(r.data.id),
  });
}

export function useCreateFromForeignKey(dataSourceId: string) {
  const refresh = useRefresh(dataSourceId);
  return useMutation({
    mutationFn: (body: CreateFromForeignKey) => createRelationshipFromForeignKey(dataSourceId, body),
    onSuccess: (r) => refresh(r.data.id),
  });
}

export function useUpdateRelationship(dataSourceId: string) {
  const refresh = useRefresh(dataSourceId);
  return useMutation({
    mutationFn: (v: { id: string; etag: string; body: UpdateRelationship }) => updateRelationship(dataSourceId, v.id, v.etag, v.body),
    onSettled: (_r, _e, v) => refresh(v.id),
  });
}

export function useApproveRelationship(dataSourceId: string) {
  const refresh = useRefresh(dataSourceId);
  return useMutation({
    mutationFn: (v: { id: string; etag: string }) => approveRelationship(dataSourceId, v.id, v.etag),
    onSettled: (_r, _e, v) => refresh(v.id),
  });
}

export function useDeactivateRelationship(dataSourceId: string) {
  const refresh = useRefresh(dataSourceId);
  return useMutation({
    mutationFn: (v: { id: string; etag: string; reason: string }) => deactivateRelationship(dataSourceId, v.id, v.etag, v.reason),
    onSettled: (_r, _e, v) => refresh(v.id),
  });
}
