import type { ReportOutcome, ReportRequestBody, ReportResponseMeta } from '@/api/intelligence';

/**
 * The chat as a pure state machine (no I/O), so that its rules are tested directly:
 *  - one logical operation = one idempotency key; a technical retry of that same operation reuses key and body;
 *  - the answer to a clarification is a new operation with a new key;
 *  - while an operation is pending nothing else is sent (no double submission);
 *  - an unknown outcome is never shown as a failure.
 */
export interface RequestRecord {
  key: string;
  body: ReportRequestBody;
  sourceAlias: string;
  sourceLabel: string;
  /** The question of the conversation this operation belongs to (for reports and diagnostics). */
  question: string;
  sentAt: number;
}

export interface UserEntry {
  id: string;
  role: 'user';
  text: string;
  at: number;
}

export interface NexoraEntry {
  id: string;
  role: 'nexora';
  at: number;
  request: RequestRecord;
  state: 'pending' | 'done';
  outcome?: ReportOutcome;
  meta?: ReportResponseMeta;
  /** For a clarification: the option chosen in this conversation, or its expiry reported by the service. */
  answeredOptionId?: string;
  expiredByServer?: boolean;
  /** For a report: the id of the file in the session's reports. */
  reportId?: string;
}

export type Entry = UserEntry | NexoraEntry;

export interface SessionReport {
  id: string;
  fileName: string;
  url: string;
  size: number;
  sha256?: string;
  completeness?: string;
  warnings: string[];
  question: string;
  sourceLabel: string;
  createdAt: number;
  runId?: string;
  reportPlanId?: string;
}

export interface ChatState {
  entries: Entry[];
  reports: SessionReport[];
  selectedId?: string;
}

export const initialChatState: ChatState = { entries: [], reports: [] };

export type ChatAction =
  | { type: 'sent'; user: UserEntry; pending: NexoraEntry }
  | { type: 'resolved'; id: string; outcome: ReportOutcome; meta: ReportResponseMeta; report?: SessionReport }
  | { type: 'retrying'; id: string }
  | { type: 'answered'; clarificationEntryId: string; optionId: string }
  | { type: 'expired'; clarificationEntryId: string }
  | { type: 'selected'; id: string }
  | { type: 'reset' };

export function isBusy(state: ChatState): boolean {
  return state.entries.some((e) => e.role === 'nexora' && e.state === 'pending');
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'sent':
      return { ...state, entries: [...state.entries, action.user, action.pending], selectedId: action.pending.id };
    case 'resolved':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.id && e.role === 'nexora'
            ? { ...e, state: 'done', outcome: action.outcome, meta: action.meta, reportId: action.report?.id }
            : e,
        ),
        reports: action.report ? [action.report, ...state.reports] : state.reports,
      };
    case 'retrying':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.id && e.role === 'nexora' ? { ...e, state: 'pending', outcome: undefined, meta: undefined } : e,
        ),
      };
    case 'answered':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.clarificationEntryId && e.role === 'nexora' ? { ...e, answeredOptionId: action.optionId } : e,
        ),
      };
    case 'expired':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.clarificationEntryId && e.role === 'nexora' ? { ...e, expiredByServer: true } : e,
        ),
      };
    case 'selected':
      return { ...state, selectedId: action.id };
    case 'reset':
      // The files of the session stay available in «Reportes de la sesión».
      return { entries: [], reports: state.reports };
  }
}

/** Whether a clarification can still be answered from the console. */
export function clarificationState(
  entry: NexoraEntry,
  now: number,
): 'answerable' | 'answered' | 'expired' | 'notAnswerable' {
  const o = entry.outcome;
  if (!o || o.kind !== 'clarification') return 'notAnswerable';
  if (entry.answeredOptionId) return 'answered';
  if (!o.clarificationId || !o.optionIds || o.optionIds.length !== o.options.length) return 'notAnswerable';
  if (entry.expiredByServer) return 'expired';
  if (o.expiresAt && Date.parse(o.expiresAt) <= now) return 'expired';
  return 'answerable';
}

/** The functional status of an answer, for the diagnostics. */
export function functionalStatus(entry: NexoraEntry): string {
  const o = entry.outcome;
  if (entry.state === 'pending' || !o) return 'PENDING';
  switch (o.kind) {
    case 'clarification':
      return 'NEEDS_CLARIFICATION';
    case 'report':
      return 'DELIVERED';
    case 'problem':
      return o.problem.code;
    case 'unknown':
      return `OUTCOME_${o.outcome}`;
  }
}

/** Whether the failure of the service says the clarification expired (Intelligence: reason CLARIFICATION_EXPIRED). */
export function saysExpired(outcome: ReportOutcome): boolean {
  return outcome.kind === 'problem' && outcome.problem.reason === 'CLARIFICATION_EXPIRED';
}
