/**
 * FR6 — on-device interaction check.
 *
 * Type-ahead is not a nicety. The check can only compare medicines the table
 * recognises, so anything raising the recognition rate directly raises how much
 * of the user's list actually gets checked. Suggesting a match as they type
 * turns a spelling error into a tap instead of an unrecognised entry.
 */
import React, { useMemo, useState } from 'react';
import { View, TextInput, StyleSheet, LayoutAnimation, Animated, Pressable } from 'react-native';
import { Txt, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { ListSection, ListCustomRow } from '../components/List';
import { IOSButton } from '../components/Controls';
import { NavBar, LargeTitle, useNavScroll, useNavInset } from '../components/NavBar';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, TYPE, ROW_INSET, circle } from '../theme';
import { BundledInteractionTable } from '../../data/interactionTable';
import { CheckInteractionsUseCase } from '../../domain/checkInteractions';
import { InteractionReport } from '../../domain/medicines';

export function MedicinesScreen({ onReport }: { onReport: (r: InteractionReport) => void }) {
  const { c: P } = useTheme();
  const nav = useNavScroll();
  const topInset = useNavInset();

  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

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
    <Animated.ScrollView
      onScroll={nav.onScroll}
      scrollEventThrottle={nav.scrollEventThrottle}
      contentContainerStyle={{ paddingTop: topInset, paddingBottom: TAB_CLEARANCE + S.xxl }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <NavBar title="Medicines" y={nav.y} />
      <LargeTitle
        title="Medicines"
        subtitle={`${table.drugCount} medicines · ${table.ruleCount} interactions · offline`}
        y={nav.y}
      />

      <ListSection
        header="Add a medicine"
        footer={
          unknownDraft && suggestions.length === 0
            ? 'Not in the table. You can still add it — it will be listed as unrecognised rather than quietly skipped.'
            : 'Brand names work too — Nurofen, Panadol, Losec, Marevan.'
        }
      >
        <ListCustomRow>
          <TextInput
            style={[st.input, { color: P.ink, ...TYPE.body }]}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => add()}
            placeholder="Brand or generic name"
            placeholderTextColor={P.faint}
            autoCapitalize="words"
            autoCorrect={false}
            accessibilityLabel="Medicine name"
            returnKeyType="done"
          />
          <Pressable
            onPress={() => add()}
            disabled={!draft.trim()}
            onPressIn={() => tap('medium')}
            accessibilityLabel="Add medicine"
            style={({ pressed }) => [
              circle(30),
              st.centred,
              {
                backgroundColor: draft.trim() ? P.accent : P.sunken,
                opacity: pressed ? 0.5 : 1,
              },
            ]}
          >
            <Icon name="plus" size={18} color={draft.trim() ? P.onAccent : P.faint} weight="bold" />
          </Pressable>
        </ListCustomRow>

        {suggestions.length > 0 ? (
          <ListCustomRow>
            <View style={st.suggestions}>
              {suggestions.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => add(d.name)}
                  onPressIn={() => tap('select')}
                  accessibilityLabel={`Add ${d.name}`}
                  style={({ pressed }) => [
                    st.suggestion,
                    { backgroundColor: P.accentSoft, opacity: pressed ? 0.5 : 1 },
                  ]}
                >
                  <Txt t="footnote" c={P.accent}>{d.name}</Txt>
                </Pressable>
              ))}
            </View>
          </ListCustomRow>
        ) : null}
      </ListSection>

      {items.length > 0 ? (
        <ListSection header={`Your list · ${items.length}`}>
          {items.map((m) => {
            const known = table.resolve(m) !== null;
            return (
              <ListCustomRow key={m}>
                <View style={[st.tile, { backgroundColor: known ? P.accent : '#FF9500' }]}>
                  <Icon name={known ? 'pill' : 'alert'} size={16} color="#FFFFFF" weight="bold" />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt t="body" c={P.ink}>{m}</Txt>
                  {!known ? (
                    <Txt t="footnote" c={P.warn} style={{ marginTop: 1 }}>Not in the table</Txt>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => remove(m)}
                  onPressIn={() => tap('light')}
                  hitSlop={12}
                  accessibilityLabel={`Remove ${m}`}
                  style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 4 })}
                >
                  <Icon name="close" size={17} color={P.faint} />
                </Pressable>
              </ListCustomRow>
            );
          })}
        </ListSection>
      ) : (
        <View style={{ alignItems: 'center', paddingTop: S.xl, paddingHorizontal: S.xxl }}>
          <View style={[circle(72), st.centred, { backgroundColor: P.surface }]}>
            <Icon name="pill" size={30} color={P.faint} />
          </View>
          <Txt t="title3" c={P.ink} center style={{ marginTop: S.lg }}>No medicines added</Txt>
          <Txt t="subhead" c={P.muted} center style={{ marginTop: S.sm }}>
            Add two or more and the app checks them against a table stored on your device.
            It works with no connection.
          </Txt>
        </View>
      )}

      {items.length > 0 ? (
        <View style={{ paddingHorizontal: ROW_INSET }}>
          <IOSButton
            title={recognised < 2 ? 'Add another recognised medicine' : `Check ${recognised} medicines`}
            disabled={recognised < 2}
            icon={recognised < 2 ? undefined : 'shield'}
            onPress={() => { tap('medium'); onReport(useCase.execute(items)); }}
          />
        </View>
      ) : null}
    </Animated.ScrollView>
  );
}

const st = StyleSheet.create({
  centred: { alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: TOUCH - 6, paddingVertical: 0 },
  tile: { width: 29, height: 29, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  suggestions: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  suggestion: { paddingHorizontal: S.md, paddingVertical: 7, borderRadius: R.pill },
});
