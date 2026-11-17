import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import { submitReportRequest, type ReportRequestBody } from '@/api/intelligence';
import { requestLanguage } from '@/i18n';
import { newKey } from '@/shared/format';
import {
  chatReducer,
  initialChatState,
  isBusy,
  saysExpired,
  type ChatState,
  type NexoraEntry,
  type RequestRecord,
  type SessionReport,
} from './chatModel';
import type { SourceView } from '@/api/bff';

interface ChatContextValue {
  state: ChatState;
  busy: boolean;
  ask: (text: string, source: SourceView) => void;
  answer: (clarification: NexoraEntry, optionIndex: number, optionLabel: string) => void;
  retry: (entry: NexoraEntry) => void;
  select: (id: string) => void;
  reset: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

let counter = 0;
const nextId = () => `e${Date.now()}-${++counter}`;

/**
 * The chat of the session (kept while the page is open; never stored in the browser): it sends the operations to
 * Intelligence through the BFF and keeps the Excel files of the session as object URLs (D8).
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const inFlight = useRef(false);

  // The files of the session are released when the console closes.
  useEffect(() => () => stateRef.current.reports.forEach((r) => URL.revokeObjectURL(r.url)), []);

  const run = useCallback(async (entryId: string, request: RequestRecord, clarificationEntryId?: string) => {
    inFlight.current = true;
    try {
      const { outcome, meta } = await submitReportRequest(request.key, request.body);
      let report: SessionReport | undefined;
      if (outcome.kind === 'report') {
        report = {
          id: nextId(),
          fileName: outcome.fileName,
          url: URL.createObjectURL(outcome.file),
          size: outcome.file.size,
          sha256: outcome.sha256,
          completeness: outcome.completeness,
          warnings: outcome.warnings,
          question: request.question,
          sourceLabel: request.sourceLabel,
          createdAt: Date.now(),
          runId: outcome.runId,
          reportPlanId: outcome.reportPlanId,
        };
      }
      dispatch({ type: 'resolved', id: entryId, outcome, meta, report });
      if (clarificationEntryId && saysExpired(outcome)) {
        dispatch({ type: 'expired', clarificationEntryId });
      }
    } catch {
      // The session ended (the console shows the sign-in page) or the call was aborted: the outcome is unknown.
      dispatch({ type: 'resolved', id: entryId, outcome: { kind: 'unknown', outcome: 'UNKNOWN' }, meta: { elapsedMs: 0 } });
    } finally {
      inFlight.current = false;
    }
  }, []);

  const start = useCallback(
    (userText: string, body: ReportRequestBody, source: { alias: string; label: string }, question: string, clarificationEntryId?: string) => {
      if (inFlight.current || isBusy(stateRef.current)) return;
      inFlight.current = true;
      const request: RequestRecord = { key: newKey(), body, sourceAlias: source.alias, sourceLabel: source.label, question, sentAt: Date.now() };
      const pending: NexoraEntry = { id: nextId(), role: 'nexora', at: Date.now(), request, state: 'pending' };
      dispatch({ type: 'sent', user: { id: nextId(), role: 'user', text: userText, at: Date.now() }, pending });
      void run(pending.id, request, clarificationEntryId);
    },
    [run],
  );

  const ask = useCallback(
    (text: string, source: SourceView) => {
      const question = text.trim();
      if (!question) return;
      start(question, { request: question, language: requestLanguage(), dataSource: source.alias }, source, question);
    },
    [start],
  );

  const answer = useCallback(
    (clarification: NexoraEntry, optionIndex: number, optionLabel: string) => {
      const o = clarification.outcome;
      if (!o || o.kind !== 'clarification' || !o.clarificationId || !o.optionIds) return;
      const optionId = o.optionIds[optionIndex];
      if (!optionId || clarification.answeredOptionId) return;
      if (inFlight.current || isBusy(stateRef.current)) return;
      dispatch({ type: 'answered', clarificationEntryId: clarification.id, optionId });
      const original = clarification.request;
      start(
        optionLabel,
        { clarification: { id: o.clarificationId, option: optionId }, language: requestLanguage(), dataSource: original.sourceAlias },
        { alias: original.sourceAlias, label: original.sourceLabel },
        original.question,
        clarification.id,
      );
    },
    [start],
  );

  /** A technical retry of the same operation: same key, same body. */
  const retry = useCallback(
    (entry: NexoraEntry) => {
      if (inFlight.current || isBusy(stateRef.current)) return;
      inFlight.current = true;
      dispatch({ type: 'retrying', id: entry.id });
      void run(entry.id, entry.request);
    },
    [run],
  );

  const value: ChatContextValue = {
    state,
    busy: isBusy(state),
    ask,
    answer,
    retry,
    select: (id) => dispatch({ type: 'selected', id }),
    reset: () => dispatch({ type: 'reset' }),
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat outside ChatProvider');
  return value;
}
