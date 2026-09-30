import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, TextInput, Linking, Platform, ActivityIndicator,
  Animated, PanResponder, FlatList, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt, Springy, Card, Button, tap } from '../components/Primitives';
import { Icon, IconName } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, TYPE, Palette } from '../theme';
import {
  Facility, FacilityKind, FacilityService, KIND_LABEL, matches, byDistance,
} from '../../domain/facilities';
import { Fix, FixOutcome, preciseFix, recentPreciseFix } from '../../data/locationFix';
import { readFacilityCache, writeFacilityCache } from '../../data/facilityCache';

const MAPLIBRE_MODULE = '@maplibre/maplibre-react-native';

let MapLibreGL: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const mod = require(MAPLIBRE_MODULE);
  MapLibreGL = mod?.default ?? mod;
  if (!MapLibreGL?.Map || !MapLibreGL?.Camera || !MapLibreGL?.GeoJSONSource || !MapLibreGL?.Layer) {
    MapLibreGL = null;
  }
} catch {
  MapLibreGL = null;
}

const STYLE_URL = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

const ME_BLUE = '#1B6EF3';

const PEEK = 132 + TAB_CLEARANCE;

const SHEET_TOP_GAP = 76;

const TAP_SLOP = 14;

const RINGS = [0.012, 0.03, 0.06] as const;

const FLICK = 0.5;

function kindColour(P: Palette, kind: FacilityKind): string {
  switch (kind) {
    case 'HOSPITAL':
    case 'URGENT_CARE':   return P.danger;
    case 'PHARMACY':      return P.ok;
    case 'CLINIC':        return P.accent;
    case 'DENTIST':       return '#8F97FF';
    case 'EYE_CARE':      return '#3ECFCF';
    case 'LABORATORY':    return P.warn;
    case 'THERAPY':       return '#5B8DEF';
    case 'CARE_HOME':     return '#B07BD8';
    case 'SUPPLIES':      return '#7A8699';
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
  THERAPY: 'pulse',
  CARE_HOME: 'home',
  SUPPLIES: 'shield',
  ALTERNATIVE: 'shield',
  OTHER: 'pin',
};

const PROBLEM: Record<Exclude<FixOutcome['kind'], 'ok'>, string> = {
  denied: 'PulsePoint cannot read your location. Allow location access in '
    + 'Settings to see where you are.',
  off: 'Location is switched off on this device. Turn it on to see where you are.',
  mocked: 'This device is reporting a simulated location, so it is not being '
    + 'used. On an emulator this is normal.',
  unavailable: 'Your device has not produced a location fix yet. This can take '
    + 'a minute indoors.',
};

function whereFrom(fix: Fix | null): string {
  if (!fix) return 'FINDING YOU';

  if (fix.source === 'device') {
    const m = fix.accuracyM;
    if (typeof m !== 'number') return 'YOUR LOCATION';
    return m < 1000
      ? `YOUR LOCATION · ±${Math.round(m)} M`
      : `YOUR LOCATION · ±${(m / 1000).toFixed(1)} KM`;
  }

  const place = fix.place ? fix.place.toUpperCase() : 'YOUR AREA';
  return fix.source === 'network'
    ? `APPROXIMATE · ${place}`
    : `${place} · TIME ZONE ONLY`;
}

const distance = (km: number) =>
  (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

async function openDirections(f: Facility) {
  const dest = `${f.lat},${f.lon}`;
  const label = encodeURIComponent(f.name);

  const candidates = Platform.OS === 'ios'
    ? [
      `maps://?daddr=${dest}&dirflg=d`,
      `https://www.google.com/maps/dir/?api=1&destination=${dest}`,
    ]
    : [
      `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`,
      `geo:${dest}?q=${dest}(${label})`,
    ];

  for (const url of [
    ...candidates,
    `https://www.openstreetmap.org/?mlat=${f.lat}&mlon=${f.lon}#map=18/${f.lat}/${f.lon}`,
  ]) {
    try {
      await Linking.openURL(url);
      return;
    } catch {
    }
  }
}

export function CareScreen({ service, fix: given, onSearched }: {
  service?: FacilityService;

  fix?: Fix | null;

  onSearched?: (count: number, place: string | null) => void;
}) {
  const { c: P, scheme } = useTheme();

  const [precise, setPrecise] = useState<Fix | null>(() => recentPreciseFix());
  const [tried, setTried] = useState(() => recentPreciseFix() !== null);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<Exclude<FixOutcome['kind'], 'ok'> | null>(null);

  const fix = precise ?? (tried ? given ?? null : null);

  const sharpen = useCallback(async () => {
    setLocating(true);
    const outcome = await preciseFix();

    if (outcome.kind === 'ok') {
      setPrecise(outcome.fix);
      setProblem(null);
    } else {
      setProblem(outcome.kind);
    }

    setTried(true);
    setLocating(false);
    return outcome.kind === 'ok' ? outcome.fix : null;
  }, []);

  useEffect(() => {
    if (recentPreciseFix()) return;
    void sharpen();
  }, [sharpen]);
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const [facilities, setFacilities] = useState<readonly Facility[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [diagnostics, setDiagnostics] = useState<string | null>(null);

  const shownCount = useRef(0);

  const searchRun = useRef(0);
  const [widening, setWidening] = useState(false);

  const searched = useRef(onSearched);
  searched.current = onSearched;
  const [busy, setBusy] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const camera = useRef<any>(null);
  const map = useRef<any>(null);

  const load = useCallback(async () => {
    if (!service || !fix) return;

    const run = ++searchRun.current;
    const alive = () => searchRun.current === run;

    const warm = readFacilityCache(fix.lat, fix.lon);
    if (warm && warm.length > 0) {
      shownCount.current = warm.length;
      setFacilities(warm);
      setBusy(false);
      setWidening(true);
    } else {
      setBusy(true);
    }

    setNotice(null);
    setStale(false);

    const found = new Map<string, Facility>();
    if (warm) for (const f of warm) found.set(f.id, f);
    let answered = false;
    let lastNotice: string | null = null;
    let lastDiagnostics: string | null = null;
    let widestReached = false;

    for (const radiusDeg of RINGS) {
      const r = await service.near({ lat: fix.lat, lon: fix.lon, radiusDeg });
      if (!alive()) return;

      lastNotice = r.notice;
      lastDiagnostics = r.diagnostics ?? null;

      if (!r.ok) {
        if (!answered) break;
        widestReached = false;
        continue;
      }

      widestReached = radiusDeg === RINGS[RINGS.length - 1];

      answered = true;
      for (const f of r.facilities) found.set(f.id, f);

      const merged = [...found.values()].sort(byDistance);
      shownCount.current = merged.length;
      setFacilities(merged);
      setNotice(null);
      setBusy(false);
      setWidening(radiusDeg !== RINGS[RINGS.length - 1]);
    }

    if (!alive()) return;
    setWidening(false);
    setBusy(false);

    if (answered) {
      writeFacilityCache(fix.lat, fix.lon, [...found.values()]);
      if (found.size === 0) {
        setDiagnostics(null);
        setNotice('No health facilities are mapped around here.');
      } else if (!widestReached) {
        setDiagnostics(lastDiagnostics);
        setNotice('The wider search did not finish, so this is what is close by.');
      } else {
        setDiagnostics(null);
        setNotice(null);
      }
      searched.current?.(found.size, fix.place ?? null);
      return;
    }

    setDiagnostics(lastDiagnostics);

    if (shownCount.current > 0) {
      setStale(true);
      setNotice(lastNotice ?? 'Nothing could be loaded for this area.');
      return;
    }

    setNotice(lastNotice ?? 'Nothing could be loaded for this area.');
  }, [service, fix]);

  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(
    () => facilities.filter((f) => matches(f, query)),
    [facilities, query],
  );

  const chosen = useMemo(
    () => facilities.find((f) => f.id === selected) ?? null,
    [facilities, selected],
  );

  const pins = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: shown.map((f) => ({
      type: 'Feature' as const,
      id: f.id,
      geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] },
      properties: {
        id: f.id,
        label: f.named ? f.name : '',
        colour: kindColour(P, f.kind),
        radius: f.id === selected ? 11 : 6,
        stroke: f.id === selected ? 3 : 2,
        size: f.id === selected ? 13 : 11,
        sort: f.id === selected ? 0 : 1,
      },
    })),
  }), [shown, P, selected]);

  const me = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: precise
      ? [{
        type: 'Feature' as const,
        id: 'me',
        geometry: { type: 'Point' as const, coordinates: [precise.lon, precise.lat] },
        properties: {},
      }]
      : [],
  }), [precise]);

  const sheetTop = insets.top + SHEET_TOP_GAP;
  const sheetH = Math.max(PEEK, screenH - sheetTop);

  const down = Math.max(0, sheetH - PEEK);

  const y = useRef(new Animated.Value(down)).current;
  const at = useRef(down);
  const from = useRef(down);

  useEffect(() => {
    at.current = Math.min(at.current, down);
    y.setValue(at.current);
  }, [down, y]);

  const settle = useCallback((to: number) => {
    at.current = to;
    Animated.spring(y, {
      toValue: to, useNativeDriver: false,
      damping: 22, stiffness: 220, mass: 0.9,
    }).start();
  }, [y]);

  const collapse = useCallback(() => settle(down), [settle, down]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 3,
    onPanResponderGrant: () => { from.current = at.current; },
    onPanResponderMove: (_e, g) => {
      const next = Math.min(down, Math.max(0, from.current + g.dy));
      at.current = next;
      y.setValue(next);
    },
    onPanResponderRelease: (_e, g) => {
      if (g.vy > FLICK) return settle(down);
      if (g.vy < -FLICK) return settle(0);
      settle(at.current > down / 2 ? down : 0);
    },
  }), [down, y, settle]);

  const moveTo = useCallback((lon: number, lat: number, zoom: number, duration: number) => {
    const to = { center: [lon, lat] as [number, number], zoom };

    const go = () => {
      const c = camera.current;
      if (!c) return false;
      try {
        if (typeof c.flyTo === 'function') c.flyTo({ ...to, duration });
        else if (typeof c.easeTo === 'function') c.easeTo({ ...to, duration });
        else c.jumpTo?.(to);
        return true;
      } catch {
        return false;
      }
    };

    if (!go()) requestAnimationFrame(() => { go(); });
  }, []);

  const locate = useCallback((f: Facility) => {
    tap('light');
    setSelected(f.id);
    moveTo(f.lon, f.lat, 16, 900);
    collapse();
  }, [collapse, moveTo]);

  const tapMap = useCallback(async (event: any) => {
    const point = event?.nativeEvent?.point ?? event?.point;
    if (!point || !map.current?.queryRenderedFeatures) return;

    const [x, y] = point;
    const box: [[number, number], [number, number]] = [
      [x - TAP_SLOP, y - TAP_SLOP],
      [x + TAP_SLOP, y + TAP_SLOP],
    ];

    let hits: any[] = [];
    try {
      hits = await map.current.queryRenderedFeatures(box, { layers: ['facility-pins'] }) ?? [];
    } catch {
      return;
    }

    const id = hits[0]?.properties?.id;
    if (!id) return;

    const facility = facilities.find((f) => f.id === id);
    if (!facility) return;

    tap('light');
    setSelected(facility.id);
  }, [facilities]);

  const recentre = useCallback(async () => {
    tap('light');
    setSelected(null);

    const here = (await sharpen()) ?? fix;
    if (here) moveTo(here.lon, here.lat, 15, 700);
  }, [sharpen, fix, moveTo]);

  return (
    <View style={{ flex: 1, backgroundColor: P.sunken }}>
      <View style={StyleSheet.absoluteFill}>
        {!MapLibreGL ? (
          <Centred>
            <Icon name="pin" size={22} color={P.faint} />
            <Txt t="caption" c={P.muted} style={st.centredText}>
              The map needs a rebuild with the map library installed.
            </Txt>
            <Txt t="micro" c={P.faint} style={{ marginTop: 2 }}>
              The list still works without it.
            </Txt>
          </Centred>
        ) : fix ? (
          <MapLibreGL.Map
            ref={map}
            style={{ flex: 1 }}
            mapStyle={STYLE_URL[scheme]}
            logo={false}
            compass={false}
            onPress={(e: any) => { void tapMap(e); }}
          >
            <MapLibreGL.Camera
              ref={camera}
              initialViewState={{ center: [fix.lon, fix.lat], zoom: 15 }}
            />
            <MapLibreGL.GeoJSONSource id="facilities" data={pins}>
              <MapLibreGL.Layer
                id="facility-pins"
                type="circle"
                paint={{
                  'circle-radius': ['get', 'radius'],
                  'circle-color': ['get', 'colour'],
                  'circle-stroke-width': ['get', 'stroke'],
                  'circle-stroke-color': '#FFFFFF',
                }}
              />

              <MapLibreGL.Layer
                id="facility-labels"
                type="symbol"
                minzoom={11}
                layout={{
                  'text-field': ['get', 'label'],
                  'text-font': ['Noto Sans Regular'],
                  'text-size': ['get', 'size'],
                  'text-anchor': 'top',
                  'text-offset': [0, 0.9],
                  'text-max-width': 9,
                  'text-padding': 4,

                  'symbol-sort-key': ['get', 'sort'],
                }}
                paint={{
                  'text-color': scheme === 'dark' ? '#F2F3F5' : '#1A1A1A',
                  'text-halo-color': scheme === 'dark' ? '#0B0B0D' : '#FFFFFF',
                  'text-halo-width': 1.4,
                  'text-halo-blur': 0.4,
                }}
              />
            </MapLibreGL.GeoJSONSource>

            <MapLibreGL.GeoJSONSource id="me" data={me}>
              <MapLibreGL.Layer
                id="me-halo"
                type="circle"
                paint={{ 'circle-radius': 24, 'circle-color': ME_BLUE, 'circle-opacity': 0.14 }}
              />
              <MapLibreGL.Layer
                id="me-disc"
                type="circle"
                paint={{
                  'circle-radius': 12,
                  'circle-color': '#FFFFFF',
                  'circle-stroke-width': 2.5,
                  'circle-stroke-color': ME_BLUE,
                }}
              />
              <MapLibreGL.Layer
                id="me-dot"
                type="circle"
                paint={{ 'circle-radius': 5.5, 'circle-color': ME_BLUE }}
              />
              <MapLibreGL.Layer
                id="me-label"
                type="symbol"
                layout={{
                  'text-field': 'You are here',
                  'text-font': ['Noto Sans Bold'],
                  'text-size': 12,
                  'text-anchor': 'top',
                  'text-offset': [0, 1.7],

                  'text-allow-overlap': true,
                  'text-ignore-placement': true,
                }}
                paint={{
                  'text-color': scheme === 'dark' ? '#7FB0FF' : ME_BLUE,
                  'text-halo-color': scheme === 'dark' ? '#0B0B0D' : '#FFFFFF',
                  'text-halo-width': 2,
                }}
              />
            </MapLibreGL.GeoJSONSource>
          </MapLibreGL.Map>
        ) : (
          <Centred>
            <ActivityIndicator color={P.accent} />
            <Txt t="bodyStrong" style={{ marginTop: S.md }}>Finding where you are</Txt>
            <Txt t="caption" c={P.muted} style={st.centredText}>
              Waiting for a GPS reading rather than showing you an approximate
              one. This takes longer indoors.
            </Txt>
          </Centred>
        )}
      </View>

      {chosen ? (
        <View style={[st.callout, { bottom: PEEK + S.md }]} pointerEvents="box-none">
          <Card style={{ marginBottom: 0 }} onPress={() => locate(chosen)}>
            <View style={st.calloutRow}>
              <View style={[st.dot, { backgroundColor: kindColour(P, chosen.kind) }]}>
                <Icon name={KIND_ICON[chosen.kind]} size={15} color="#FFFFFF" weight="bold" />
              </View>

              <View style={{ flex: 1 }}>
                <Txt t="bodyStrong" numberOfLines={2}>{chosen.name}</Txt>
                <Txt t="caption" c={P.muted} style={{ marginTop: 2 }}>
                  {`${KIND_LABEL[chosen.kind]} · ${distance(chosen.km)}`}
                </Txt>
              </View>

              <Springy
                onPress={() => { tap('light'); setSelected(null); }}
                scaleTo={0.85}
                accessibilityLabel="Dismiss"
              >
                <View style={[st.close, { borderColor: P.line }]}>
                  <Icon name="close" size={15} color={P.muted} />
                </View>
              </Springy>
            </View>

            <View style={{ height: S.md }} />
            <Button
              title="Directions"
              icon="arrowRight"
              onPress={() => { tap('light'); void openDirections(chosen); }}
            />
          </Card>
        </View>
      ) : null}

      <Animated.View
        style={[
          st.sheet,
          {
            height: sheetH,
            top: sheetTop,
            backgroundColor: P.surface,
            borderColor: P.line,
            transform: [{ translateY: y }],
          },
        ]}
      >
        <View {...pan.panHandlers} style={st.grip}>
          <View style={[st.grabber, { backgroundColor: P.line }]} />
        </View>

        <View style={st.head}>
          <View style={st.headRow}>
            <View style={[st.search, { borderColor: P.line, backgroundColor: P.sunken }]}>
              <Icon name="search" size={18} color={P.faint} />
              <TextInput
                style={[st.searchInput, { color: P.ink, ...TYPE.body }]}
                value={query}
                onChangeText={setQuery}
                placeholder="Filter by name or type"
                placeholderTextColor={P.faint}
                autoCorrect={false}
                accessibilityLabel="Filter facilities"

                onFocus={() => settle(0)}
              />
            </View>

            <Springy
              onPress={() => { void recentre(); }}
              disabled={locating}
              scaleTo={0.9}
              accessibilityLabel="Find my location again and centre the map on it"
            >
              <View
                style={[
                  st.locate,
                  { backgroundColor: locating ? P.sunken : P.accent, borderColor: P.line },
                ]}
              >
                {locating
                  ? <ActivityIndicator size="small" color={P.muted} />
                  : <Icon name="pin" size={19} color={P.onAccent} />}
              </View>
            </Springy>
          </View>

          <View style={st.countRow}>
            <Txt t="micro" c={P.faint}>
              {locating ? 'FINDING YOU' : whereFrom(fix)}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: S.sm }}>
              {widening ? <ActivityIndicator size="small" color={P.faint} /> : null}
              <Txt t="micro" c={P.faint}>
                {busy
                  ? 'Searching'
                  : `${shown.length} ${shown.length === 1 ? 'place' : 'places'}${widening ? ' so far' : ''}`}
              </Txt>
            </View>
          </View>
        </View>

        <FlatList
          data={shown}
          keyExtractor={(f) => f.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: TAB_CLEARANCE + S.xxl, paddingHorizontal: S.xl }}
          initialNumToRender={12}
          windowSize={7}
          removeClippedSubviews={false}
          ListEmptyComponent={
            <Empty busy={busy} notice={notice} diagnostics={diagnostics} query={query} onRetry={load} />
          }
          ListHeaderComponent={
            <>
              {problem && !precise ? (
                <View style={[st.banner, { borderColor: P.line, backgroundColor: P.sunken }]}>
                  <Icon name="pin" size={16} color={P.warn} />
                  <Txt t="caption" c={P.muted} style={{ flex: 1 }}>
                    {PROBLEM[problem]}
                  </Txt>
                  <Springy onPress={() => { void sharpen(); }} scaleTo={0.94}>
                    <Txt t="bodyStrong" c={P.accent}>Retry</Txt>
                  </Springy>
                </View>
              ) : null}
              {notice && shown.length > 0 ? (
              <View style={[st.banner, { borderColor: P.line, backgroundColor: P.sunken }]}>
                <Icon name="alert" size={16} color={P.warn} />
                <View style={{ flex: 1 }}>
                  <Txt t="caption" c={P.muted}>
                    {stale ? `${notice} Showing what was found last time.` : notice}
                  </Txt>
                  {diagnostics ? (
                    <Txt t="micro" c={P.faint} style={{ marginTop: S.xs }}>{diagnostics}</Txt>
                  ) : null}
                </View>
                <Springy onPress={() => { tap('light'); void load(); }} scaleTo={0.94}>
                  <Txt t="bodyStrong" c={P.accent}>Retry</Txt>
                </Springy>
                </View>
              ) : null}
            </>
          }
          ListFooterComponent={
            shown.length > 0 ? (
              <View style={[st.meta, { borderColor: P.line }]}>
                <Icon name="alert" size={16} color={P.muted} />
                <Txt t="caption" style={{ flex: 1 }}>
                  Places and opening hours come from OpenStreetMap and can be out
                  of date. Distances are straight-line, not travel distance. Ring
                  ahead before setting out.
                </Txt>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <Row
              f={item}
              selected={item.id === selected}
              onPress={() => locate(item)}
              onDirections={() => { tap('light'); void openDirections(item); }}
            />
          )}
        />
      </Animated.View>
    </View>
  );
}

function Centred({ children }: { children: React.ReactNode }) {
  return <View style={st.centred}>{children}</View>;
}

function Row({ f, selected, onPress, onDirections }: {
  f: Facility;
  selected: boolean;
  onPress: () => void;
  onDirections: () => void;
}) {
  const { c: P } = useTheme();
  const colour = kindColour(P, f.kind);

  return (
    <Springy onPress={onPress} scaleTo={0.98}>
      <View
        style={[
          st.row,
          {
            borderColor: selected ? colour : P.line,
            backgroundColor: selected ? P.sunken : 'transparent',
          },
        ]}
      >
        <View style={[st.dot, { backgroundColor: colour }]}>
          <Icon name={KIND_ICON[f.kind]} size={15} color="#FFFFFF" weight="bold" />
        </View>

        <View style={{ flex: 1 }}>
          <Txt t="bodyStrong" numberOfLines={2} c={f.named ? P.ink : P.muted}>
            {f.name}
          </Txt>
          <Txt t="caption" c={P.muted} style={{ marginTop: 2 }}>
            {`${KIND_LABEL[f.kind]} · ${distance(f.km)}`}
          </Txt>

          {f.urgent || f.open24h ? (
            <View style={st.flags}>
              {f.urgent ? (
                <View style={[st.flag, { backgroundColor: P.dangerSoft }]}>
                  <Txt t="micro" c={P.danger}>URGENT CARE</Txt>
                </View>
              ) : null}
              {f.open24h ? (

                <View style={[st.flag, { backgroundColor: P.sunken }]}>
                  <Txt t="micro" c={P.ok}>OPEN 24 HOURS</Txt>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <Springy onPress={onDirections} scaleTo={0.88} accessibilityLabel={`Directions to ${f.name}`}>
          <View style={[st.go, { borderColor: P.line, backgroundColor: P.surface }]}>
            <Icon name="arrowRight" size={17} color={P.accent} />
          </View>
        </Springy>
      </View>
    </Springy>
  );
}

function Empty({ busy, notice, diagnostics, query, onRetry }: {
  busy: boolean;
  notice: string | null;
  diagnostics: string | null;
  query: string;
  onRetry: () => void;
}) {
  const { c: P } = useTheme();

  if (busy) {
    return (
      <View style={st.empty}>
        <ActivityIndicator color={P.accent} />
        <Txt t="caption" c={P.muted} style={{ marginTop: S.md }}>
          Looking for health facilities nearby.
        </Txt>
      </View>
    );
  }

  if (notice) {
    return (
      <View style={st.empty}>
        <Txt t="caption" c={P.muted} style={{ textAlign: 'center' }}>{notice}</Txt>

        {diagnostics ? (
          <Txt t="micro" c={P.faint} style={{ marginTop: S.md, textAlign: 'center' }}>
            {diagnostics}
          </Txt>
        ) : null}

        <View style={{ height: S.md }} />
        <Springy onPress={() => { tap('light'); onRetry(); }} scaleTo={0.96}>
          <Txt t="bodyStrong" c={P.accent}>Try again</Txt>
        </Springy>
      </View>
    );
  }

  return (
    <View style={st.empty}>
      <Txt t="caption" c={P.muted} style={{ textAlign: 'center' }}>
        {query.trim()
          ? `Nothing matches "${query.trim()}". Clear the filter to see everything nearby.`
          : 'No health facilities are mapped around here.'}
      </Txt>
    </View>
  );
}

const st = StyleSheet.create({
  centred: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: S.xl },
  centredText: { marginTop: S.sm, textAlign: 'center' },

  sheet: {
    position: 'absolute', left: 0, right: 0,
    borderTopLeftRadius: R.xl, borderTopRightRadius: R.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  grip: { paddingTop: S.md, paddingBottom: S.sm, alignItems: 'center' },
  grabber: { width: 44, height: 5, borderRadius: 3 },

  head: { paddingHorizontal: S.xl, paddingBottom: S.md },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: S.md },

  search: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: S.md,
    minHeight: TOUCH, borderRadius: R.pill, borderWidth: 1.5,
    paddingHorizontal: S.lg,
  },
  locate: {
    width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  searchInput: { flex: 1, paddingVertical: S.sm },
  countRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: S.md,
  },

  row: {
    flexDirection: 'row', gap: S.lg, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: R.md,
    padding: S.md, marginBottom: S.sm,
  },
  dot: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  go: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  flags: { flexDirection: 'row', gap: S.xs, marginTop: 6, flexWrap: 'wrap' },
  flag: { paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: R.pill },

  empty: { paddingVertical: S.xxl, alignItems: 'center' },

  callout: { position: 'absolute', left: S.xl, right: S.xl },
  calloutRow: { flexDirection: 'row', gap: S.md, alignItems: 'center' },
  close: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  banner: {
    flexDirection: 'row', gap: S.sm, alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: R.md,
    padding: S.md, marginBottom: S.md,
  },

  meta: {
    flexDirection: 'row', gap: S.sm, alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: R.md,
    padding: S.md, marginTop: S.lg,
  },
});
