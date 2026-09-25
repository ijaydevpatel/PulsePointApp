/**
 * Health facilities near the person: a full-screen map, and the same places in
 * a sheet that pulls up from the bottom.
 *
 * ── Why the map is the screen ────────────────────────────────────────────────
 *
 * It used to be a 260dp box inside a scrolling page, under a header and a
 * search field. That is the shape of a page that happens to contain a map, and
 * it wastes the thing a map is for: at that size you can see your own dot and
 * about four pins, and panning it fights the page scroll underneath. Every
 * other tab here is a page, and this one is not - so the map takes the whole
 * screen and everything else floats over it.
 *
 * ── Why a sheet rather than a sidebar ────────────────────────────────────────
 *
 * The website puts the list in a left-hand panel, which works when there is a
 * spare third of a screen going. On a phone there is not. A sheet is the same
 * idea turned ninety degrees: dragged down it is a caption under the map,
 * dragged up it is the full list, and the person chooses which without either
 * one being taken away.
 *
 * ── Tap a row, and the map answers ───────────────────────────────────────────
 *
 * A list of names and distances still does not say *where*. Tapping a row
 * flies the camera to that place, enlarges its pin, and drops the sheet out of
 * the way, so the question "where is this one" is answered on the map rather
 * than by a second screen.
 *
 * ── The two flags ────────────────────────────────────────────────────────────
 *
 * Open 24 hours and Urgent care are called out because they are the reason
 * this screen gets opened at night. Both come from OSM tags and neither is
 * inferred: an untagged facility shows neither, rather than being described as
 * closed.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, StyleSheet, TextInput, Linking, Platform, ActivityIndicator,
  Animated, PanResponder, FlatList, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt, Springy, tap } from '../components/Primitives';
import { Icon, IconName } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, TYPE, Palette } from '../theme';
import {
  Facility, FacilityKind, FacilityService, KIND_LABEL, matches,
} from '../../domain/facilities';
import { Fix } from '../../data/locationFix';

/*
 * MapLibre, loaded only if it is actually installed.
 *
 * ── Why this is not a plain import ───────────────────────────────────────────
 *
 * MapLibre is a native module: it cannot be added by a Metro reload, only by
 * an install and a rebuild. A static `import` of it makes the whole app
 * unbuildable until that has happened - the JS bundle step cannot resolve the
 * module and fails, so every other tab goes down with the map. That is exactly
 * what happened here, and one broken screen must not be able to take the app
 * with it.
 *
 * The specifier is held in a variable on purpose. Metro resolves literal
 * requires at build time and fails the bundle on a missing one; a computed
 * specifier is left to run time, where a missing module is a catchable error
 * rather than a broken build.
 *
 * No API key, and none needed - the style below is a public tile source.
 */
const MAPLIBRE_MODULE = '@maplibre/maplibre-react-native';

/*
 * The guard checks for the components, not just the module.
 *
 * Checking `MapLibreGL != null` was not enough. v11 renamed most of the API -
 * MapView became Map, ShapeSource became GeoJSONSource, and the per-type layer
 * components collapsed into one Layer with a `type` prop. The module loaded
 * perfectly and every component came back undefined, which React reports as
 * "Element type is invalid ... got: undefined" from somewhere deep in the tree
 * rather than as a missing module.
 *
 * So the condition is whether the pieces actually being rendered exist.
 * __tests__/mapApi.test.ts keeps this honest against the installed package.
 */
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

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

/**
 * The one colour on this map that never means a facility.
 *
 * Deliberately outside the category palette: the accent is crimson and the
 * two blue-ish categories are lighter periwinkles, so nothing the person can
 * tap is this blue.
 */
const ME_BLUE = '#1B6EF3';

/* ──────────────────────────── sheet geometry ────────────────────────────── */

/**
 * How much of the sheet stays on screen when it is down.
 *
 * Enough for the grabber, the filter field and the count - the three things
 * worth seeing while looking at the map - and not a row more, because every
 * pixel here is a pixel of map.
 *
 * TAB_CLEARANCE is added rather than assumed: the tab bar floats over the
 * bottom of the screen, so a sheet that peeks by less than that peeks entirely
 * underneath it.
 */
const PEEK = 132 + TAB_CLEARANCE;

/** How far below the top of the screen the sheet stops when fully up. */
const SHEET_TOP_GAP = 76;

/** Past this much of a flick, direction wins over position. */
const FLICK = 0.5;

/* ────────────────────────────── presentation ────────────────────────────── */

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

const distance = (km: number) =>
  (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

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

/* ──────────────────────────────── screen ────────────────────────────────── */

export function CareScreen({ service, fix }: {
  service?: FacilityService;
  /** Where to search from. Null while the location is still being resolved. */
  fix?: Fix | null;
}) {
  const { c: P } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const [facilities, setFacilities] = useState<readonly Facility[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const camera = useRef<any>(null);

  const load = useCallback(async () => {
    if (!service || !fix) return;
    setBusy(true);
    const r = await service.near({ lat: fix.lat, lon: fix.lon });

    /*
     * A failed refresh does not throw away a good list.
     *
     * Overpass is a free public service that rate-limits and goes down, so a
     * failure here is ordinary rather than exceptional - and replacing five
     * hundred real places with "0 places" loses information the person
     * already had, over a problem that is usually gone in a minute. The
     * notice appears above the list instead, and the list stays.
     *
     * `ok` is what distinguishes this from a genuine empty area, which is a
     * real answer and should replace whatever was there.
     */
    setFacilities((prev) => (r.ok || prev.length === 0 ? r.facilities : prev));
    setNotice(r.notice);
    setBusy(false);
  }, [service, fix]);

  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(
    () => facilities.filter((f) => matches(f, query)),
    [facilities, query],
  );

  /*
   * `selected` is baked into the feature rather than drawn as a second layer,
   * so the highlighted pin cannot end up painted underneath an ordinary one.
   */
  const pins = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: shown.map((f) => ({
      type: 'Feature' as const,
      id: f.id,
      geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] },
      properties: {
        name: f.name,
        named: f.named,
        colour: kindColour(P, f.kind),
        selected: f.id === selected,
      },
    })),
  }), [shown, P, selected]);

  /**
   * Where the person is, drawn by us.
   *
   * MapLibre's own UserLocation component was here and rendered nothing: it
   * runs its own location provider, which is a second permission prompt and a
   * second thing to fail. The screen already has a fix - it is what the search
   * was centred on - so the dot is drawn from that. One source of truth, and
   * it cannot disagree with the list.
   */
  const me = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: fix
      ? [{
        type: 'Feature' as const,
        id: 'me',
        geometry: { type: 'Point' as const, coordinates: [fix.lon, fix.lat] },
        properties: {},
      }]
      : [],
  }), [fix]);

  /* ─────────────────────────── the sheet ────────────────────────────── */

  const sheetTop = insets.top + SHEET_TOP_GAP;
  const sheetH = Math.max(PEEK, screenH - sheetTop);
  /** Travel between fully up (0) and peeking (this). */
  const down = Math.max(0, sheetH - PEEK);

  /*
   * JS driver, deliberately.
   *
   * A native-driven value is moved out of the React tree, and when Android
   * detaches and re-attaches a view the value is lost and never re-applied -
   * which is what made content vanish on scroll across this app. Here the
   * value also has to be read and written by the pan handlers, which a native
   * value cannot be.
   */
  const y = useRef(new Animated.Value(down)).current;
  const at = useRef(down);
  const from = useRef(down);

  useEffect(() => {
    // Keep the resting position correct if the window changes size (rotation,
    // split screen) rather than leaving the sheet parked off its own travel.
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
      // A deliberate flick beats where the finger happened to stop; a slow
      // drag falls to whichever end it is nearer.
      if (g.vy > FLICK) return settle(down);
      if (g.vy < -FLICK) return settle(0);
      settle(at.current > down / 2 ? down : 0);
    },
  }), [down, y, settle]);

  /**
   * Move the camera, whichever way this version of MapLibre offers.
   *
   * flyTo is the one worth having - it arcs out and back in, which shows the
   * person the relationship between where they were and where they now are.
   * The fallbacks exist because a camera that does not move is a button that
   * does nothing, and an instant jump is a far better failure than that.
   */
  const moveTo = useCallback((lon: number, lat: number, zoom: number, duration: number) => {
    const to = { center: [lon, lat] as [number, number], zoom };

    /*
     * Camera moves throw, and that is why the button did nothing.
     *
     * Every one of these methods goes through setStop, which calls
     * findNodeHandle on the native camera and throws "NativeCameraComponent
     * ref is null, wait for the map being initialized" when the map has not
     * finished coming up. Uncaught, that is a press that silently fails -
     * and the map is at its slowest to initialise exactly when someone is
     * most likely to jab at the locate button.
     *
     * So the throw is caught and the move is tried once more on the next
     * frame, by which time the map is up.
     */
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

  /** Tapping a row is a question about where it is, so the map answers it. */
  const locate = useCallback((f: Facility) => {
    tap('light');
    setSelected(f.id);
    moveTo(f.lon, f.lat, 16, 900);
    collapse();
  }, [collapse, moveTo]);

  const recentre = useCallback(() => {
    if (!fix) return;
    tap('light');
    setSelected(null);
    moveTo(fix.lon, fix.lat, 14, 700);
  }, [fix, moveTo]);

  /* ─────────────────────────────── render ───────────────────────────────── */

  return (
    <View style={{ flex: 1, backgroundColor: P.sunken }}>
      {/* The map is the screen; everything else floats over it. */}
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
          <MapLibreGL.Map style={{ flex: 1 }} mapStyle={STYLE_URL} logo={false} compass={false}>
            <MapLibreGL.Camera
              ref={camera}
              initialViewState={{ center: [fix.lon, fix.lat], zoom: 13 }}
            />
            <MapLibreGL.GeoJSONSource id="facilities" data={pins}>
              <MapLibreGL.Layer
                id="facility-pins"
                type="circle"
                paint={{
                  // Data-driven so the selected pin grows in place rather than
                  // being drawn again by a second layer.
                  'circle-radius': ['case', ['get', 'selected'], 11, 6],
                  'circle-color': ['get', 'colour'],
                  'circle-stroke-width': ['case', ['get', 'selected'], 3, 2],
                  'circle-stroke-color': '#FFFFFF',
                }}
              />

              {/*
                Names on the map, as the website has them.

                `Noto Sans Regular` is not a guess - it is one of the three
                fontstacks this style's glyph endpoint serves, and MapLibre
                renders no text at all when asked for a font the style cannot
                supply. That silent nothing is the usual reason labels do not
                appear.

                Unnamed places are given an empty label rather than their
                category, because five hundred pins each captioned "Pharmacy"
                is noise. Labels are left to collide and drop out naturally,
                so a dense street thins itself instead of turning solid.
              */}
              <MapLibreGL.Layer
                id="facility-labels"
                type="symbol"
                minzoom={13}
                layout={{
                  'text-field': ['case', ['get', 'named'], ['get', 'name'], ''],
                  'text-font': ['Noto Sans Regular'],
                  'text-size': ['case', ['get', 'selected'], 13, 11],
                  'text-anchor': 'top',
                  'text-offset': [0, 0.9],
                  'text-max-width': 9,
                  'text-padding': 4,
                  // The selected one wins any collision it takes part in.
                  'symbol-sort-key': ['case', ['get', 'selected'], 0, 1],
                }}
                paint={{
                  'text-color': '#1A1A1A',
                  'text-halo-color': '#FFFFFF',
                  'text-halo-width': 1.4,
                  'text-halo-blur': 0.4,
                }}
              />
            </MapLibreGL.GeoJSONSource>

            {/*
              ── Telling "me" apart from 522 facilities ────────────────────

              A blue dot was not enough. Every facility is a flat coloured
              disc too, and two of the categories - dental and therapy - are
              already blue-ish, so the person's own position read as one more
              pin in the pile. Colour alone cannot carry this.

              So it differs in all three ways a mark can: shape, size and
              words. It is concentric rather than flat - a ring around a core,
              which no facility pin is - it is larger than even a selected
              pin, and it is captioned.

              The caption is the part that actually settles it, and it is set
              to overlap and ignore placement so that it is never the label
              MapLibre drops when a street gets crowded. Every other label on
              this map may be dropped; this one may not.
            */}
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
                  // Never dropped, at any zoom, however crowded the street.
                  'text-allow-overlap': true,
                  'text-ignore-placement': true,
                }}
                paint={{
                  'text-color': ME_BLUE,
                  'text-halo-color': '#FFFFFF',
                  'text-halo-width': 2,
                }}
              />
            </MapLibreGL.GeoJSONSource>
          </MapLibreGL.Map>
        ) : (
          <Centred>
            <ActivityIndicator color={P.accent} />
            <Txt t="caption" c={P.muted} style={st.centredText}>
              Finding where you are
            </Txt>
          </Centred>
        )}
      </View>

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
        {/*
          The drag handle is the only thing that captures the pan. Putting the
          responder on the whole sheet would mean every attempt to scroll the
          list dragged the sheet instead.
        */}
        <View {...pan.panHandlers} style={st.grip}>
          <View style={[st.grabber, { backgroundColor: P.line }]} />
        </View>

        <View style={st.head}>
          {/*
            The locate button lives here rather than floating over the map.
            Over the map it sat in the one corner the person is most likely to
            be looking at, and it moved whenever the sheet did; beside the
            filter it is always in the same place and always reachable with the
            thumb that is already on the sheet.
          */}
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
              />
            </View>

            <Springy
              onPress={recentre}
              disabled={!fix}
              scaleTo={0.9}
              accessibilityLabel="Centre the map on my location"
            >
              <View
                style={[
                  st.locate,
                  { backgroundColor: fix ? P.accent : P.sunken, borderColor: P.line },
                ]}
              >
                <Icon name="pin" size={19} color={fix ? P.onAccent : P.faint} />
              </View>
            </Springy>
          </View>

          <View style={st.countRow}>
            <Txt t="micro" c={P.faint}>
              {fix?.place ? `NEAR ${fix.place.toUpperCase()}` : 'NEAREST FIRST'}
            </Txt>
            <Txt t="micro" c={P.faint}>
              {busy ? 'Searching' : `${shown.length} ${shown.length === 1 ? 'place' : 'places'}`}
            </Txt>
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
            <Empty busy={busy} notice={notice} query={query} onRetry={load} />
          }
          ListHeaderComponent={
            // Only when there is a list to sit above; otherwise Empty says it.
            notice && shown.length > 0 ? (
              <View style={[st.banner, { borderColor: P.line, backgroundColor: P.sunken }]}>
                <Icon name="alert" size={16} color={P.warn} />
                <Txt t="caption" c={P.muted} style={{ flex: 1 }}>
                  {`${notice} Showing what was found last time.`}
                </Txt>
                <Springy onPress={() => { tap('light'); void load(); }} scaleTo={0.94}>
                  <Txt t="bodyStrong" c={P.accent}>Retry</Txt>
                </Springy>
              </View>
            ) : null
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
              onDirections={() => { tap('light'); openDirections(item); }}
            />
          )}
        />
      </Animated.View>
    </View>
  );
}

/* ─────────────────────────────── pieces ─────────────────────────────────── */

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
                // No okSoft token exists, and inventing one would put a colour
                // outside the audited palette on screen.
                <View style={[st.flag, { backgroundColor: P.sunken }]}>
                  <Txt t="micro" c={P.ok}>OPEN 24 HOURS</Txt>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Separate from the row: tapping the row asks where, this asks how. */}
        <Springy onPress={onDirections} scaleTo={0.88} accessibilityLabel={`Directions to ${f.name}`}>
          <View style={[st.go, { borderColor: P.line, backgroundColor: P.surface }]}>
            <Icon name="arrowRight" size={17} color={P.accent} />
          </View>
        </Springy>
      </View>
    </Springy>
  );
}

function Empty({ busy, notice, query, onRetry }: {
  busy: boolean;
  notice: string | null;
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

/* ─────────────────────────────── styles ─────────────────────────────────── */

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
  // flex so the field gives up exactly the width the button needs, rather
  // than a fixed inset that would be wrong on a different screen.
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
