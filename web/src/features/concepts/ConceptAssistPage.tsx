import { Alert, Badge, Button, Card, Checkbox, Collapse, Group, List, Radio, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { IconArrowLeft, IconCheck, IconSearch } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import {
  confirmConcept,
  interpretConcept,
  proposeConcepts,
  type ConceptCandidate,
  type ConceptMatch,
  type ConceptProposals,
  type VerifiedFact,
} from '@/api/concepts';
import { ApiError } from '@/api/problem';
import { useSession } from '@/auth/SessionProvider';
import { useSource } from '@/context/SourceContext';
import { PageHeader } from '@/shared/PageHeader';
import { ProblemAlert } from '@/shared/ProblemAlert';
import { DictionaryTabs } from '../dictionary/DictionaryTabs';

const MAX_REQUEST = 500;
const NONE = 'NONE';

type T = (key: string, options?: Record<string, unknown>) => string;

/** D-F2-7: fixed templates with the person's own words (never text written by a model); editable and confirmed. */
export function conceptNameTemplate(words: string): string {
  const w = words.trim();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

export function conceptDescriptionTemplate(t: T, words: string): string {
  return t('concepts.template.description', { words: words.trim() });
}

/** The verified facts of a candidate in plain language (D-F2-4): the columns are summarized in one line. */
export function factLines(t: T, verified: VerifiedFact[]): string[] {
  const lines: string[] = [];
  const columns: string[] = [];
  for (const v of verified) {
    if (v.fact.endsWith('_COLUMNS')) {
      columns.push(t(`concepts.column.${v.fact}`, { count: v.count }));
    } else {
      lines.push(t(`concepts.fact.${v.fact}`, { count: v.count, concept: v.conceptName ?? '' }));
    }
  }
  if (columns.length > 0) lines.push(t('concepts.fact.COLUMNS', { list: columns.join(', ') }));
  return lines;
}

/**
 * F2 — «Enseñar un concepto nuevo»: a person writes, in business words, a kind of thing Nexora does not know yet;
 * Nexora (Intelligence) relates the words to the exposed tables of the source, Semantic says what is already known and
 * gives the candidates with what is verified apart from what is inferred, and the person chooses one (or none), reviews
 * the name and the description and confirms. It is saved as a DRAFT concept; approval stays a separate human operation.
 * No table, column or key is shown here. The folded detail for specialists is the only exception: Semantic sends it
 * only to a person who approves or manages the source (F2-FIX1, D-F2-4-bis).
 */
export function ConceptAssistPage() {
  const { t } = useTranslation();
  const { permissions } = useSession();
  const { source } = useSource();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [request, setRequest] = useState(() => (params.get('peticion') ?? '').slice(0, MAX_REQUEST));
  const [match, setMatch] = useState<ConceptMatch | null>(null);
  const [result, setResult] = useState<ConceptProposals | null>(null);
  const [notKnown, setNotKnown] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'search' | 'save' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<{ definitionId: string; name: string } | null>(null);

  if (!permissions.proposalWrite) return <Alert color="gray">{t('common.noPermission')}</Alert>;
  if (!source) return <Alert color="yellow">{t('common.noSource')}</Alert>;

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!request.trim()) return;
    setBusy('search');
    setError(null);
    setResult(null);
    setSaved(null);
    setChoice(null);
    setNotKnown(false);
    try {
      const next = await interpretConcept(source.alias, request.trim());
      setMatch(next);
      setResult(await proposeConcepts(source.dataSourceId, next));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const save = async (candidate: ConceptCandidate, form: ConceptFormValues) => {
    if (!match) return;
    setBusy('save');
    setError(null);
    try {
      const created = await confirmConcept(source.dataSourceId, match, {
        relationId: candidate.relationId,
        proposal: candidate.proposalId,
        name: form.name.trim(),
        description: form.description.trim(),
        acknowledgedInference: form.inference,
        acknowledgedNotKnown: notKnown,
      });
      setSaved({ definitionId: created.definitionId, name: form.name.trim() });
      setChoice(null);
      await queryClient.invalidateQueries();
      setResult(await proposeConcepts(source.dataSourceId, match));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const disabled = error instanceof ApiError && error.problem.status === 404 && !result;
  const showCandidates = result !== null && result.candidates.length > 0 && (result.status === 'CANDIDATES' || notKnown);
  const chosen = result?.candidates.find((c) => c.relationId === choice) ?? null;

  return (
    <Stack gap="md">
      <PageHeader title={t('concepts.title')} subtitle={t('concepts.subtitle')} />
      <DictionaryTabs active="definitions" />
      <Card withBorder padding="md" component="form" onSubmit={search} aria-labelledby="concepts-ask">
        <Stack gap="sm">
          <Title order={3} size="h4" id="concepts-ask">{t('concepts.askTitle')}</Title>
          <Textarea
            label={t('concepts.requestLabel')}
            description={t('concepts.requestHint')}
            autosize
            minRows={2}
            maxLength={MAX_REQUEST}
            value={request}
            onChange={(e) => setRequest(e.currentTarget.value)}
            disabled={busy !== null}
          />
          <Group gap="sm">
            <Button type="submit" leftSection={<IconSearch size={18} />} loading={busy === 'search'} disabled={!request.trim() || busy !== null}>
              {t('concepts.search')}
            </Button>
            <Button variant="subtle" component={Link} to="/diccionario/crear-con-ayuda" leftSection={<IconArrowLeft size={16} />}>
              {t('concepts.back')}
            </Button>
          </Group>
          <Text size="xs" className="nexora-secondary-text">{t('concepts.privacyNote')}</Text>
        </Stack>
      </Card>

      {disabled ? (
        <Alert color="nexora" title={t('concepts.disabledTitle')}>{t('concepts.disabledText')}</Alert>
      ) : (
        error !== null && <ProblemAlert error={error} />
      )}

      {saved && (
        <Alert color="nexora" icon={<IconCheck size={18} />} title={t('concepts.savedTitle')} data-testid="concepts-saved">
          <Stack gap={4}>
            <Group gap="xs">
              <Text size="sm">{t('concepts.savedText', { name: saved.name })}</Text>
              <Button size="xs" variant="subtle" component={Link} to={`/diccionario?id=${encodeURIComponent(saved.definitionId)}`}>
                {t('assisted.openDraft')}
              </Button>
            </Group>
            <Text size="sm">{t('concepts.approvalNote')}</Text>
          </Stack>
        </Alert>
      )}

      {result && (
        <Stack gap="md" data-testid="concepts-result">
          {result.notices.includes('CONTEXT_CHANGED') && (
            <Alert color="blue" variant="light">{t('concepts.contextChanged')}</Alert>
          )}
          {result.status === 'NOT_UNDERSTOOD' && (
            <Alert color="nexora" title={t('concepts.notUnderstoodTitle')}>{t('concepts.notUnderstoodText')}</Alert>
          )}
          {result.status === 'ALREADY_KNOWN' && (
            <Alert color="nexora" title={t('concepts.knownTitle')} data-testid="concepts-known">
              <Stack gap="xs">
                <List size="sm">
                  {result.named.map((n) => (
                    <List.Item key={n.id}>
                      <Group gap="xs">
                        <Text size="sm" fw={600}>{n.name}</Text>
                        <Button size="xs" variant="subtle" component={Link} to={`/diccionario?id=${encodeURIComponent(n.id)}`}>
                          {t('assisted.openDraft')}
                        </Button>
                      </Group>
                    </List.Item>
                  ))}
                </List>
                {result.candidates.length > 0 && (
                  <Checkbox checked={notKnown} onChange={(e) => setNotKnown(e.currentTarget.checked)} label={t('concepts.notKnown')} />
                )}
              </Stack>
            </Alert>
          )}
          {result.status === 'NOT_FOUND' && (
            <Alert color="nexora" title={t('concepts.notFoundTitle')} data-testid="concepts-not-found">
              <Stack gap="xs">
                <Text size="sm">{t('concepts.notFoundText')}</Text>
                <Button size="xs" variant="default" component={Link} to="/diccionario" w="fit-content">{t('assisted.advanced')}</Button>
              </Stack>
            </Alert>
          )}
          {showCandidates && (
            <Card withBorder padding="md" aria-labelledby="concepts-candidates">
              <Stack gap="md">
                <Title order={3} size="h4" id="concepts-candidates">{t('concepts.candidatesTitle', { words: result.words ?? '' })}</Title>
                <Text size="sm">{t('concepts.candidatesHint')}</Text>
                <Radio.Group value={choice} onChange={setChoice} aria-labelledby="concepts-candidates" name="concept-candidate">
                  <Stack gap="sm">
                    {result.candidates.map((c, i) => (
                      <CandidateOption key={c.relationId} candidate={c} index={i} />
                    ))}
                    <Radio value={NONE} label={t('assisted.none')} />
                  </Stack>
                </Radio.Group>
                {result.omitted > 0 && <Text size="xs" className="nexora-secondary-text">{t('concepts.omitted', { count: result.omitted })}</Text>}
              </Stack>
            </Card>
          )}
          {choice === NONE && (
            <Alert color="blue" variant="light" data-testid="concepts-none">{t('concepts.noneText')}</Alert>
          )}
          {chosen !== null && (chosen.known === 'NEW' || chosen.known === 'OPEN_SUGGESTION') ? (
            <ConceptForm
              key={chosen.relationId}
              candidate={chosen}
              words={result?.words ?? ''}
              saving={busy === 'save'}
              disabled={busy !== null}
              onSave={(form) => save(chosen, form)}
            />
          ) : null}
        </Stack>
      )}
    </Stack>
  );
}

function CandidateOption({ candidate, index }: { candidate: ConceptCandidate; index: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const blocked = candidate.known === 'CONCEPT_EXISTS' || candidate.known === 'REJECTED_BEFORE';
  return (
    <Card withBorder padding="sm" data-testid="concepts-candidate">
      <Stack gap={6}>
        <Radio
          value={candidate.relationId}
          disabled={blocked}
          label={t('concepts.option', { n: index + 1 })}
          description={
            candidate.known === 'CONCEPT_EXISTS'
              ? t('concepts.known.CONCEPT_EXISTS', { name: candidate.knownName ?? '' })
              : candidate.known === 'NEW'
                ? undefined
                : t(`concepts.known.${candidate.known}`)
          }
        />
        <Group gap={6}>
          <Badge variant="light" color="nexora">{t('concepts.verified')}</Badge>
        </Group>
        <List size="sm" spacing={2} data-testid="concepts-facts">
          {factLines(t, candidate.verified).map((line) => (
            <List.Item key={line}>{line}</List.Item>
          ))}
        </List>
        <Group gap={6}>
          <Badge variant="outline" color="dark">{t('concepts.inference')}</Badge>
        </Group>
        <List size="sm" spacing={2} data-testid="concepts-inferences">
          {candidate.inferred.map((i) => (
            <List.Item key={i}>{t(`concepts.inferred.${i}`)}</List.Item>
          ))}
        </List>
        {candidate.technicalName && (
          <>
            <Button size="xs" variant="subtle" w="fit-content" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {t('concepts.technicalToggle')}
            </Button>
            <Collapse in={open}>
              <Text size="xs" className="nexora-secondary-text" data-testid="concepts-technical">
                {t('concepts.technicalName', { name: candidate.technicalName })}
              </Text>
            </Collapse>
          </>
        )}
      </Stack>
    </Card>
  );
}

export interface ConceptFormValues {
  name: string;
  description: string;
  inference: boolean;
}

function ConceptForm({ candidate, words, saving, disabled, onSave }: { candidate: ConceptCandidate; words: string; saving: boolean; disabled: boolean; onSave: (f: ConceptFormValues) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(() => conceptNameTemplate(words));
  const [description, setDescription] = useState(() => conceptDescriptionTemplate(t, words));
  const [inference, setInference] = useState(false);
  const valid = name.trim().length > 0 && name.trim().length <= 200 && description.trim().length > 0 && description.trim().length <= 2000;
  return (
    <Card withBorder padding="md" aria-labelledby="concepts-form" data-testid="concepts-form">
      <Stack gap="sm">
        <Group gap="xs">
          <Title order={3} size="h4" id="concepts-form">{t('concepts.formTitle')}</Title>
          <Badge variant="light">{t('assisted.draftBadge')}</Badge>
          {candidate.known === 'OPEN_SUGGESTION' && <Badge variant="outline">{t('assisted.fromSuggestion')}</Badge>}
        </Group>
        <TextInput label={t('assisted.nameLabel')} description={t('concepts.nameHint')} required maxLength={200} value={name} onChange={(e) => setName(e.currentTarget.value)} />
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
        <Checkbox
          checked={inference}
          onChange={(e) => setInference(e.currentTarget.checked)}
          label={t('concepts.confirmInference', { words })}
          description={t('concepts.confirmInferenceHint')}
        />
        <Group>
          <Button onClick={() => onSave({ name, description, inference })} loading={saving} disabled={!valid || !inference || disabled}>
            {t('assisted.save')}
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
