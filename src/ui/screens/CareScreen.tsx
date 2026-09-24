/**
 * Health facilities near the person: a map, and the same places as a list.
 *
 * ── What this replaced ───────────────────────────────────────────────────────
 *
 * Four invented Auckland facilities behind a "Phase 6" notice. On a screen
 * whose entire job is to say where to go, sample data is worse than an empty
 * screen: it is indistinguishable from a working feature until someone drives
 * to a clinic that does not exist.
 *
 * ── Map and list, not map or list ────────────────────────────────────────────
 *
 * The map answers "what is around me"; the list answers "which is nearest and
 * is it open". Neither answers both, and on a phone the list is the one that
 * survives a bad connection - the tiles can fail while the data is already
 * here, so the list renders from the same array either way.
 *
 * ── The two flags ────────────────────────────────────────────────────────────
 *
 * Open 24 hours and Urgent care are called out because they are the reason
 * this screen gets opened at night. Both come from OSM tags and neither is
 * inferred: an untagged facility simply shows neither, rather than being
 * described as closed.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, ScrollView, StyleSheet, TextInput, Linking, Platform, ActivityIndicator,
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card, SectionLabel, Txt, Springy, Enter, tap } from '../components/Primitives';
import { Icon, IconName } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, TYPE, Palette } from '../theme';
import {
  Facility, FacilityKind, FacilityService, KIND_LABEL, matches,
} from '../../domain/facilities';
import { Fix } from '../../data/locationFix';

/*
 * No API key, and none needed.
 *
 * MapLibre is the same engine the website uses. The style below is a public
 * demo tile source; swapping it for a paid provider is a one-line change here
 * and nothing else in this file would move.
 */
MapLibreGL.setAccessToken(null);

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/** One colour per category, so a pin and its row read as the same thing. */
function kindColour(P: Palette, kind: FacilityKind): string {
  switch (kind) {
    case 'HOSPITAL':
    case 'URGENT_CARE':   return P.danger;
    case 'PHARMACY':      return P.ok;
    case 'CLINIC':        return P.accent;
    case 'DENTIST':       return '#8F97FF';
    case 'EYE_CARE':      return '#3ECFCF';
    case 'LABORATORY':    return P.warn;
    case 'ALTERNATIVE':   return '#3ECF98';
    default:              return P.muted;
  }
}

const KIND_ICON: Record<FacilityKind, IconName> = {
  HOSPITAL: 'alert',
  URGENT_CARE: 'alert',
  CLINIC: 'pulse',
  DENTIST: 'shield',
  PHARMACY: 'pill',
  EYE_CARE: 'eye',
  LABORATORY: 'file',
  ALTERNATIVE: 'shield',
  OTHER: 'pin',
};

/** Opens the platform's own maps app, which knows about routes and traffic. */
function openDirections(f: Facility) {
  const label = encodeURIComponent(f.name);
  const url = Platform.select({
    ios: `maps://?daddr=${f.lat},${f.lon}&q=${label}`,
    default: `geo:${f.lat},${f.lon}?q=${f.lat},${f.lon}(${label})`,
  });
  if (url) void Linking.openURL(url).catch(() => {
    void Linking.openURL(`https://www.openstreetmap.org/?mlat=${f.lat}&mlon=${f.lon}#map=18/${f.lat}/${f.lon}`);
  });
}

export function CareScreen({ service, fix }: {
  service?: FacilityService;
  /** Where to search from. Null while the location is still being resolved. */
  fix?: Fix | null;
}) {
  const { c: P } = useTheme();

  const [facilities, setFacilities] = useState<readonly Facility[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!service || !fix) return;
    setBusy(true);
    const r = await service.near({ lat: fix.lat, lon: fix.lon });
    setFacilities(r.facilities);
    setNotice(r.notice);
    setBusy(false);
  }, [service, fix]);

  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(
    () => facilities.filter((f) => matches(f, query)),
    [facilities, query],
  );

  const pins = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: shown.map((f) => ({
      type: 'Feature' as const,
      id: f.id,
      geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] },
      properties: { colour: kindColour(P, f.kind) },
    })),
  }), [shown, P]);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: TAB_CLEARANCE + S.xxl }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader
        title="Care near you"
        subtitle={fix?.place ? `Around ${fix.place}` : 'Health facilities nearby'}
      />

      <View style={{ paddingHorizontal: S.xl }}>
        {/*
          Not wrapped in Enter: it re-renders on every keystroke, and an
          entrance animation around a focused field is one more thing that can
          interfere while someone is typing in it.
        */}
        <View style={[st.search, { borderColor: P.line, backgroundColor: P.surface }]}>
          <Icon name="search" size={18} color={P.faint} />
          <TextInput
            style={[st.searchInput, { color: P.ink, ...TYPE.body }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Filter by name or type"
            placeholderTextColor={P.faint}
            autoCorrect={false}
            accessibilityLabel="Filter facilities"
          />
        </View>

        <View style={{ height: S.lg }} />

        <View style={[st.mapFrame, { borderColor: P.line, backgroundColor: P.sunken }]}>
          {fix ? (
            <MapLibreGL.MapView style={st.map} mapStyle={STYLE_URL} logoEnabled={false}>
              <MapLibreGL.Camera
                defaultSettings={{ centerCoordinate: [fix.lon, fix.lat], zoomLevel: 13 }}
              />
              <MapLibreGL.UserLocation visible />

              <MapLibreGL.ShapeSource id="facilities" shape={pins}>
                <MapLibreGL.CircleLayer
                  id="facility-pins"
                  style={{
                    circleRadius: 6,
                    circleColor: ['get', 'colour'],
                    circleStrokeWidth: 2,
                    circleStrokeColor: '#FFFFFF',
                  }}
                />
              </MapLibreGL.ShapeSource>
            </MapLibreGL.MapView>
          ) : (
            <View style={st.mapPlaceholder}>
              <ActivityIndicator color={P.accent} />
              <Txt t="caption" c={P.muted} style={{ marginTop: S.sm }}>
                Finding where you are
              </Txt>
            </View>
          )}
        </View>

        <View style={{ height: S.xl }} />

        <View style={st.listHead}>
          <SectionLabel style={{ marginBottom: 0 }}>Nearest first</SectionLabel>
          {!busy ? (
            <Txt t="micro" c={P.faint}>
              {`${shown.length} ${shown.length === 1 ? 'place' : 'places'}`}
            </Txt>
          ) : null}
        </View>

        {busy ? (
          <Card elevated={1}>
            <Txt t="caption" c={P.muted}>Looking for health facilities nearby.</Txt>
          </Card>
        ) : null}

        {!busy && notice ? (
          <Card elevated={1}>
            <Txt t="caption" c={P.muted}>{notice}</Txt>
            <View style={{ height: S.md }} />
            <Springy onPress={() => { tap('light'); void load(); }} scaleTo={0.96}>
              <Txt t="bodyStrong" c={P.accent}>Try again</Txt>
            </Springy>
          </Card>
        ) : null}

        {!busy && !notice && shown.length === 0 ? (
          <Card elevated={1}>
            <Txt t="caption" c={P.muted}>
              {`Nothing matches "${query.trim()}". Clear the filter to see everything nearby.`}
            </Txt>
          </Card>
        ) : null}

        {shown.slice(0, 60).map((f, i) => (
          <Enter key={f.id} index={Math.min(i, 9)}>
            <Card style={{ marginBottom: S.sm }} onPress={() => { tap('light'); openDirections(f); }}>
              <View style={st.row}>
                <View style={[st.dot, { backgroundColor: kindColour(P, f.kind) }]}>
                  <Icon name={KIND_ICON[f.kind]} size={15} color="#FFFFFF" weight="bold" />
                </View>

                <View style={{ flex: 1 }}>
                  <Txt t="bodyStrong" numberOfLines={2}>{f.name}</Txt>
                  <Txt t="caption" c={P.muted} style={{ marginTop: 2 }}>
                    {`${KIND_LABEL[f.kind]} · ${f.km < 1 ? `${Math.round(f.km * 1000)} m` : `${f.km.toFixed(1)} km`}`}
                  </Txt>

                  {f.urgent || f.open24h ? (
                    <View style={st.flags}>
                      {f.urgent ? (
                        <View style={[st.flag, { backgroundColor: P.dangerSoft }]}>
                          <Txt t="micro" c={P.danger}>URGENT CARE</Txt>
                        </View>
                      ) : null}
                      {f.open24h ? (
                        // No okSoft token exists, and inventing one would put a
                        // colour outside the audited palette on screen.
                        <View style={[st.flag, { backgroundColor: P.sunken }]}>
                          <Txt t="micro" c={P.ok}>OPEN 24 HOURS</Txt>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                <Icon name="arrowRight" size={17} color={P.faint} />
              </View>
            </Card>
          </Enter>
        ))}

        {shown.length > 60 ? (
          <Txt t="caption" c={P.faint} style={{ marginTop: S.sm }}>
            {`Showing the 60 nearest of ${shown.length}. Filter to narrow it down.`}
          </Txt>
        ) : null}

        <View style={{ height: S.xl }} />
        <View style={[st.meta, { borderColor: P.line }]}>
          <Icon name="alert" size={16} color={P.muted} />
          <Txt t="caption" style={{ flex: 1 }}>
            Places and opening hours come from OpenStreetMap and can be out of
            date. Distances are straight-line, not travel distance. Ring ahead
            before setting out.
          </Txt>
        </View>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    minHeight: TOUCH + 4, borderRadius: R.pill, borderWidth: 1.5,
    paddingHorizontal: S.xl,
  },
  searchInput: { flex: 1, paddingVertical: S.sm },

  mapFrame: {
    height: 260, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  map: { flex: 1 },
  mapPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  listHead: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: S.sm,
  },
  row: { flexDirection: 'row', gap: S.lg, alignItems: 'center' },
  dot: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  flags: { flexDirection: 'row', gap: S.xs, marginTop: 6, flexWrap: 'wrap' },
  flag: { paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: R.pill },

  meta: {
    flexDirection: 'row', gap: S.sm, alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: R.md, padding: S.md,
  },
});
