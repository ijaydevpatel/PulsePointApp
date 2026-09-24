/**
 * FR6 - on-device interaction check.
 *
 * Type-ahead is not a nicety. The check can only compare medicines the table
 * recognises, so anything raising the recognition rate directly raises how much
 * of the user's list actually gets checked. Suggesting a match as they type
 * turns a spelling error into a tap instead of an unrecognised entry.
 */
import React, { useMemo, useState } from 'react';
import { View, TextInput, ScrollView, StyleSheet, LayoutAnimation } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Button, Card, SectionLabel, EmptyState, Txt, Springy, Enter, tap,
} from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, TYPE, circle } from '../theme';
import { BundledInteractionTable } from '../../data/interactionTable';
import { CheckInteractionsUseCase } from '../../domain/checkInteractions';
import { InteractionReport } from '../../domain/medicines';
import {
  MedicineCheck, MedicineCheckService, RemoteOutcome,
} from '../../domain/remote';

export function MedicinesScreen({ onReport, check, onCheck }: {
  onReport: (r: InteractionReport) => void;
  /** The hosted collision check. Optional: the screen works without it. */
  check?: MedicineCheckService;
  /** null while in flight, undefined when no check was started at all. */
  onCheck?: (outcome: RemoteOutcome<MedicineCheck> | null | undefined) => void;
}) {
  const { c: P } = useTheme();
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [focus, setFocus] = useState(false);

  const table = useMemo(() => new BundledInteractionTable(), []);
  const useCase = useMemo(() => new CheckInteractionsUseCase(table), [table]);

  const suggestions = useMemo(
    () => table.suggest(draft).filter((d) => !items.some((i) => table.resolve(i)?.id === d.id)),
    [draft, items, table],
  );
  const unknownDraft = draft.trim().length > 2 && table.resolve(draft) === null;

  const add = (value?: string) => {
    const v = (value ?? draft).trim();
    if (!v) return;
    const resolved = table.resolve(v);
    const already = items.some((i) => {
      const r = table.resolve(i);
      return r && resolved && r.id === resolved.id;
    });
    if (already || items.includes(v)) { setDraft(''); return; }
    LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    setItems([...items, resolved ? resolved.name : v]);
    setDraft('');
    tap(resolved ? 'success' : 'warn');
  };

  const remove = (m: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(200, 'easeInEaseOut', 'opacity'));
    setItems(items.filter((x) => x !== m));
    tap('light');
  };

  const recognised = items.filter((i) => table.resolve(i) !== null).length;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: TAB_CLEARANCE + S.xxl }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/*
        Named for what it does, not for what it holds.
        "Medicines" described the list on this screen; the screen is a conflict
        checker and the list is how you feed it. The old subtitle counted the
        bundled table - 67 medicines, 35 interactions, offline - which was a
        statement about the implementation, and became wrong the moment the
        hosted check was wired in beside it.
      */}
      <ScreenHeader
        title="Medicine conflict checker"
        subtitle="Check medicine collision"
      />

      <View style={{ paddingHorizontal: S.xl }}>
        <Enter index={1}>
          <SectionLabel>Your medicines</SectionLabel>
          <View style={{ flexDirection: 'row', gap: S.sm }}>
            <TextInput
              style={[st.input, {
                borderColor: focus ? P.accent : P.line,
                backgroundColor: P.surface,
                color: P.ink,
                ...TYPE.body,
              }]}
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => add()}
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
              placeholder="Brand or generic name"
              placeholderTextColor={P.faint}
              autoCapitalize="words"
              autoCorrect={false}
              accessibilityLabel="Medicine name"
              returnKeyType="done"
            />
            <Springy
              onPress={() => add()}
              disabled={!draft.trim()}
              weight="medium"
              accessibilityLabel="Add medicine"
              style={[st.add, {
                backgroundColor: draft.trim() ? P.accent : P.sunken,
                opacity: draft.trim() ? 1 : 0.6,
              }]}
            >
              <Icon name="plus" size={22} color={draft.trim() ? P.onAccent : P.faint} weight="bold" />
            </Springy>
          </View>

          {suggestions.length > 0 ? (
            <View style={st.suggestions}>
              {suggestions.map((d) => (
                <Springy
                  key={d.id}
                  onPress={() => add(d.name)}
                  weight="select"
                  scaleTo={0.94}
                  accessibilityLabel={`Add ${d.name}`}
                  style={[st.suggestion, { backgroundColor: P.accentSoft }]}
                >
                  <Icon name="plus" size={13} color={P.accent} weight="bold" />
                  <Txt t="micro" c={P.accent}>{d.name}</Txt>
                </Springy>
              ))}
            </View>
          ) : null}

          {unknownDraft && suggestions.length === 0 ? (
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: S.sm }}>
              <Icon name="alert" size={14} color={P.warn} />
              <Txt t="caption" c={P.warn} style={{ flex: 1 }}>
                Not in the table. You can still add it - it will be listed as unrecognised
                rather than quietly skipped.
              </Txt>
            </View>
          ) : null}
        </Enter>

        <View style={{ height: S.xl }} />

        {items.length === 0 ? (
          <EmptyState
            icon="pill"
            title="No medicines added"
            body="Add two or more and the app will check them against a table stored on your device. It works with no connection."
          />
        ) : (
          <>
            {items.map((m, i) => {
              const known = table.resolve(m) !== null;
              return (
                <Enter key={m} index={i}>
                  <Card style={{
                    marginBottom: S.sm, paddingVertical: S.md,
                    flexDirection: 'row', alignItems: 'center', gap: S.md,
                  }}>
                    <View style={[st.dot, {
                      backgroundColor: known ? P.accent + '1F' : P.warn + '1F',
                    }]}>
                      <Icon name={known ? 'pill' : 'alert'} size={17} color={known ? P.accent : P.warn} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt t="bodyStrong">{m}</Txt>
                      {!known ? (
                        <Txt t="micro" c={P.warn} style={{ marginTop: 2 }}>Not in the table</Txt>
                      ) : null}
                    </View>
                    <Springy
                      onPress={() => remove(m)}
                      scaleTo={0.85}
                      accessibilityLabel={`Remove ${m}`}
                      style={st.remove}
                    >
                      <Icon name="close" size={17} color={P.faint} />
                    </Springy>
                  </Card>
                </Enter>
              );
            })}

            <View style={{ height: S.lg }} />
            <Button
              title={
                recognised < 2
                  ? 'Add another recognised medicine'
                  : `Check ${recognised} medicines`
              }
              disabled={recognised < 2}
              icon={recognised < 2 ? undefined : 'shield'}
              onPress={() => {
                tap('medium');

                /*
                 * On-device table first, exactly as the symptom check does it:
                 * the answer arrives at the speed of the phone, and the hosted
                 * opinion fills in underneath when it arrives. Making someone
                 * watch a spinner for a network call they may not need is the
                 * behaviour being designed out.
                 */
                onReport(useCase.execute(items));

                if (!onCheck) return;

                /*
                 * Cleared on every run, including the runs that do not start a
                 * check. Without this the previous pair's verdict would still
                 * be on screen beside the new pair's table result, which is
                 * the worst kind of wrong: plausible and stale.
                 */
                onCheck(undefined);
                if (!check) return;

                /*
                 * The endpoint compares exactly two agents, so this sends the
                 * first two the table recognised. Resolved to their canonical
                 * names rather than what was typed, so "Dolo 650" and
                 * "dolo650" reach the model as the same thing.
                 */
                const pair = items
                  .map((i) => table.resolve(i)?.name)
                  .filter((n): n is string => typeof n === 'string')
                  .slice(0, 2);
                const [med1, med2] = pair;
                if (!med1 || !med2) return;

                onCheck(null);   // in flight
                void check.check({ med1, med2 }).then(onCheck);
              }}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  input: {
    flex: 1, minHeight: TOUCH + 8, borderRadius: R.pill, borderWidth: 1.5,
    paddingHorizontal: S.xl,
  },
  add: {
    ...circle(TOUCH + 8),
    alignItems: 'center', justifyContent: 'center',
  },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm, marginTop: S.md },
  suggestion: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: S.md, paddingVertical: 9, borderRadius: R.pill,
  },
  dot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  remove: { ...circle(TOUCH - 6), alignItems: 'center', justifyContent: 'center' },
});
