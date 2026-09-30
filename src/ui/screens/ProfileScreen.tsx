import React, { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { KeyboardSafe } from '../components/KeyboardSafe';
import { Card, NavCard, SectionLabel, Txt, Springy, Button, tap } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, TYPE } from '../theme';
import { Session } from '../../domain/auth';
import { ProfileService, UserProfile, ProfileEdits } from '../../domain/remote';
import { RouteKey } from '../nav/routes';

const EMPTY: UserProfile = {
  fullName: null, age: null, gender: null, heightCm: null, weightKg: null,
  bloodGroup: null, allergies: [], conditions: [], medications: [], bmi: null,
};

const toLine = (xs: readonly string[]) => xs.join(', ');
const fromLine = (s: string) => s.split(',').map((x) => x.trim()).filter((x) => x !== '');

const numberOrNull = (s: string) => {
  const n = Number(s.trim());
  return s.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
};

export function ProfileScreen({ session, service, onBack, onOpen, onSignOut }: {
  session: Session;
  service: ProfileService;
  onBack: () => void;
  onOpen: (r: RouteKey) => void;
  onSignOut: () => void | Promise<void>;
}) {
  const { c: P } = useTheme();

  const [profile, setProfile] = useState<UserProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await service.me();
    if (r.status === 'OK' && r.data) {
      setProfile(r.data);
      setNotice(null);
    } else {
      setNotice(r.notice ?? 'Your profile could not be loaded.');
    }
    setLoading(false);
  }, [service]);

  useEffect(() => { void load(); }, [load]);

  const name = profile.fullName ?? session.displayName ?? 'Your profile';
  const initial = (name.trim()[0] ?? '?').toUpperCase();

  if (editing) {
    return (
      <EditProfile
        initial={profile}
        service={service}
        onCancel={() => setEditing(false)}
        onSaved={(saved) => { setProfile(saved); setEditing(false); }}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScreenHeader title="Profile" onBack={onBack} />

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: TAB_CLEARANCE + S.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={st.identity}>
            <View style={[st.avatar, { backgroundColor: P.accent }]}>
              <Txt t="title" c={P.onAccent}>{initial}</Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt t="heading" numberOfLines={2}>{name}</Txt>
              <Txt t="caption" c={P.muted} style={{ marginTop: 2 }}>
                {session.state === 'SIGNED_IN'
                  ? 'Signed in - your health profile is saved to your account'
                  : 'Signed out - nothing is saved to an account'}
              </Txt>
            </View>
          </View>

          <View style={{ height: S.lg }} />

          <Button
            title="Edit profile"
            icon="user"
            disabled={loading || notice !== null}
            onPress={() => { tap('light'); setEditing(true); }}
          />
          {notice !== null && !loading ? (
            <Txt t="micro" c={P.faint} style={{ marginTop: S.sm, textAlign: 'center' }}>
              Editing is unavailable until your profile loads.
            </Txt>
          ) : null}
        </Card>

        <View style={{ height: S.xl }} />

        <SectionLabel>Health card</SectionLabel>

        {loading ? (
          <Card>
            <View style={st.centre}>
              <ActivityIndicator color={P.accent} />
              <Txt t="caption" c={P.muted} style={{ marginTop: S.sm }}>
                Loading your health details.
              </Txt>
            </View>
          </Card>
        ) : notice ? (
          <Card>
            <Txt t="caption" c={P.muted}>{notice}</Txt>
            <View style={{ height: S.md }} />
            <Springy onPress={() => { tap('light'); void load(); }} scaleTo={0.96}>
              <Txt t="bodyStrong" c={P.accent}>Try again</Txt>
            </Springy>
          </Card>
        ) : (
          <>
            <Card style={{ marginBottom: S.sm }}>
              <View style={st.grid}>
                <Vital label="Blood group" value={profile.bloodGroup} emphasis />
                <Vital label="Age" value={profile.age ? `${profile.age}` : null} />
                <Vital label="Height" value={profile.heightCm ? `${profile.heightCm} cm` : null} />
                <Vital label="Weight" value={profile.weightKg ? `${profile.weightKg} kg` : null} />
                <Vital label="BMI" value={profile.bmi ? `${profile.bmi}` : null} />
                <Vital label="Gender" value={profile.gender} />
              </View>
            </Card>

            <Listing label="Allergies" items={profile.allergies} tone="danger" />
            <Listing label="Conditions" items={profile.conditions} />
            <Listing label="Current medications" items={profile.medications} />
          </>
        )}

        <View style={{ height: S.xl }} />

        <SectionLabel>Activity</SectionLabel>
        <View style={{ marginBottom: S.sm }}>
          <NavCard
            title="Records"
            subtitle="Every assessment you have run, newest first"
            icon="records"
            onPress={() => { tap('light'); onOpen('records'); }}
          />
        </View>
        <View style={{ marginBottom: S.sm }}>
          <NavCard
            title="Settings"
            subtitle="Appearance, data and legal"
            icon="shield"
            onPress={() => { tap('light'); onOpen('settings'); }}
          />
        </View>

        <View style={{ height: S.xxl }} />

        {session.state === 'SIGNED_IN' ? (
          <Springy
            scaleTo={0.97}
            accessibilityLabel="Sign out"
            onPress={() => {
              tap('warn');
              Alert.alert(
                'Sign out?',
                'Your records stay on this device. The AI Doctor conversation is cleared.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign out', style: 'destructive', onPress: () => { void onSignOut(); } },
                ],
              );
            }}
          >
            <View style={st.signOut}>
              <Txt t="bodyStrong" c={P.danger}>Sign out</Txt>
            </View>
          </Springy>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Vital({ label, value, emphasis = false }: {
  label: string; value: string | null; emphasis?: boolean;
}) {
  const { c: P } = useTheme();
  return (
    <View style={st.vital}>
      <Txt t="micro" c={P.faint}>{label.toUpperCase()}</Txt>
      <Txt
        t={emphasis ? 'heading' : 'bodyStrong'}
        c={value ? P.ink : P.faint}
        style={{ marginTop: 2 }}
      >
        {value ?? 'Not recorded'}
      </Txt>
    </View>
  );
}

function Listing({ label, items, tone }: {
  label: string; items: readonly string[]; tone?: 'danger';
}) {
  const { c: P } = useTheme();
  const colour = tone === 'danger' ? P.danger : P.ink;

  return (
    <Card style={{ marginBottom: S.sm }}>
      <Txt t="micro" c={P.faint}>{label.toUpperCase()}</Txt>
      {items.length === 0 ? (
        <Txt t="body" c={P.faint} style={{ marginTop: S.xs }}>Not recorded</Txt>
      ) : (
        <View style={st.chips}>
          {items.map((x) => (
            <View
              key={x}
              style={[st.chip, {
                backgroundColor: tone === 'danger' ? P.dangerSoft : P.sunken,
              }]}
            >
              <Txt t="caption" c={colour}>{x}</Txt>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function EditProfile({ initial, service, onCancel, onSaved }: {
  initial: UserProfile;
  service: ProfileService;
  onCancel: () => void;
  onSaved: (p: UserProfile) => void;
}) {
  const { c: P } = useTheme();

  const [fullName, setFullName] = useState(initial.fullName ?? '');
  const [age, setAge] = useState(initial.age ? String(initial.age) : '');
  const [gender, setGender] = useState(initial.gender ?? '');
  const [height, setHeight] = useState(initial.heightCm ? String(initial.heightCm) : '');
  const [weight, setWeight] = useState(initial.weightKg ? String(initial.weightKg) : '');
  const [blood, setBlood] = useState(initial.bloodGroup ?? '');
  const [allergies, setAllergies] = useState(toLine(initial.allergies));
  const [conditions, setConditions] = useState(toLine(initial.conditions));
  const [medications, setMedications] = useState(toLine(initial.medications));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    tap('light');
    setSaving(true);
    setError(null);

    const edits: ProfileEdits = {
      fullName: fullName.trim() || null,
      age: numberOrNull(age),
      gender: gender.trim() || null,
      heightCm: numberOrNull(height),
      weightKg: numberOrNull(weight),
      bloodGroup: blood.trim().toUpperCase() || null,
      allergies: fromLine(allergies),
      conditions: fromLine(conditions),
      medications: fromLine(medications),
    };

    const r = await service.save(edits);
    setSaving(false);

    if (r.status === 'OK' && r.data) {
      tap('light');
      onSaved(r.data);
    } else {
      tap('warn');
      setError(r.notice ?? 'That could not be saved. Your changes are still here.');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: P.bg }}>
      <ScreenHeader title="Edit profile" onBack={onCancel} />

      <KeyboardSafe extra={TAB_CLEARANCE}>
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: S.xl, paddingBottom: TAB_CLEARANCE + S.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Field label="Full name" value={fullName} onChange={setFullName} placeholder="As your clinician knows you" />
          <Field label="Age" value={age} onChange={setAge} keyboard="number-pad" placeholder="Years" />
          <Field label="Gender" value={gender} onChange={setGender} placeholder="How you describe yourself" />
          <Field label="Height" value={height} onChange={setHeight} keyboard="number-pad" placeholder="Centimetres" />
          <Field label="Weight" value={weight} onChange={setWeight} keyboard="number-pad" placeholder="Kilograms" />
          <Field label="Blood group" value={blood} onChange={setBlood} placeholder="O+, AB-, and so on" autoCaps />

          <View style={{ height: S.md }} />
          <SectionLabel>Separate each one with a comma</SectionLabel>

          <Field label="Allergies" value={allergies} onChange={setAllergies} placeholder="Penicillin, peanuts" multiline />
          <Field label="Conditions" value={conditions} onChange={setConditions} placeholder="Asthma, type 2 diabetes" multiline />
          <Field label="Current medications" value={medications} onChange={setMedications} placeholder="Metformin 500mg, salbutamol" multiline />

          {error ? (
            <>
              <View style={{ height: S.md }} />
              <Card>
                <Txt t="caption" c={P.danger}>{error}</Txt>
              </Card>
            </>
          ) : null}

          <View style={{ height: S.xl }} />
          {saving ? (
            <View style={[st.saving, { backgroundColor: P.accent }]}>
              <ActivityIndicator color={P.onAccent} />
            </View>
          ) : (
            <Button title="Save" icon="check" onPress={() => { void save(); }} />
          )}

          <View style={{ height: S.md }} />
          <Springy onPress={onCancel} scaleTo={0.97}>
            <View style={st.signOut}>
              <Txt t="bodyStrong" c={P.muted}>Cancel</Txt>
            </View>
          </Springy>
        </ScrollView>
      </KeyboardSafe>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboard, multiline, autoCaps }: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  keyboard?: 'number-pad';
  multiline?: boolean;
  autoCaps?: boolean;
}) {
  const { c: P } = useTheme();
  return (
    <View style={{ marginBottom: S.md }}>
      <Txt t="micro" c={P.faint} style={{ marginBottom: S.xs }}>{label.toUpperCase()}</Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={P.faint}
        keyboardType={keyboard ?? 'default'}
        autoCapitalize={autoCaps ? 'characters' : 'sentences'}
        autoCorrect={false}
        multiline={multiline}
        style={[
          st.input,
          { backgroundColor: P.surface, borderColor: P.line, color: P.ink, ...TYPE.body },
          multiline ? { minHeight: TOUCH + 18, textAlignVertical: 'top' } : null,
        ]}
        accessibilityLabel={label}
      />
    </View>
  );
}

const st = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: S.lg },
  avatar: {
    width: 62, height: 62, borderRadius: 31,
    alignItems: 'center', justifyContent: 'center',
  },
  centre: { alignItems: 'center', paddingVertical: S.lg },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  vital: { width: '50%', paddingVertical: S.sm },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.xs, marginTop: S.sm },
  chip: { paddingHorizontal: S.md, paddingVertical: 5, borderRadius: R.pill },

  input: {
    minHeight: TOUCH + 4, borderRadius: R.md, borderWidth: 1.5,
    paddingHorizontal: S.lg, paddingVertical: S.sm,
  },
  saving: {
    height: TOUCH + 8, borderRadius: R.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  signOut: { alignItems: 'center', paddingVertical: S.lg },
});
