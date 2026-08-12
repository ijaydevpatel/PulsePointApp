/** FR6 — on-device interaction check. Phase 3 supplies the table. */
import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Card, SectionLabel, EmptyState, PhaseNotice } from '../components/Primitives';
import { C, S, R, T, TOUCH } from '../theme';

export function MedicinesScreen() {
  const [items, setItems] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) setItems([...items, v]);
    setDraft('');
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: S.xxxl }} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Medicines" subtitle="Checked against an on-device table — works offline" />
      <View style={{ paddingHorizontal: S.xl }}>
        <SectionLabel>YOUR MEDICINES</SectionLabel>
        <View style={{ flexDirection: 'row', gap: S.sm }}>
          <TextInput
            style={st.input} value={draft} onChangeText={setDraft} onSubmitEditing={add}
            placeholder="Add a medicine" placeholderTextColor={C.faint}
            autoCapitalize="words" accessibilityLabel="Medicine name" returnKeyType="done"
          />
        </View>
        <View style={{ height: S.md }} />
        <Button title="Add" tone="quiet" onPress={add} disabled={!draft.trim()} />

        <View style={{ height: S.xl }} />
        {items.length === 0 ? (
          <EmptyState
            title="No medicines added"
            body="Add two or more and the app will flag any known interactions between them."
          />
        ) : (
          <>
            {items.map((m) => (
              <Card key={m} style={{ marginBottom: S.sm, paddingVertical: S.md }}>
                <Text style={T.bodyStrong}>{m}</Text>
              </Card>
            ))}
            <View style={{ height: S.lg }} />
            <PhaseNotice phase={3}
              what="The interaction table and the conflict screen land next. Unlike the web version this runs from a local table, so it cannot fail silently when the network drops." />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  input: { flex: 1, minHeight: TOUCH + 6, borderRadius: R.md, borderWidth: 1.5,
    borderColor: C.line, backgroundColor: C.surface, paddingHorizontal: S.lg,
    fontSize: 16, color: C.ink },
});
