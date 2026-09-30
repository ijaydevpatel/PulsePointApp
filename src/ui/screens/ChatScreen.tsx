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

export interface Conversation {
  readonly turns: readonly ChatTurn[];
  readonly sessionId: string | null;

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
