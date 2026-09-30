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
import { Txt, Springy, Card, Button, tap } from '../components/Primitives';
import { Icon, IconName } from '../components/Icon';
import { useTheme, S, R, TOUCH, TAB_CLEARANCE, TYPE, Palette } from '../theme';
import {
  Facility, FacilityKind, FacilityService, KIND_LABEL, matches,
} from '../../domain/facilities';
import { Fix, FixOutcome, preciseFix, recentPreciseFix } from '../../data/locationFix';

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

/**
 * One style per scheme.
 *
 * The map used Positron in both, so dark mode put a white map under a dark
 * sheet and a black tab bar - the brightest thing on the screen, at night, on
 * the screen people open at night. `dark` is the same tile source and the
 * same Noto fontstack, so the pin labels keep working; only the paint
 * changes.
 */
const STYLE_URL = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;

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

/** Half the width of the tap target around a pin, in points. */
const TAP_SLOP = 14;

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

/**
 * Where the position came from, and how good it is.
 *
 * The three tiers are not equivalent and the screen should not pretend they
 * are. A GPS fix is a point; an IP lookup is the internet provider's idea of
 * the city; the time zone is a city outright. Someone deciding whether to walk
 * somewhere deserves to know which of those they are reading.
 */
/** What to say, and what to do about it, when there is no device position. */
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

/**
 * Hands the place to the phone's own maps app, as a route.
 *
 * ── Routing, not a dropped pin ───────────────────────────────────────────────
 *
 * This used to open `geo:lat,lon?q=...`, which shows the place on a map and
 * leaves the person to press Directions themselves. On a screen whose entire
 * job is getting someone to care, the useful handover is the route: the maps
 * app already knows where they are, which roads are shut and how long it will
 * take, and none of that is worth reimplementing here.
 *
 * The universal Google Maps URL is first because it works on both platforms
 * and opens the installed app rather than the browser when there is one. iOS
 * gets Apple Maps first, since that is the one that is certainly installed.
 *
 * Each step is tried in turn, so a phone with no maps app at all still lands
 * on something that shows the place rather than doing nothing.
 */
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
      // Try the next one. A phone without Google Maps is not an error.
    }
  }
}

/* ──────────────────────────────── screen ────────────────────────────────── */

export function CareScreen({ service, fix: given }: {
  service?: FacilityService;
  /** Where to search from. Null while the location is still being resolved. */
  fix?: Fix | null;
}) {
  const { c: P, scheme } = useTheme();

  /*
   * This screen resolves its own position, precisely.
   *
   * The fix handed down is the app-wide one, which is deliberately quick and
   * rough - it will settle for the time zone, and at worst for the internet
   * provider's idea of the city centre. That is the right answer for the air
   * quality card, and the wrong one for a map: it is how the screen came to
   * say Albert Street for someone standing on Mayoral Drive.
   *
   * So the given fix is only a starting point, replaced as soon as the device
   * reports something better. It is held here rather than lifted into App so
   * that no other tab's behaviour changes.
   */
  const [precise, setPrecise] = useState<Fix | null>(() => recentPreciseFix());
  const [tried, setTried] = useState(() => recentPreciseFix() !== null);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<Exclude<FixOutcome['kind'], 'ok'> | null>(null);

  /*
   * Nothing is shown until something has actually been measured.
   *
   * The screen used to open on the app-wide fix - which can be the time zone,
   * i.e. the middle of the nearest city - and then jump when the real reading
   * landed a few seconds later. That jump is the thing to remove, and the way
   * to remove it is not to make the guess faster but to stop showing a guess
   * at all: a map that says "finding you" is honest, and a map centred on a
   * place the person is not is not.
   *
   * The rough fix is still the fallback, but only once the device has been
   * asked and failed to answer - never before.
   */
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
    // A reading from the last minute is still true, so a return to this tab
    // does not re-acquire GPS and does not flash "finding you" at someone who
    // has not moved.
    if (recentPreciseFix()) return;
    void sharpen();
  }, [sharpen]);
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();

  const [facilities, setFacilities] = useState<readonly Facility[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  /*
   * How many places are on screen, readable from inside load().
   *
   * load() is a useCallback that deliberately does not depend on
   * `facilities` - rebuilding it whenever the list changed would re-run the
   * effect that calls it, and re-search on every result. So the count is
   * mirrored here, where reading it cannot go stale.
   */
  const shownCount = useRef(0);
  const [busy, setBusy] = useState(true);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const camera = useRef<any>(null);
  const map = useRef<any>(null);

  const load = useCallback(async () => {
    if (!service || !fix) return;
    setBusy(true);

    /*
     * Step the radius down, rather than falling off a cliff.
     *
     * The query asks Overpass for every healthcare-tagged thing in the box,
     * and the cost is the area: cheap over a quiet suburb, expensive over a
     * dense city, where the server hits its own limit and returns nothing.
     *
     * This used to go straight from the full 6.5km to 2km on the first
     * failure, which turned five hundred places into fourteen and looked like
     * the app had broken. 4.4km in between recovers most of them, and is
     * still half the work of the full box.
     *
     * Each step only runs because the one before it failed, so a search that
     * works anywhere still costs exactly one request.
     */
    const RADII: (number | undefined)[] = [undefined, 0.04, 0.02];

    let r = await service.near({ lat: fix.lat, lon: fix.lon });
    let narrowedTo: number | null = null;

    for (const radiusDeg of RADII.slice(1)) {
      if (r.ok) break;
      const retry = await service.near({ lat: fix.lat, lon: fix.lon, radiusDeg });
      if (retry.ok) {
        r = retry;
        narrowedTo = radiusDeg ?? null;
      }
    }

    if (narrowedTo !== null && r.facilities.length > 0) {
      // Roughly, and rounded down: 1 degree of latitude is about 111 km.
      const km = Math.floor(narrowedTo * 111);
      r = { ...r, notice: `Showing places within about ${km} km - the wider search timed out.` };
    }

    /*
     * Whether what is on screen is older than this attempt.
     *
     * Only a genuinely failed search leaves the previous list in place, and
     * only then is "showing what was found last time" true. The banner said
     * it unconditionally, so a successful narrow retry - fresh results, just
     * from a smaller box - claimed to be stale data as well.
     */
    setStale(!r.ok && shownCount.current > 0);

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
    setFacilities((prev) => {
      const next = r.ok || prev.length === 0 ? r.facilities : prev;
      shownCount.current = next.length;
      return next;
    });
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
  /** The place the callout is describing, if any. */
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
        // In properties as well as on the feature: a feature's own `id` does
        // not reliably survive the round trip through the native layer, and
        // the tap handler has to know which place was hit.
        id: f.id,
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
  /*
   * The "you are here" dot is drawn from `precise` alone, never from `fix`.
   *
   * `fix` can be the app-wide fallback - an IP lookup, or the time zone - and
   * a dot drawn from one of those is indistinguishable on screen from a real
   * GPS reading that happens to be wrong. The website has no such fallback at
   * all: if the browser will not say where it is, the site shows no position.
   * That is the behaviour being copied. The fallback still centres the map
   * and drives the search, because a list of nearby places is useful even
   * when the exact position is not known - but it does not get to claim it is
   * the person.
   */
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

  /**
   * Tapping a pin on the map hands the place to the maps app, as a route.
   *
   * ── Why the hit test is a query, not a callback ──────────────────────────
   *
   * v11 has no onPress on a source or a layer. The map reports where it was
   * touched, and whether anything of ours is under that point is a question
   * only the map can answer - queryRenderedFeatures asks it, restricted to
   * the facility layer so a tap on a road or a label is not mistaken for a
   * tap on a place.
   *
   * ── Why a pin carries the facility id in properties ──────────────────────
   *
   * A GeoJSON feature's `id` does not reliably survive the trip through the
   * native layer and back, and a pin that cannot say which place it is would
   * route someone to the wrong one. The id is in `properties` as well, which
   * does survive, and that is the one this reads.
   */
  const tapMap = useCallback(async (event: any) => {
    const point = event?.nativeEvent?.point ?? event?.point;
    if (!point || !map.current?.queryRenderedFeatures) return;

    /*
     * A box, not the exact pixel. The pins are six points across; asking
     * whether one is under a single coordinate would mean nothing is ever
     * hit. This is roughly a fingertip, and the nearest match wins.
     */
    /*
     * Nested corners, not four loose numbers.
     *
     * PixelPointBounds is [[left, top], [right, bottom]]. A flat
     * [x1, y1, x2, y2] is still an array whose first two entries are numbers,
     * which is exactly how the library recognises a *point* - so it quietly
     * took the tolerance box as a single pixel up and to the left of the
     * finger, and a six-point pin was never under it.
     *
     * Nothing caught this: the map ref is `any`, because the module is
     * required dynamically, so the compiler had no shape to check against.
     */
    const [x, y] = point;
    const box: [[number, number], [number, number]] = [
      [x - TAP_SLOP, y - TAP_SLOP],
      [x + TAP_SLOP, y + TAP_SLOP],
    ];

    let hits: any[] = [];
    try {
      hits = await map.current.queryRenderedFeatures(box, { layers: ['facility-pins'] }) ?? [];
    } catch {
      // A query against a map that is still coming up is not worth a notice.
      return;
    }

    const id = hits[0]?.properties?.id;
    if (!id) return;

    const facility = facilities.find((f) => f.id === id);
    if (!facility) return;

    /*
     * Selecting is the whole job. Opening the maps app straight from the tap
     * was a one-way door: the pins are six points across and packed together
     * in a city centre, so a mis-tap threw the person into another app to
     * find out they had hit the wrong place. The callout says which place it
     * is and offers the route as a second, deliberate tap.
     */
    tap('light');
    setSelected(facility.id);
  }, [facilities]);

  /*
   * The locate button re-reads the device rather than reusing the old fix.
   *
   * Someone who presses it is asking "where am I *now*", usually because they
   * have moved or because the dot looks wrong. Flying back to a position taken
   * minutes ago answers a question they did not ask.
   */
  const recentre = useCallback(async () => {
    tap('light');
    setSelected(null);

    const here = (await sharpen()) ?? fix;
    if (here) moveTo(here.lon, here.lat, 15, 700);
  }, [sharpen, fix, moveTo]);

  /*
   * There is deliberately no "fly to the fix when it arrives" effect.
   *
   * There used to be, and it was the visible half of the jump: the map opened
   * on a guess and then animated to the truth. Now the map is not mounted
   * until there is a real position, so it opens centred correctly and has
   * nowhere to fly to. The only camera moves left are ones the person asked
   * for - tapping a row, or the locate button.
   */

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
                  // Inverted with the scheme: black text on the dark style
                  // would be invisible, and the halo is what makes either
                  // readable over a busy street.
                  'text-color': scheme === 'dark' ? '#F2F3F5' : '#1A1A1A',
                  'text-halo-color': scheme === 'dark' ? '#0B0B0D' : '#FFFFFF',
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

      {/*
        The callout: which place was tapped, and the way to it.

        It sits above the sheet at its resting height rather than over the
        pin, because a bubble anchored to a pin has to dodge the screen edges
        and the sheet, and at this zoom the pin is usually near the middle
        anyway. Tapping the card itself centres the map on the place; the
        button is the one that leaves the app.
      */}
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
                /*
                 * The sheet goes up when this is tapped, rather than the
                 * screen padding down.
                 *
                 * At its peek height this field sits just above where the
                 * keyboard opens, so the usual answer - reserve the keyboard's
                 * height at the bottom - would push the sheet, the map and the
                 * tab bar around to rescue one input. Raising the sheet puts
                 * the field near the top of the screen, which is both simpler
                 * and what the person wanted anyway: they are about to filter
                 * a list they cannot currently see.
                 */
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
            {/*
              Says how sure it is, rather than implying a precision it does
              not have. A screen that sends people to hospitals should not
              quietly round "somewhere in this suburb" to a point on a street.
            */}
            <Txt t="micro" c={P.faint}>
              {locating ? 'FINDING YOU' : whereFrom(fix)}
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
            <>
              {/*
                Says why there is no blue dot. Without this the screen looks
                identical to one that simply has not finished loading, and the
                three causes have three different fixes - Settings, a toggle,
                or standing near a window.
              */}
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
                <Txt t="caption" c={P.muted} style={{ flex: 1 }}>
                  {stale ? `${notice} Showing what was found last time.` : notice}
                </Txt>
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
