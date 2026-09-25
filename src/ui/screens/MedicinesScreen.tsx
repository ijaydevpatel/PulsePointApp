/**
 * The medicine conflict checker: two agents in, one collision report out.
 *
 * ── Why this is two fields and not a list ────────────────────────────────────
 *
 * It used to build an arbitrary-length list and compare every pair against a
 * bundled table of 35 rules. That is a different feature. What this tab is for
 * is the question people arrive with - "can I take these two together" - and
 * the check behind it compares exactly two agents, so a list of five was an
 * interface promising something the engine could not do.
 *
 * ── What the bundled table is for now ────────────────────────────────────────
 *
 * The type-ahead, and nothing else. It is the difference between the model
 * reading "Dolo 650" and reading "dolo65", which is worth keeping. It no
 * longer produces any result of its own: the check is the model, and a second
 * verdict from a 35-rule table sitting beside it only raised the question of
 * which one the reader was supposed to believe.
 */
import React, { useMemo, useState } from 'react';
import { View, TextInput, ScrollView, StyleSheet } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  Button, Card, SectionLabel, Txt, Springy, Enter, tap,
} from '../components/Primitives';
import { Icon } from '../components/Icon';
import { KeyboardSafe } from '../components/KeyboardSafe';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, TYPE } from '../theme';
import { BundledInteractionTable } from '../../data/interactionTable';
import {
  MedicineCheck, MedicineCheckService, RemoteOutcome,
} from '../../domain/remote';

type Slot = 'a' | 'b';

export function MedicinesScreen({ onRun, check, onCheck }: {
  /** The two names, as the result screen should title them. */
  onRun: (pair: [string, string]) => void;
  check?: MedicineCheckService;
  onCheck?: (outcome: RemoteOutcome<MedicineCheck> | null | undefined) => void;
}) {
  const { c: P } = useTheme();
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [focused, setFocused] = useState<Slot | null>(null);

  const table = useMemo(() => new BundledInteractionTable(), []);

  const valueOf = (slot: Slot) => (slot === 'a' ? first : second);
  const setValue = (slot: Slot, v: string) => (slot === 'a' ? setFirst(v) : setSecond(v));

  /*
   * Suggestions only for the field being typed in, and only while it is
   * focused. Two open lists at once on a phone would cover the button.
   */
  const suggestions = useMemo(() => {
    if (!focused) return [];
    const draft = (focused === 'a' ? first : second).trim();
    if (draft.length < 2) return [];
    const other = table.resolve(focused === 'a' ? second : first);
    return table
      .suggest(draft)
      .filter((d) => !other || d.id !== other.id)
      .slice(0, 4);
  }, [focused, first, second, table]);

  const bothEntered = first.trim().length > 0 && second.trim().length > 0;

  const run = () => {
    if (!bothEntered) return;
    tap('medium');

    /*
     * Canonical names where the table knows them, what was typed where it does
     * not. Resolving means "Dolo 650", "dolo650" and "DOLO-650" reach the
     * model as one thing; falling back to the raw text means an unrecognised
     * medicine is still checked rather than silently dropped, which is the
     * failure mode this feature exists to prevent.
     */
    const med1 = table.resolve(first)?.name ?? first.trim();
    const med2 = table.resolve(second)?.name ?? second.trim();

    onRun([med1, med2]);

    if (!onCheck) return;
    // Cleared first, always, so a previous pair's verdict cannot sit on screen
    // beside a new pair's names.
    onCheck(undefined);
    if (!check) return;

    onCheck(null);   // in flight
    void check.check({ primaryMedicine: med1, secondaryMedicine: med2 }).then(onCheck);
  };

  const field = (slot: Slot, label: string, placeholder: string) => {
    const on = focused === slot;
    const typed = valueOf(slot).trim();
    const known = typed.length > 1 && table.resolve(typed) !== null;

    return (
      <>
        <SectionLabel>{label}</SectionLabel>
        <View style={[st.field, {
          borderColor: on ? P.accent : P.line,
          backgroundColor: P.surface,
        }]}>
          <Icon name="search" size={18} color={on ? P.accent : P.faint} />
          <TextInput
            style={[st.input, { color: P.ink, ...TYPE.body }]}
            value={valueOf(slot)}
            onChangeText={(v) => setValue(slot, v)}
            onFocus={() => setFocused(slot)}
            onBlur={() => setFocused((f) => (f === slot ? null : f))}
            placeholder={placeholder}
            placeholderTextColor={P.faint}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel={label}
          />
          {/* Quietly confirms the table recognised it. Absence is not an
              error - an unknown name is still sent. */}
          {known ? <Icon name="check" size={16} color={P.ok} /> : null}
        </View>
      </>
    );
  };

  return (
    // Two text fields, both below the fold on a short phone. See KeyboardSafe:
    // Android stopped resizing the window under edge-to-edge, so without this
    // the second field is typed into blind.
    <KeyboardSafe extra={TAB_CLEARANCE}>
    <ScrollView
      contentContainerStyle={{ paddingBottom: TAB_CLEARANCE + S.xxl }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="Medicine conflict checker"
        subtitle="Check medicine collision"
      />

      <View style={{ paddingHorizontal: S.xl }}>
        {/*
          Deliberately not wrapped in Enter. This block re-renders on every
          keystroke, and an entrance animation around a focused text input is
          one more thing that can interfere with the field while someone is
          typing in it - the same reason the symptom note box is left out.
        */}
        <View>
          {field('a', 'First medicine', 'e.g. Paracetamol')}
          <View style={{ height: S.lg }} />
          {field('b', 'Second medicine', 'e.g. Ibuprofen')}

          {suggestions.length > 0 ? (
            <View style={{ marginTop: S.sm }}>
              {suggestions.map((d) => (
                <Springy
                  key={d.id}
                  onPress={() => {
                    if (focused) setValue(focused, d.name);
                    tap('success');
                  }}
                  scaleTo={0.98}
                  accessibilityLabel={`Use ${d.name}`}
                  style={[st.suggestion, { backgroundColor: P.sunken }]}
                >
                  <Icon name="pill" size={15} color={P.muted} />
                  <Txt t="body" style={{ flex: 1 }}>{d.name}</Txt>
                </Springy>
              ))}
            </View>
          ) : null}

          <View style={{ height: S.xl }} />
          <Button
            title="Run collision check"
            icon={bothEntered ? 'shield' : undefined}
            disabled={!bothEntered}
            onPress={run}
          />
        </View>

        <Enter index={1}>
          <View style={{ height: S.xxl }} />
          <Card glass={true}>
            <View style={st.noteRow}>
              <Icon name="alert" size={16} color={P.muted} />
              <Txt t="caption" style={{ flex: 1 }}>
                The check looks for biochemical interference between the two -
                a shared active ingredient, or competing liver and kidney
                pathways. It does not know about anything else you take, and it
                is not a substitute for asking a pharmacist.
              </Txt>
            </View>
          </Card>
        </Enter>
      </View>
    </ScrollView>
    </KeyboardSafe>
  );
}

const st = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    minHeight: TOUCH + 8,
    borderRadius: R.pill,
    borderWidth: 1.5,
    paddingHorizontal: S.xl,
  },
  input: { flex: 1, paddingVertical: S.md },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    minHeight: TOUCH,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    marginTop: S.xs,
  },
  noteRow: { flexDirection: 'row', gap: S.md, alignItems: 'flex-start' },
});
