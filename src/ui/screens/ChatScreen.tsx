/**
 * AI Doctor — a conversation over POST /api/chat/message.
 *
 * ── The session id is the whole feature ──────────────────────────────────────
 *
 * The backend stores each conversation in ChatSession and returns a sessionId
 * on the first reply. Send it back on every turn after and the model keeps its
 * context; drop it and every message starts a fresh conversation, which looks
 * like the assistant developing amnesia mid-sentence. It is held in state here
 * rather than passed around, so there is exactly one of it.
 *
 * ── Failures are turns, not silences ─────────────────────────────────────────
 *
 * A failed send appends a visible assistant turn carrying the notice. The
 * alternative — a spinner that stops — is the "Awaiting Synchronization" bug
 * this project exists to avoid. Every path leaves something on screen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Txt, Springy, tap, EmptyState } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, TYPE } from '../theme';
import { ChatService, ChatTurn } from '../../domain/remote';

let seq = 0;
const nextId = () => `t${++seq}`;

export function ChatScreen({ service }: { service: ChatService }) {
  const { c: P } = useTheme();

  const [turns, setTurns] = useState<readonly ChatTurn[]>([]);
  const [suggestions, setSuggestions] = useState<readonly string[]>([]);
  const [draft, setDraft] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [greeting, setGreeting] = useState<'loading' | 'done'>('loading');

  const scroller = useRef<ScrollView>(null);
  const toBottom = useCallback(() => {
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
  }, []);

  // Opening greeting. A failure here is not worth a banner — the screen is
  // still usable, so it degrades to an empty conversation.
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await service.greeting();
      if (!alive) return;
      if (r.status === 'OK' && r.data) {
        setTurns([{ id: nextId(), role: 'assistant', text: r.data.greeting }]);
        setSuggestions(r.data.suggestions);
      }
      setGreeting('done');
    })();
    return () => { alive = false; };
  }, [service]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;

    tap('light');
    setDraft('');
    setSuggestions([]);
    setTurns((t) => [...t, { id: nextId(), role: 'user', text: message }]);
    setBusy(true);
    toBottom();

    const r = await service.send(message, sessionId);

    if (r.status === 'OK' && r.data) {
      if (r.data.sessionId) setSessionId(r.data.sessionId);
      setTurns((t) => [...t, { id: nextId(), role: 'assistant', text: r.data!.reply }]);
    } else {
      // The notice is always populated when status is not OK, so this cannot
      // append an empty bubble.
      setTurns((t) => [...t, { id: nextId(), role: 'assistant', text: r.notice ?? 'Something went wrong.' }]);
      tap('warn');
    }
    setBusy(false);
    toBottom();
  }, [busy, sessionId, service, toBottom]);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScreenHeader title="AI Doctor" subtitle="Ask a health question" />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          ref={scroller}
          contentContainerStyle={st.thread}
          onContentSizeChange={toBottom}
          keyboardShouldPersistTaps="handled"
        >
          {greeting === 'loading' ? (
            <View style={st.centre}><ActivityIndicator color={P.accent} /></View>
          ) : turns.length === 0 ? (
            <EmptyState
              icon="message"
              title="Ask anything"
              body="Describe what you are feeling, or ask about a medicine."
            />
          ) : null}

          {turns.map((t) => (
            <Bubble key={t.id} turn={t} />
          ))}

          {busy ? (
            <View style={[st.bubble, st.assistant, { backgroundColor: P.surface, borderColor: P.line }]}>
              <ActivityIndicator size="small" color={P.muted} />
            </View>
          ) : null}
        </ScrollView>

        {suggestions.length > 0 && !busy ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.chips}
            keyboardShouldPersistTaps="handled"
          >
            {suggestions.map((sug) => (
              <Springy key={sug} onPress={() => void send(sug)} scaleTo={0.96}>
                <View style={[st.chip, { backgroundColor: P.sunken, borderColor: P.line }]}>
                  <Txt t="caption" c={P.inkSoft} numberOfLines={1}>{sug}</Txt>
                </View>
              </Springy>
            ))}
          </ScrollView>
        ) : null}

        <View style={[st.composer, { backgroundColor: P.surface, borderTopColor: P.line }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask a question"
            placeholderTextColor={P.faint}
            style={[st.input, { backgroundColor: P.sunken, color: P.ink, ...TYPE.body }]}
            multiline
            maxLength={1000}
            editable={!busy}
            onSubmitEditing={() => void send(draft)}
            returnKeyType="send"
          />
          <Springy onPress={() => void send(draft)} scaleTo={0.9} accessibilityLabel="Send">
            <View
              style={[
                st.sendBtn,
                { backgroundColor: draft.trim() && !busy ? P.accent : P.sunken },
              ]}
            >
              <Icon
                name="arrowRight"
                size={19}
                color={draft.trim() && !busy ? P.onAccent : P.faint}
              />
            </View>
          </Springy>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({ turn }: { turn: ChatTurn }) {
  const { c: P } = useTheme();
  const mine = turn.role === 'user';
  return (
    <View
      style={[
        st.bubble,
        mine ? st.user : st.assistant,
        mine
          ? { backgroundColor: P.accent }
          : { backgroundColor: P.surface, borderColor: P.line, borderWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Txt t="body" c={mine ? P.onAccent : P.ink}>{turn.text}</Txt>
    </View>
  );
}

const st = StyleSheet.create({
  thread: { padding: S.md, paddingBottom: S.lg, gap: S.sm },
  centre: { paddingVertical: S.xl, alignItems: 'center' },
  bubble: { maxWidth: '86%', paddingHorizontal: S.md, paddingVertical: S.sm + 2, borderRadius: R.lg },
  user: { alignSelf: 'flex-end', borderBottomRightRadius: R.xs },
  assistant: { alignSelf: 'flex-start', borderBottomLeftRadius: R.xs },
  chips: { paddingHorizontal: S.md, paddingBottom: S.sm, gap: S.sm },
  chip: {
    paddingHorizontal: S.md, paddingVertical: S.sm,
    borderRadius: R.pill, borderWidth: StyleSheet.hairlineWidth, maxWidth: 260,
  },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: S.sm,
    paddingHorizontal: S.md, paddingTop: S.sm,
    paddingBottom: TAB_CLEARANCE - 40,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, minHeight: TOUCH, maxHeight: 120,
    borderRadius: R.lg, paddingHorizontal: S.md, paddingTop: S.sm + 2, paddingBottom: S.sm + 2,
  },
  sendBtn: {
    width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2,
    alignItems: 'center', justifyContent: 'center',
  },
});
