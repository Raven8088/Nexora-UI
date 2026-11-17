import { Alert, Badge, Button, Card, Checkbox, Group, List, Radio, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { IconArrowLeft, IconCheck, IconSparkles } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  NONE,
  confirmKnowledge,
  interpretRequest,
  proposeKnowledge,
  type Answer,
  type Clarification,
  type KnowledgeIntent,
  type Proposal,
  type Proposals,
} from '@/api/assisted';
import { useSession } from '@/auth/SessionProvider';
import { useSource } from '@/context/SourceContext';
import { StatusBadge } from '@/shared/Badges';
import { PageHeader } from '@/shared/PageHeader';
import { ProblemAlert } from '@/shared/ProblemAlert';
import { DictionaryTabs } from '../dictionary/DictionaryTabs';
import { descriptionTemplate, nameTemplate } from './templates';

const MAX_REQUEST = 500;

const isStatus = (s: string): s is 'DRAFT' | 'APPROVED' | 'INACTIVE' => s === 'DRAFT' || s === 'APPROVED' || s === 'INACTIVE';

type Saved = { definitionId: string; name: string };

/**
 * F1 — «Crear con ayuda»: a person describes, in business words, what Nexora should learn; Nexora interprets it
 * (Intelligence), Semantic says what already exists, what is missing and what must be asked, and the person confirms
 * a proposal, which is saved as a DRAFT. Approval stays a separate human operation. No table, column or key is ever
 * shown or asked for here (the advanced editor keeps them).
 */
export function AssistedPage() {
  const { t } = useTranslation();
  const { permissions } = useSession();
  const { source } = useSource();
  const queryClient = useQueryClient();
  const [request, setRequest] = useState('');
  const [intent, setIntent] = useState<KnowledgeIntent | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [pendingAnswers, setPendingAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Proposals | null>(null);
  const [busy, setBusy] = useState<'interpret' | 'propose' | 'save' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<Saved[]>([]);

  if (!permissions.proposalWrite) return <Alert color="gray">{t('common.noPermission')}</Alert>;
  if (!source) return <Alert color="yellow">{t('common.noSource')}</Alert>;

  const reset = () => {
    setIntent(null);
    setAnswers([]);
    setPendingAnswers({});
    setResult(null);
    setError(null);
    setSaved([]);
  };

  const interpret = async (e: FormEvent) => {
    e.preventDefault();
    if (!request.trim()) return;
    setBusy('interpret');
    setError(null);
    setResult(null);
    setSaved([]);
    try {
      const next = await interpretRequest(source.alias, request.trim());
      setIntent(next);
      setAnswers([]);
      setPendingAnswers({});
      setResult(await proposeKnowledge(source.dataSourceId, next, []));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const continueWithAnswers = async () => {
    if (!intent || !result) return;
    const next: Answer[] = [
      ...answers.filter((a) => !result.clarifications.some((c) => c.id === a.clarification)),
      ...result.clarifications.map((c) => ({ clarification: c.id, choice: pendingAnswers[c.id] ?? NONE })),
    ];
    setBusy('propose');
    setError(null);
    try {
      setResult(await proposeKnowledge(source.dataSourceId, intent, next));
      setAnswers(next);
      setPendingAnswers({});
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const save = async (proposal: Proposal, form: ProposalFormValues) => {
    if (!intent) return;
    setBusy('save');
    setError(null);
    try {
      const created = await confirmKnowledge(source.dataSourceId, intent, answers, {
        proposal: proposal.id,
        name: form.name.trim(),
        description: form.description.trim(),
        acknowledgedPending: proposal.pending,
        acknowledgedInterpretation: form.interpretation,
      });
      setSaved((s) => [...s, { definitionId: created.definitionId, name: form.name.trim() }]);
      await queryClient.invalidateQueries();
      setResult(await proposeKnowledge(source.dataSourceId, intent, answers));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const allAnswered = (result?.clarifications ?? []).every((c) => pendingAnswers[c.id]);

  return (
    <Stack gap="md">
      <PageHeader title={t('assisted.title')} subtitle={t('assisted.subtitle')} />
      <DictionaryTabs active="definitions" />
      <Card withBorder padding="md" component="form" onSubmit={interpret} aria-labelledby="assisted-ask">
        <Stack gap="sm">
          <Title order={3} size="h4" id="assisted-ask">{t('assisted.askTitle')}</Title>
          <Textarea
            label={t('assisted.requestLabel')}
            description={t('assisted.requestHint')}
            placeholder={t('assisted.requestPlaceholder')}
            autosize
            minRows={2}
            maxLength={MAX_REQUEST}
            value={request}
            onChange={(e) => setRequest(e.currentTarget.value)}
            disabled={busy !== null}
          />
          <Group gap="sm">
            <Button type="submit" leftSection={<IconSparkles size={18} />} loading={busy === 'interpret'} disabled={!request.trim() || busy !== null}>
              {t('assisted.interpret')}
            </Button>
            {intent && (
              <Button variant="default" onClick={() => { reset(); setRequest(''); }} disabled={busy !== null}>
                {t('assisted.newRequest')}
              </Button>
            )}
            <Button variant="subtle" component={Link} to="/diccionario" leftSection={<IconArrowLeft size={16} />}>
              {t('assisted.advanced')}
            </Button>
            <Button variant="subtle" component={Link} to="/diccionario/nuevo-concepto">
              {t('concepts.entry')}
            </Button>
          </Group>
          <Text size="xs" className="nexora-secondary-text">{t('assisted.privacyNote')}</Text>
        </Stack>
      </Card>

      {error !== null && <ProblemAlert error={error} />}

      {saved.length > 0 && (
        <Alert color="nexora" icon={<IconCheck size={18} />} title={t('assisted.savedTitle')} data-testid="assisted-saved">
          <Stack gap={4}>
            {saved.map((s) => (
              <Group key={s.definitionId} gap="xs">
                <Text size="sm">{t('assisted.savedText', { name: s.name })}</Text>
                <Button size="xs" variant="subtle" component={Link} to={`/diccionario?id=${encodeURIComponent(s.definitionId)}`}>
                  {t('assisted.openDraft')}
                </Button>
              </Group>
            ))}
            <Text size="sm">{t('assisted.approvalNote')}</Text>
          </Stack>
        </Alert>
      )}

      {result && (
        <Stack gap="md" data-testid="assisted-result">
          <Understood result={result} />
          {result.notices.length > 0 && (
            <Stack gap="xs">
              {result.notices.map((n) => (
                <Alert key={n} color={n === 'REJECTED_BEFORE' || n === 'GROUPING_NOT_COVERED' ? 'yellow' : 'blue'} variant="light">
                  {t(`assisted.notice.${n}`, { defaultValue: n })}
                </Alert>
              ))}
            </Stack>
          )}
          {result.status === 'NEEDS_CLARIFICATION' && (
            <Card withBorder padding="md" aria-labelledby="assisted-questions">
              <Stack gap="md">
                <Title order={3} size="h4" id="assisted-questions">{t('assisted.questionsTitle')}</Title>
                {result.clarifications.map((c) => (
                  <ClarificationField
                    key={c.id}
                    clarification={c}
                    value={pendingAnswers[c.id] ?? null}
                    onChange={(v) => setPendingAnswers((p) => ({ ...p, [c.id]: v }))}
                  />
                ))}
                <Group>
                  <Button onClick={continueWithAnswers} loading={busy === 'propose'} disabled={!allAnswered || busy !== null}>
                    {t('assisted.continue')}
                  </Button>
                </Group>
              </Stack>
            </Card>
          )}
          {result.status === 'PROPOSAL' &&
            result.proposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} saving={busy === 'save'} disabled={busy !== null} onSave={(form) => save(p, form)} />
            ))}
          {result.status === 'ALREADY_EXISTS' && (
            <Alert color="nexora" title={t('assisted.existsTitle')} data-testid="assisted-exists">{t('assisted.existsText')}</Alert>
          )}
          {result.status === 'UNSUPPORTED' && (
            <Alert color="yellow" title={t('assisted.unsupportedTitle')}>
              <Stack gap="xs">
                <Text size="sm">{t('assisted.unsupportedText')}</Text>
                <Button size="xs" variant="default" component={Link} to="/diccionario" w="fit-content">{t('assisted.advanced')}</Button>
              </Stack>
            </Alert>
          )}
          {result.status === 'NOT_UNDERSTOOD' && (
            <Alert color="yellow" title={t('assisted.notUnderstoodTitle')}>{t('assisted.notUnderstoodText')}</Alert>
          )}
          {/* F2: the entity is not known yet (or the person said none of the options is it): teach a new concept. */}
          {(result.status === 'NOT_UNDERSTOOD' || result.notices.includes('ENTITY_NOT_COVERED') || result.notices.includes('NO_APPROVED_CONCEPT')) &&
            intent?.interpretation.entity !== null && (
              <Group gap="xs" data-testid="assisted-new-concept">
                <Text size="sm">{t('concepts.entryHint')}</Text>
                <Button size="xs" variant="default" component={Link} to={`/diccionario/nuevo-concepto?peticion=${encodeURIComponent(request.trim())}`}>
                  {t('concepts.entry')}
                </Button>
              </Group>
            )}
        </Stack>
      )}
    </Stack>
  );
}

/** What Nexora understood: the elements it reuses (approved names only) and the words it could not relate. */
function Understood({ result }: { result: Proposals }) {
  const { t } = useTranslation();
  if (result.reused.length === 0 && result.unresolved.length === 0) return null;
  return (
    <Card withBorder padding="md" aria-labelledby="assisted-understood">
      <Stack gap="xs">
        <Title order={3} size="h4" id="assisted-understood">{t('assisted.understoodTitle')}</Title>
        <List spacing={4} size="sm" data-testid="assisted-reused">
          {result.reused.map((r) => (
            <List.Item key={`${r.role}-${r.definitionId}`}>
              <Group gap={6} wrap="wrap">
                <Text size="sm">{t(`assisted.role.${r.role}`, { words: r.words ?? r.name })}</Text>
                <Text size="sm" fw={600}>{r.name}</Text>
                {isStatus(r.status) && <StatusBadge status={r.status} short />}
                <Text size="xs" className="nexora-secondary-text">{t(`assisted.basis.${r.basis}`, { defaultValue: '' })}</Text>
              </Group>
            </List.Item>
          ))}
        </List>
        {result.unresolved.length > 0 && (
          <Text size="sm">{t('assisted.unresolved', { words: result.unresolved.map((w) => `«${w}»`).join(', ') })}</Text>
        )}
      </Stack>
    </Card>
  );
}

function ClarificationField({ clarification, value, onChange }: { clarification: Clarification; value: string | null; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const label = t(`assisted.question.${clarification.topic}`, { words: clarification.words ?? '' });
  return (
    <Radio.Group label={label} value={value} onChange={onChange} required>
      <Stack gap={6} mt="xs">
        {clarification.options.map((o) => (
          <Radio
            key={o.id}
            value={o.id}
            label={
              o.id === NONE
                ? t('assisted.none')
                : o.id === 'YES'
                  ? t('assisted.yesCount', { words: clarification.words ?? '' })
                  : `${o.name ?? ''}${o.status ? ` · ${t(`assisted.status.${o.status}`, { defaultValue: o.status })}` : ''}`
            }
            description={o.interpreted && o.id !== NONE && o.id !== 'YES' ? t('assisted.interpretedOption') : undefined}
          />
        ))}
      </Stack>
    </Radio.Group>
  );
}

export interface ProposalFormValues {
  name: string;
  description: string;
  pending: boolean;
  interpretation: boolean;
}

function ProposalCard({ proposal, saving, disabled, onSave }: { proposal: Proposal; saving: boolean; disabled: boolean; onSave: (f: ProposalFormValues) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(() => nameTemplate(t, proposal));
  const [description, setDescription] = useState(() => descriptionTemplate(t, proposal));
  const [pending, setPending] = useState(proposal.pending.length === 0);
  const [interpretation, setInterpretation] = useState(!proposal.modelMapping);
  const valid = name.trim().length > 0 && name.trim().length <= 200 && description.trim().length > 0 && description.trim().length <= 2000;
  const ready = valid && pending && interpretation && !proposal.blocked;
  const titleId = `proposal-${proposal.id.slice(0, 12)}`;
  return (
    <Card withBorder padding="md" aria-labelledby={titleId} data-testid="assisted-proposal">
      <Stack gap="sm">
        <Group gap="xs">
          <Title order={3} size="h4" id={titleId}>{t(`assisted.proposalTitle.${proposal.kind}`)}</Title>
          <Badge variant="light">{t('assisted.draftBadge')}</Badge>
          {proposal.source === 'OPEN_SUGGESTION' && <Badge variant="outline">{t('assisted.fromSuggestion')}</Badge>}
        </Group>
        <Text size="sm" data-testid="assisted-explanation">{explanation(t, proposal)}</Text>
        {proposal.blocked && <Alert color="yellow">{t('assisted.blocked')}</Alert>}
        <TextInput label={t('assisted.nameLabel')} description={t('assisted.nameHint')} required maxLength={200} value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Textarea
          label={t('assisted.descriptionLabel')}
          description={t('assisted.descriptionHint')}
          required
          autosize
          minRows={2}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
        {proposal.pending.length > 0 && (
          <Checkbox
            checked={pending}
            onChange={(e) => setPending(e.currentTarget.checked)}
            label={t('assisted.confirmPending')}
            description={proposal.pending.map((p) => t(`assisted.pending.${p}`, { defaultValue: p })).join(' ')}
          />
        )}
        {proposal.modelMapping && (
          <Checkbox
            checked={interpretation}
            onChange={(e) => setInterpretation(e.currentTarget.checked)}
            label={t('assisted.confirmInterpretation', { words: proposal.words ?? '' })}
            description={t('assisted.confirmInterpretationHint')}
          />
        )}
        <Group>
          <Button onClick={() => onSave({ name, description, pending, interpretation })} loading={saving} disabled={!ready || disabled}>
            {t('assisted.save')}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function explanation(t: (k: string, o?: Record<string, unknown>) => string, p: Proposal): string {
  if (p.kind === 'METRIC') return t('assisted.explain.METRIC', { concept: p.conceptName });
  return t('assisted.explain.DIMENSION', {
    concept: p.conceptName,
    words: p.words ?? '',
    category: t(`assisted.category.${p.valueCategory ?? 'TEXT'}`),
  });
}
