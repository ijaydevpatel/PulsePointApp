/**
 * AI Doctor - a conversation over POST /api/chat/message.
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
 * alternative - a spinner that stops - is the "Awaiting Synchronization" bug
 * this project exists to avoid. Every path leaves something on screen.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TextInput, ActivityIndicator,
} from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { KeyboardSafe } from '../components/KeyboardSafe';
import { Txt, Springy, tap, EmptyState } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BAR_PAD } from '../nav/routes';
import { useTheme, S, R, TOUCH, TYPE } from '../theme';
import { ChatService, ChatTurn } from '../../domain/remote';

let seq = 0;
const nextId = () => `t${++seq}`;

/**
 * The conversation, which outlives this screen.
 *
 * It used to be local state. That was fine when the chat was a page you
 * pushed and popped, and wrong the moment it became a tab: switching to
 * Symptoms and back unmounts the screen, and every turn went with it. Nothing
 * had refreshed - the component had simply been thrown away and rebuilt.
 *
 * So the turns and the session id are held by the caller and handed back down.
 * `draft` and `busy` stay local on purpose: a half-typed line and a spinner
 * belong to the moment, not to the conversation.
 */
export interface Conversation {
  readonly turns: readonly ChatTurn[];
  readonly sessionId: string | null;
  /** Whether the opening greeting has already been fetched. */
  readonly greeted: boolean;
}

export const EMPTY_CONVERSATION: Conversation = {
  turns: [], sessionId: null, greeted: false,
};

export function ChatScreen({ service, onBack, conversation, onConversation }: {
  service: ChatService;
  onBack?: () => void;
  conversation: Conversation;
  onConversation: (c: Conversation) => void;
}) {
  const { c: P } = useTheme();
  const insets = useSafeAreaInsets();

  /*
   * Enough room for the floating tab bar, and not a pixel more.
   *
   * This used to reserve TAB_CLEARANCE + S.md - 112dp - which is the right
   * allowance for a scrolling page that has to end clear of the bar, and far
   * too much for a composer pinned directly above it. The surplus rendered as
   * a band of empty white between the input and the bar.
   *
   * The bar is one touch target tall plus its own padding, and sits that far
   * up from the safe area. Computed rather than guessed, so it stays correct
   * on a device with gesture navigation and on one without.
   */
  const barHeight = TOUCH + BAR_PAD * 2;
  const composerGap = Math.max(insets.bottom, S.sm) + S.xs + barHeight + S.sm;

  const { turns, sessionId } = conversation;
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [greeting, setGreeting] = useState<'loading' | 'done'>(
    conversation.greeted ? 'done' : 'loading',
  );

  const scroller = useRef<ScrollView>(null);
  const toBottom = useCallback(() => {
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
  }, []);

  /*
   * Opening greeting, fetched once per conversation rather than once per
   * mount - otherwise returning to the tab would prepend a fresh hello to a
   * chat that was already under way.
   *
   * A failure here is not worth a banner: the screen still works, so it
   * degrades to an empty conversation.
   */
  useEffect(() => {
    if (conversation.greeted) { setGreeting('done'); return; }

    let alive = true;
    (async () => {
      const r = await service.greeting();
      if (!alive) return;

      onConversation({
        turns: r.status === 'OK' && r.data
          ? [{ id: nextId(), role: 'assistant', text: r.data.greeting }]
          : [],
        sessionId: null,
        greeted: true,
      });
      setGreeting('done');
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, conversation.greeted]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || busy) return;

    tap('light');
    setDraft('');

    const asked: readonly ChatTurn[] = [
      ...turns, { id: nextId(), role: 'user', text: message },
    ];
    onConversation({ turns: asked, sessionId, greeted: true });
    setBusy(true);
    toBottom();

    const r = await service.send(message, sessionId);

    if (r.status === 'OK' && r.data) {
      onConversation({
        turns: [...asked, { id: nextId(), role: 'assistant', text: r.data.reply }],
        sessionId: r.data.sessionId || sessionId,
        greeted: true,
      });
    } else {
      // The notice is always populated when status is not OK, so this cannot
      // append an empty bubble.
      onConversation({
        turns: [...asked, { id: nextId(), role: 'assistant', text: r.notice ?? 'Something went wrong.' }],
        sessionId,
        greeted: true,
      });
      tap('warn');
    }
    setBusy(false);
    toBottom();
  }, [busy, turns, sessionId, service, toBottom, onConversation]);

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScreenHeader title="AI Doctor" subtitle="Ask a health question" onBack={onBack} />

      {/*
        Was a KeyboardAvoidingView doing nothing on Android, which stopped
        being harmless once edge-to-edge meant the window no longer resized -
        the keyboard then sat over the composer. `extra` is the tab bar the
        composer already clears. See KeyboardSafe.
      */}
      <KeyboardSafe extra={barHeight}>
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

        <View style={[
          st.composer,
          { backgroundColor: P.surface, borderTopColor: P.line, paddingBottom: composerGap },
        ]}>
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
      </KeyboardSafe>
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
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: S.sm,
    paddingHorizontal: S.md, paddingTop: S.sm,
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
