import React from 'react';
import { View, ScrollView } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { PhaseNotice, Button, Card, Txt, Enter } from '../components/Primitives';
import { Icon, IconName } from '../components/Icon';
import { Session } from '../../domain/auth';
import { useTheme, S, circle } from '../theme';

function Shell({ title, sub, onBack, phase, what, icon }: {
  title: string; sub?: string; onBack?: () => void;
  phase: number; what: string; icon: IconName;
}) {
  const { c: P } = useTheme();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: S.huge }} showsVerticalScrollIndicator={false}>
      <ScreenHeader title={title} subtitle={sub} onBack={onBack} />
      <View style={{ paddingHorizontal: S.xl }}>
        <Enter index={1}>
          <View style={{ alignItems: 'center', paddingVertical: S.xl }}>
            <View style={[circle(78), {
              backgroundColor: P.sunken, alignItems: 'center', justifyContent: 'center',
            }]}>
              <Icon name={icon} size={30} color={P.faint} />
            </View>
          </View>
        </Enter>
        <Enter index={2}>
          <PhaseNotice phase={phase} what={what} />
        </Enter>
      </View>
    </ScrollView>
  );
}

export const CheckInScreen = ({ onBack }: { onBack: () => void }) => (
  <Shell title="Daily check-in" sub="Feeds your trend and streak" onBack={onBack} phase={5} icon="clock"
    what="A short daily entry - how you slept, how you feel, anything new. It drives the trend line and the streak, both stored locally." />
);

export const DocumentsScreen = ({ onBack }: { onBack?: () => void }) => (
  <Shell title="Documents" sub="Extracted on-device" onBack={onBack} phase={10} icon="records"
    what="Import a PDF or photo of a report. Text extraction runs on the device, so nothing is uploaded - a privacy improvement over the web version." />
);

export const NewsScreen = ({ onBack }: { onBack?: () => void }) => (
  <Shell title="Health news" sub="Cached for offline reading" onBack={onBack} phase={11} icon="search"
    what="A short digest, cached on the device so it stays readable with no connection." />
);

export const ChatScreen = ({ onBack }: { onBack?: () => void }) => (
  <Shell title="Ask a question" sub="Needs a connection" onBack={onBack} phase={11} icon="more"
    what="The one feature that genuinely cannot work offline. It is marked as such rather than failing quietly." />
);

