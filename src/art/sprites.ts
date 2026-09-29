// All of Duck Defense's art, drawn as original SVG. Each sprite is built from a
// function so the ducks can share one silhouette with their real breed colors.
// BootScene loads these as textures at 2x their display size.

import type { DuckKind } from '../data/ducks';

const INK = '#2b2233';

export interface SpriteArt {
  key: string;
  svg: string;
  /** Size the texture is drawn at, in world pixels (loaded at 2x for sharpness). */
  width: number;
  height: number;
}

function svg(w: number, h: number, defs: string, body: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>${defs}</defs>${body}</svg>`
  );
}

function vGrad(id: string, top: string, bottom: string): string {
  return (
    `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`
  );
}

function rGrad(id: string, inner: string, outer: string, innerOpacity = 1, outerOpacity = 1): string {
  return (
    `<radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">` +
    `<stop offset="0" stop-color="${inner}" stop-opacity="${innerOpacity}"/>` +
    `<stop offset="1" stop-color="${outer}" stop-opacity="${outerOpacity}"/></radialGradient>`
  );
}

const stroke = (width = 5) => `stroke="${INK}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`;

// --- Ducks ---------------------------------------------------------------

interface DuckLook {
  bodyTop: string;
  bodyBottom: string;
  wing: string;
  wingLine: string;
  headTop: string;
  headBottom: string;
  bib?: string;
  bill: string;
  feet: string;
  back?: string; // magpie saddle and tail
  cap?: string; // magpie cap
  tail?: string;
  untuckedWing?: boolean; // Potato's signature
  eyes: 'normal' | 'sleepy' | 'wise';
  speckles?: string; // mallard hen streaks (Craig)
  speculum?: string; // mallard wing patch (Craig)
  eyeStripe?: string; // mallard hen eye stripe (Craig)
}

const DUCK_LOOKS: Record<DuckKind | 'craig', DuckLook> = {
  // Blue Swedish: slate blue with a white bib.
  sunny: {
    bodyTop: '#86a3c7',
    bodyBottom: '#5a7399',
    wing: '#5f7aa0',
    wingLine: '#46597a',
    headTop: '#6583aa',
    headBottom: '#4a6286',
    bib: '#ffffff',
    bill: '#56656f',
    feet: '#c9773a',
    eyes: 'normal',
  },
  // Black Swedish: black with a green sheen, white bib, and his untucked wing.
  potato: {
    bodyTop: '#454a53',
    bodyBottom: '#23262c',
    wing: '#30343b',
    wingLine: '#171a1e',
    headTop: '#2f6b57',
    headBottom: '#1d2126',
    bib: '#ffffff',
    bill: '#25292e',
    feet: '#3a3d42',
    untuckedWing: true,
    eyes: 'normal',
  },
  // Magpie: white with a black cap, back, and tail. Chester is the elder.
  chester: {
    bodyTop: '#ffffff',
    bodyBottom: '#dcdcd6',
    wing: '#2c3036',
    wingLine: '#16181c',
    headTop: '#ffffff',
    headBottom: '#e3e3dd',
    bill: '#e6ad3c',
    feet: '#e8883a',
    back: '#23262c',
    cap: '#23262c',
    tail: '#23262c',
    eyes: 'wise',
  },
  // Magpie too. Curtis is unbothered by everything.
  curtis: {
    bodyTop: '#ffffff',
    bodyBottom: '#d8d8d2',
    wing: '#2c3036',
    wingLine: '#16181c',
    headTop: '#ffffff',
    headBottom: '#e0e0da',
    bill: '#e0a23a',
    feet: '#e8883a',
    back: '#23262c',
    cap: '#23262c',
    tail: '#23262c',
    eyes: 'sleepy',
  },
  // Craig: a female mallard. Mottled brown, blue wing patch, orange bill.
  craig: {
    bodyTop: '#c49a6c',
    bodyBottom: '#8d6441',
    wing: '#7d5a3c',
    wingLine: '#5a3f28',
    headTop: '#c9a074',
    headBottom: '#a07950',
    bill: '#e8923a',
    feet: '#e8883a',
    eyes: 'normal',
    speckles: '#5e4028',
    speculum: '#2f56c9',
    eyeStripe: '#4a3320',
  },
};

/** A duck facing right, 200 x 200. */
function duckSvg(look: DuckLook): string {
  const defs = vGrad('body', look.bodyTop, look.bodyBottom) + vGrad('head', look.headTop, look.headBottom);
  const parts: string[] = [];

  // Feet.
  parts.push(`<path d="M86 164 L76 190 Q88 185 100 190 L96 164 Z" fill="${look.feet}" ${stroke(4)}/>`);
  parts.push(`<path d="M118 164 L110 190 Q122 185 134 190 L128 164 Z" fill="${look.feet}" ${stroke(4)}/>`);
  // Tail.
  parts.push(`<path d="M56 114 C36 104 26 86 30 68 C44 82 60 90 78 94 Z" fill="${look.tail ?? look.bodyTop}" ${stroke()}/>`);
  // Neck (behind the body and head).
  parts.push(`<path d="M124 100 C122 80 126 64 136 56 L164 62 C162 78 158 92 152 104 Z" fill="${look.headBottom}" ${stroke()}/>`);
  // Body.
  parts.push(`<path d="M40 124 C40 90 76 76 116 82 C150 88 170 108 164 136 C158 164 128 174 98 172 C62 170 40 154 40 124 Z" fill="url(#body)" ${stroke()}/>`);
  if (look.back) {
    parts.push(`<path d="M44 114 C50 94 78 84 110 86 C104 100 80 112 45 126 Z" fill="${look.back}"/>`);
  }
  if (look.speckles) {
    for (const [x, y] of [[62, 132], [78, 148], [98, 156], [120, 152], [140, 140], [56, 112], [70, 100], [150, 120]] as const) {
      parts.push(`<path d="M${x - 6} ${y + 3} L${x} ${y - 3} L${x + 6} ${y + 3}" fill="none" stroke="${look.speckles}" stroke-width="3" stroke-linecap="round"/>`);
    }
  }
  if (look.bib) {
    parts.push(`<path d="M140 98 C158 104 166 122 160 142 C148 132 138 118 134 102 Z" fill="${look.bib}"/>`);
  }
  // Wing.
  parts.push(`<path d="M64 116 C76 96 112 94 132 106 C140 116 130 140 104 144 C84 146 66 136 64 116 Z" fill="${look.wing}" ${stroke(4)}/>`);
  if (look.speculum) {
    parts.push(`<path d="M92 128 L124 120 L127 130 L95 138 Z" fill="${look.speculum}" stroke="#ffffff" stroke-width="3" stroke-linejoin="round"/>`);
  } else {
    parts.push(`<path d="M80 128 Q100 134 120 124 M88 137 Q104 140 122 132" fill="none" stroke="${look.wingLine}" stroke-width="3" stroke-linecap="round"/>`);
  }
  if (look.untuckedWing) {
    // Potato's wing sticks up off his back.
    parts.push(`<path d="M84 102 C68 76 80 48 104 52 C104 68 100 86 98 104 Z" fill="${look.wing}" ${stroke(4)}/>`);
    parts.push(`<path d="M92 92 Q95 76 101 62 M86 84 Q86 72 92 62" fill="none" stroke="#5b606a" stroke-width="3" stroke-linecap="round"/>`);
  }
  // Head.
  parts.push(`<circle cx="146" cy="54" r="28" fill="url(#head)" ${stroke()}/>`);
  if (look.cap) {
    parts.push(`<path d="M121 46 C124 24 166 20 173 44 C158 36 138 36 121 46 Z" fill="${look.cap}"/>`);
    parts.push(`<circle cx="146" cy="54" r="28" fill="none" ${stroke()}/>`);
  }
  if (look.eyeStripe) {
    parts.push(`<path d="M132 50 L170 44" stroke="${look.eyeStripe}" stroke-width="4" stroke-linecap="round"/>`);
  }
  // Cheek blush.
  parts.push(`<ellipse cx="158" cy="64" rx="7" ry="4" fill="#ff8fa3" opacity="0.35"/>`);
  // Bill.
  parts.push(`<path d="M166 52 C182 49 197 53 197 61 C197 69 184 72 168 68 Z" fill="${look.bill}" ${stroke(5)}/>`);
  parts.push(`<ellipse cx="181" cy="56" rx="3" ry="1.6" fill="${INK}" opacity="0.5"/>`);
  // Eyes.
  parts.push(`<circle cx="153" cy="47" r="6.5" fill="#161219"/><circle cx="155.5" cy="44.5" r="2.2" fill="#ffffff"/>`);
  if (look.eyes === 'sleepy') {
    parts.push(`<path d="M145.5 47.5 A7.5 7.5 0 0 1 160.5 47.5 Z" fill="${look.headTop}"/>`);
    parts.push(`<path d="M145 47.5 L161 47.5" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`);
  } else if (look.eyes === 'wise') {
    parts.push(`<path d="M143 37 Q152 31 163 37" fill="none" stroke="#9aa0a6" stroke-width="4" stroke-linecap="round"/>`);
  }
  return svg(200, 200, defs, parts.join(''));
}

// --- Predators -----------------------------------------------------------

/** A raccoon walking right, 220 x 160. */
function raccoonSvg(): string {
  const defs = vGrad('fur', '#a3a6ad', '#6c6f77');
  return svg(
    220,
    160,
    defs,
    [
      // Ringed tail.
      `<path d="M52 88 C24 90 6 70 14 48 C24 60 38 68 60 72 Z" fill="#8a8d94" ${stroke()}/>`,
      `<path d="M22 58 L30 72 M34 66 L40 78 M16 72 L28 82" stroke="#2e2f35" stroke-width="7" stroke-linecap="round"/>`,
      // Legs.
      `<rect x="62" y="110" width="17" height="32" rx="8" fill="#3b3d42" ${stroke(4)}/>`,
      `<rect x="88" y="112" width="17" height="30" rx="8" fill="#3b3d42" ${stroke(4)}/>`,
      `<rect x="128" y="112" width="17" height="30" rx="8" fill="#3b3d42" ${stroke(4)}/>`,
      `<rect x="150" y="110" width="17" height="32" rx="8" fill="#3b3d42" ${stroke(4)}/>`,
      // Body and belly.
      `<path d="M48 94 C48 68 84 58 120 60 C152 62 172 78 172 100 C172 122 146 132 112 132 C78 132 48 122 48 94 Z" fill="url(#fur)" ${stroke()}/>`,
      `<path d="M76 120 C98 128 132 128 156 116 C142 128 98 132 76 120 Z" fill="#d3d5da" opacity="0.8"/>`,
      // Ears.
      `<path d="M160 52 L162 28 L180 44 Z" fill="#6f727a" ${stroke(4)}/>`,
      `<path d="M165 45 L166 35 L174 43 Z" fill="#f2b3b8"/>`,
      `<path d="M176 46 L186 26 L196 48 Z" fill="#7c7f87" ${stroke(4)}/>`,
      `<path d="M181 45 L186 34 L191 46 Z" fill="#f2b3b8"/>`,
      // Head.
      `<path d="M150 72 C150 48 176 38 196 50 C210 58 214 72 206 84 C198 96 170 98 158 90 C152 86 150 80 150 72 Z" fill="url(#fur)" ${stroke()}/>`,
      `<path d="M166 58 C180 51 198 53 206 64 C196 57 180 57 166 62 Z" fill="#f4f4f4"/>`,
      // The mask.
      `<path d="M162 66 C176 58 198 58 209 68 C198 78 178 80 162 72 Z" fill="#1f2024"/>`,
      `<circle cx="190" cy="67" r="4.5" fill="#ffffff"/><circle cx="191.5" cy="67" r="2.3" fill="#111111"/>`,
      `<path d="M170 80 C184 86 200 86 206 80 C200 90 180 92 170 80 Z" fill="#f4f4f4"/>`,
      // Snout and nose.
      `<path d="M200 74 C208 72 215 76 213 82 C207 87 200 85 198 80 Z" fill="#ececed" ${stroke(3)}/>`,
      `<circle cx="212" cy="78" r="4.5" fill="#1f2024"/>`,
    ].join(''),
  );
}

/** A red fox trotting right, 220 x 150. */
function foxSvg(): string {
  const defs = vGrad('foxfur', '#f29a4a', '#d96b24') + vGrad('foxtail', '#f0a055', '#cf6420');
  return svg(
    220,
    150,
    defs,
    [
      // Big bushy tail with a white tip.
      `<path d="M56 78 C30 74 8 58 6 34 C22 44 40 50 60 60 Z" fill="url(#foxtail)" ${stroke()}/>`,
      `<path d="M6 34 C10 44 16 48 24 50 C18 40 14 36 6 34 Z" fill="#ffffff" ${stroke(4)}/>`,
      // Slim black-socked legs.
      `<rect x="66" y="98" width="13" height="36" rx="6" fill="#2e2626" ${stroke(4)}/>`,
      `<rect x="88" y="100" width="13" height="34" rx="6" fill="#2e2626" ${stroke(4)}/>`,
      `<rect x="136" y="100" width="13" height="34" rx="6" fill="#2e2626" ${stroke(4)}/>`,
      `<rect x="156" y="98" width="13" height="36" rx="6" fill="#2e2626" ${stroke(4)}/>`,
      // Body, with a pale belly.
      `<path d="M52 82 C52 60 86 54 118 56 C150 58 170 70 170 88 C170 108 146 114 112 114 C78 114 52 106 52 82 Z" fill="url(#foxfur)" ${stroke()}/>`,
      `<path d="M84 104 C108 112 136 112 158 102 C144 114 104 116 84 104 Z" fill="#fff1e0"/>`,
      // Tall pointy ears.
      `<path d="M158 50 L160 16 L182 42 Z" fill="#d96b24" ${stroke(4)}/>`,
      `<path d="M162 42 L163 26 L174 40 Z" fill="#2e2626"/>`,
      `<path d="M178 44 L192 12 L200 46 Z" fill="#e57d33" ${stroke(4)}/>`,
      `<path d="M183 42 L191 24 L195 44 Z" fill="#2e2626"/>`,
      // Head with a long snout and white cheeks.
      `<path d="M150 66 C150 44 178 36 198 48 C206 54 214 62 216 70 C206 78 186 84 170 84 C158 84 150 76 150 66 Z" fill="url(#foxfur)" ${stroke()}/>`,
      `<path d="M168 74 C182 84 204 80 216 70 C210 84 184 90 168 74 Z" fill="#ffffff"/>`,
      `<circle cx="214" cy="68" r="4.5" fill="#1f1a1a"/>`,
      // Sly eye.
      `<path d="M180 58 Q187 53 194 58 Q187 62 180 58 Z" fill="#ffd23f" ${stroke(2)}/>`,
      `<circle cx="188" cy="58" r="2" fill="#111"/>`,
    ].join(''),
  );
}

/** A mink slinking right: long, low, and dark brown, 220 x 110. */
function minkSvg(): string {
  const defs = vGrad('mink', '#6b4a36', '#3e2a1e');
  return svg(
    220,
    110,
    defs,
    [
      // Fluffy tail.
      `<path d="M40 66 C24 66 8 58 6 44 C18 50 30 54 46 56 Z" fill="#3a271c" ${stroke()}/>`,
      // Short legs.
      `<rect x="54" y="72" width="14" height="22" rx="6" fill="#2f2018" ${stroke(4)}/>`,
      `<rect x="74" y="74" width="14" height="20" rx="6" fill="#2f2018" ${stroke(4)}/>`,
      `<rect x="138" y="74" width="14" height="20" rx="6" fill="#2f2018" ${stroke(4)}/>`,
      `<rect x="158" y="72" width="14" height="22" rx="6" fill="#2f2018" ${stroke(4)}/>`,
      // Long slinky body with an arch in the middle.
      `<path d="M38 64 C40 46 70 38 100 40 C120 30 150 32 168 44 C182 52 184 70 170 78 C140 88 70 88 46 80 C40 76 38 70 38 64 Z" fill="url(#mink)" ${stroke()}/>`,
      `<path d="M70 50 C96 42 130 40 156 48" fill="none" stroke="#8a6a52" stroke-width="4" stroke-linecap="round" opacity="0.7"/>`,
      // Little round ears.
      `<circle cx="178" cy="36" r="8" fill="#4a3226" ${stroke(4)}/>`,
      `<circle cx="194" cy="36" r="7" fill="#4a3226" ${stroke(4)}/>`,
      // Head with a white chin.
      `<path d="M166 54 C166 38 186 32 202 40 C212 46 216 56 212 62 C204 70 180 72 172 66 C168 62 166 58 166 54 Z" fill="url(#mink)" ${stroke()}/>`,
      `<path d="M184 64 C194 70 206 68 212 62 C206 72 190 74 184 64 Z" fill="#f4efe8"/>`,
      `<circle cx="212" cy="54" r="4" fill="#1a1210"/>`,
      // Beady eye with a glint.
      `<circle cx="194" cy="48" r="4.5" fill="#111"/><circle cx="195.5" cy="46.5" r="1.6" fill="#ffffff"/>`,
    ].join(''),
  );
}

/** A snapping turtle plodding right, with a ridged shell and a hooked beak, 220 x 150. */
function turtleSvg(): string {
  const defs = vGrad('shell', '#7c8a4a', '#4d5a2a') + vGrad('skin', '#9aa06a', '#6f7648');
  return svg(
    220,
    150,
    defs,
    [
      // Spiky tail.
      `<path d="M44 104 C28 106 12 104 4 98 C16 94 30 92 46 92 Z" fill="url(#skin)" ${stroke(4)}/>`,
      `<path d="M14 96 L18 88 L24 95 L28 87 L34 94" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
      // Stubby clawed legs.
      `<path d="M54 106 C50 120 52 132 66 134 C76 134 80 124 76 108 Z" fill="url(#skin)" ${stroke(4)}/>`,
      `<path d="M140 108 C138 122 142 134 156 134 C166 132 168 122 164 106 Z" fill="url(#skin)" ${stroke(4)}/>`,
      // Belly plate.
      `<path d="M40 100 C60 116 150 116 176 100 Z" fill="#d9c98a" ${stroke(4)}/>`,
      // Big domed shell with ridges.
      `<path d="M36 102 C34 60 70 30 110 30 C150 30 182 58 180 102 Z" fill="url(#shell)" ${stroke()}/>`,
      `<path d="M72 44 L64 70 L82 96 M110 32 L110 60 M146 44 L156 70 L138 96 M64 70 L110 60 L156 70 M82 96 L110 60 L138 96" fill="none" stroke="#3a4420" stroke-width="4" stroke-linejoin="round"/>`,
      `<path d="M90 34 L96 24 L102 32 M118 32 L124 22 L130 34" fill="#5d6b32" ${stroke(3)}/>`,
      // Head with a hooked beak and a grumpy eye.
      `<path d="M174 80 C176 62 196 56 210 64 C218 70 218 82 214 88 C206 96 188 98 180 94 C176 90 174 86 174 80 Z" fill="url(#skin)" ${stroke()}/>`,
      `<path d="M206 78 C214 80 218 86 214 94 C208 90 204 86 202 82 Z" fill="#4a4a3a" ${stroke(3)}/>`,
      `<circle cx="198" cy="72" r="4.5" fill="#f2d24a" ${stroke(2)}/><circle cx="199" cy="72" r="2" fill="#111"/>`,
      `<path d="M190 66 L204 68" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
    ].join(''),
  );
}

/** The Night Bandit: a big raccoon in a striped shirt and beanie with a sack of stolen snacks. 240 x 180. */
function banditSvg(): string {
  const body = 'M56 104 C56 72 94 60 134 62 C170 64 192 82 192 108 C192 136 164 148 126 148 C88 148 56 136 56 104 Z';
  const defs =
    vGrad('bfur', '#7b7e87', '#4a4c53') +
    vGrad('sack', '#e2c48f', '#b8955c') +
    `<clipPath id="shirt"><path d="${body}"/></clipPath>`;
  const stripes: string[] = [];
  for (let x = 60; x < 196; x += 22) stripes.push(`<rect x="${x}" y="60" width="11" height="90" fill="#1d1e22"/>`);
  return svg(
    240,
    180,
    defs,
    [
      // Loot sack slung over its back.
      `<path d="M34 64 C18 40 36 14 64 18 C90 22 98 50 84 70 C70 88 46 86 34 64 Z" fill="url(#sack)" ${stroke()}/>`,
      `<path d="M78 22 L96 10 M84 28 L100 22" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
      `<circle cx="50" cy="44" r="6" fill="#7ccd4a" ${stroke(2)}/><circle cx="64" cy="54" r="5" fill="#7ccd4a" ${stroke(2)}/>`,
      // Ringed tail.
      `<path d="M60 104 C28 106 8 84 16 58 C28 72 42 80 66 86 Z" fill="#6f727a" ${stroke()}/>`,
      `<path d="M22 66 L32 80 M36 76 L42 90 M16 84 L30 94" stroke="#1d1e22" stroke-width="8" stroke-linecap="round"/>`,
      // Legs.
      `<rect x="72" y="130" width="20" height="38" rx="9" fill="#2e3035" ${stroke(4)}/>`,
      `<rect x="100" y="132" width="20" height="36" rx="9" fill="#2e3035" ${stroke(4)}/>`,
      `<rect x="146" y="132" width="20" height="36" rx="9" fill="#2e3035" ${stroke(4)}/>`,
      `<rect x="170" y="130" width="20" height="38" rx="9" fill="#2e3035" ${stroke(4)}/>`,
      // Body in a striped burglar shirt.
      `<path d="${body}" fill="#f2f2f2"/>`,
      `<g clip-path="url(#shirt)">${stripes.join('')}</g>`,
      `<path d="${body}" fill="none" ${stroke()}/>`,
      // Ears.
      `<path d="M178 58 L180 30 L200 48 Z" fill="#5e6168" ${stroke(4)}/>`,
      `<path d="M196 50 L208 26 L218 52 Z" fill="#6a6d74" ${stroke(4)}/>`,
      // Head.
      `<path d="M168 80 C168 52 196 42 218 56 C234 66 238 82 228 96 C218 110 188 110 176 100 C170 96 168 88 168 80 Z" fill="url(#bfur)" ${stroke()}/>`,
      `<path d="M184 66 C200 58 220 60 230 72 C218 64 200 64 184 70 Z" fill="#f4f4f4"/>`,
      // Black beanie.
      `<path d="M170 64 C172 34 214 26 226 54 C206 48 188 52 170 64 Z" fill="#22242a" ${stroke(4)}/>`,
      `<path d="M168 66 C188 52 210 50 228 56" fill="none" stroke="#3d4048" stroke-width="7" stroke-linecap="round"/>`,
      // The mask, with cheeky eyes.
      `<path d="M178 74 C194 64 220 64 233 76 C220 88 196 90 178 82 Z" fill="#111214"/>`,
      `<circle cx="202" cy="76" r="5" fill="#ffe066"/><circle cx="220" cy="76" r="4.5" fill="#ffe066"/>`,
      `<circle cx="203" cy="76" r="2.4" fill="#111"/><circle cx="221" cy="76" r="2.2" fill="#111"/>`,
      // Grinning snout.
      `<path d="M222 86 C232 84 240 90 236 96 C228 102 218 98 216 92 Z" fill="#ececed" ${stroke(3)}/>`,
      `<circle cx="236" cy="90" r="5" fill="#111214"/>`,
      `<path d="M200 98 Q212 106 224 98" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
    ].join(''),
  );
}

/** A hawk seen from above, flying up (toward y = 0), 200 x 200. */
function hawkSvg(): string {
  const defs = vGrad('wing', '#8f6038', '#5e3c20') + vGrad('hb', '#a3764a', '#6e4a2c');
  const wing =
    `<path d="M92 92 C70 78 34 76 6 94 C18 98 26 104 30 114 C40 106 50 108 56 116 C64 108 74 110 80 118 C86 110 92 110 96 116 Z" fill="url(#wing)" ${stroke()}/>` +
    `<path d="M88 96 C70 88 46 88 26 96 C46 96 70 100 88 106 Z" fill="#c09565" opacity="0.8"/>`;
  return svg(
    200,
    200,
    defs,
    [
      `<path d="M86 146 C80 170 84 188 100 194 C116 188 120 170 114 146 Z" fill="#b8582f" ${stroke()}/>`,
      `<path d="M88 170 Q100 175 112 170 M90 182 Q100 186 110 182" fill="none" stroke="#7a3518" stroke-width="3" stroke-linecap="round"/>`,
      wing,
      `<g transform="translate(200 0) scale(-1 1)">${wing}</g>`,
      `<ellipse cx="100" cy="112" rx="19" ry="42" fill="url(#hb)" ${stroke()}/>`,
      `<circle cx="100" cy="66" r="17" fill="#6e4a2c" ${stroke()}/>`,
      `<path d="M93 52 Q100 36 107 52 Z" fill="#f2c029" ${stroke(3)}/>`,
      `<circle cx="92" cy="62" r="3.5" fill="#f5d547"/><circle cx="108" cy="62" r="3.5" fill="#f5d547"/>`,
      `<circle cx="92" cy="61" r="1.6" fill="#111"/><circle cx="108" cy="61" r="1.6" fill="#111"/>`,
    ].join(''),
  );
}

// --- Buildings and props ---------------------------------------------------

/** The duck house, 240 x 230. Its door is at the bottom center. */
function houseSvg(): string {
  const defs = vGrad('wood', '#f3dfb6', '#d9bd8a') + vGrad('roof', '#e0654c', '#b34330');
  return svg(
    240,
    230,
    defs,
    [
      // Stilts and ramp.
      `<rect x="48" y="172" width="14" height="46" rx="4" fill="#7a5534" ${stroke(4)}/>`,
      `<rect x="178" y="172" width="14" height="46" rx="4" fill="#7a5534" ${stroke(4)}/>`,
      `<path d="M6 222 L78 178 L94 186 L24 228 Z" fill="#b8905e" ${stroke(4)}/>`,
      `<path d="M28 214 L40 222 M44 204 L56 212 M60 194 L72 202" stroke="#8d6a40" stroke-width="3"/>`,
      // Floor and walls.
      `<rect x="30" y="160" width="180" height="18" rx="6" fill="#8b6440" ${stroke(4)}/>`,
      `<rect x="44" y="88" width="152" height="78" fill="url(#wood)" ${stroke()}/>`,
      `<path d="M46 108 H194 M46 128 H194 M46 148 H194" stroke="#c9a878" stroke-width="3"/>`,
      // Roof.
      `<path d="M22 98 L120 22 L218 98 Z" fill="url(#roof)" ${stroke(6)}/>`,
      `<path d="M58 70 H182 M40 86 H200 M80 54 H160" stroke="#9c3b2a" stroke-width="3" opacity="0.7"/>`,
      // Round window in the gable (glows at night).
      `<circle cx="120" cy="66" r="13" fill="#ffe08a" ${stroke(4)}/>`,
      `<path d="M120 53 V79 M107 66 H133" stroke="${INK}" stroke-width="3"/>`,
      // Door.
      `<path d="M100 166 L100 130 A20 20 0 0 1 140 130 L140 166 Z" fill="#3a2518" ${stroke(4)}/>`,
      `<rect x="92" y="164" width="56" height="6" rx="3" fill="#6b4a2f"/>`,
    ].join(''),
  );
}

/** The solar fountain's stone basin, seen from above, 120 x 120. */
function fountainSvg(): string {
  const defs = rGrad('fw', '#8fd3ff', '#3f8fcf');
  return svg(
    120,
    120,
    defs,
    [
      `<circle cx="60" cy="60" r="50" fill="#b7bec5" ${stroke()}/>`,
      `<path d="M60 10 V22 M60 98 V110 M10 60 H22 M98 60 H110 M25 25 L33 33 M87 87 L95 95 M95 25 L87 33 M25 95 L33 87" stroke="#8a939b" stroke-width="3"/>`,
      `<circle cx="60" cy="60" r="36" fill="url(#fw)" ${stroke(4)}/>`,
      `<circle cx="60" cy="60" r="11" fill="#d9dfe4" ${stroke(4)}/>`,
      `<path d="M44 48 Q52 42 60 44" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`,
    ].join(''),
  );
}

/** A straw nest where a duck can be placed, 120 x 120. */
function nestSvg(): string {
  const straw: string[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = 40;
    const x1 = 60 + Math.cos(a) * (r - 8);
    const y1 = 60 + Math.sin(a) * (r - 8);
    const x2 = 60 + Math.cos(a + 0.5) * (r + 6);
    const y2 = 60 + Math.sin(a + 0.5) * (r + 6);
    straw.push(`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }
  return svg(
    120,
    120,
    '',
    [
      `<circle cx="60" cy="60" r="48" fill="#d8b25a" ${stroke(5)}/>`,
      `<path d="${straw.join(' ')}" stroke="#f3d480" stroke-width="4" stroke-linecap="round"/>`,
      `<circle cx="60" cy="60" r="28" fill="#9b7430" stroke="#7d5c22" stroke-width="4"/>`,
    ].join(''),
  );
}

function lilyPadSvg(flower: boolean): string {
  return svg(
    80,
    80,
    '',
    `<path d="M40 40 L40 8 A32 32 0 1 0 64 18 Z" fill="#4f9a3f" stroke="#2f6b28" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M40 40 L22 24 M40 40 L20 50 M40 40 L44 68" stroke="#3d8032" stroke-width="2"/>` +
      (flower
        ? `<circle cx="30" cy="36" r="9" fill="#ffc2d6" stroke="#e07fa3" stroke-width="2"/><circle cx="30" cy="36" r="3.5" fill="#ffe066"/>`
        : ''),
  );
}

function reedsSvg(): string {
  return svg(
    60,
    100,
    '',
    `<path d="M20 98 Q18 60 14 30 M30 98 Q30 56 32 18 M40 98 Q42 66 48 40" fill="none" stroke="#4d8a3a" stroke-width="4" stroke-linecap="round"/>` +
      `<rect x="10" y="22" width="9" height="20" rx="4.5" fill="#7a4e2a" ${stroke(2)}/>` +
      `<rect x="28" y="10" width="9" height="22" rx="4.5" fill="#7a4e2a" ${stroke(2)}/>` +
      `<path d="M8 98 Q16 78 12 64 M52 98 Q46 82 52 70" fill="none" stroke="#5fa246" stroke-width="3" stroke-linecap="round"/>`,
  );
}

function bushSvg(): string {
  const defs = rGrad('bush', '#7fcf5f', '#3f8f3a');
  return svg(
    120,
    100,
    defs,
    `<ellipse cx="60" cy="90" rx="46" ry="8" fill="#000" opacity="0.18"/>` +
      `<circle cx="38" cy="60" r="26" fill="url(#bush)" ${stroke(4)}/>` +
      `<circle cx="82" cy="60" r="26" fill="url(#bush)" ${stroke(4)}/>` +
      `<circle cx="60" cy="44" r="30" fill="url(#bush)" ${stroke(4)}/>` +
      `<circle cx="48" cy="40" r="4" fill="#e0445a"/><circle cx="74" cy="56" r="4" fill="#e0445a"/><circle cx="36" cy="64" r="4" fill="#e0445a"/>` +
      `<path d="M46 30 Q56 24 66 28" fill="none" stroke="#b6f28a" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`,
  );
}

function treeSvg(): string {
  const defs = rGrad('leaf', '#6fc255', '#2f7a32');
  return svg(
    180,
    180,
    defs,
    `<ellipse cx="96" cy="100" rx="78" ry="70" fill="#000" opacity="0.18"/>` +
      `<circle cx="60" cy="96" r="42" fill="url(#leaf)" ${stroke(5)}/>` +
      `<circle cx="120" cy="96" r="42" fill="url(#leaf)" ${stroke(5)}/>` +
      `<circle cx="90" cy="60" r="48" fill="url(#leaf)" ${stroke(5)}/>` +
      `<circle cx="90" cy="112" r="40" fill="url(#leaf)" ${stroke(5)}/>` +
      `<path d="M66 50 Q82 36 100 40 M110 80 Q124 74 134 82" fill="none" stroke="#b6f28a" stroke-width="4" stroke-linecap="round" opacity="0.6"/>`,
  );
}

function flowerSvg(petal: string): string {
  const petals: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    petals.push(`<circle cx="${(20 + Math.cos(a) * 8).toFixed(1)}" cy="${(20 + Math.sin(a) * 8).toFixed(1)}" r="6.5" fill="${petal}" stroke="${INK}" stroke-width="1.5"/>`);
  }
  return svg(40, 40, '', petals.join('') + `<circle cx="20" cy="20" r="5" fill="#ffd23f" stroke="${INK}" stroke-width="1.5"/>`);
}

function rockSvg(): string {
  const defs = vGrad('rock', '#c4c9ce', '#8a9097');
  return svg(
    70,
    50,
    defs,
    `<ellipse cx="36" cy="44" rx="30" ry="5" fill="#000" opacity="0.18"/>` +
      `<path d="M8 40 C4 24 18 8 36 8 C54 8 66 22 62 40 Z" fill="url(#rock)" ${stroke(4)}/>` +
      `<path d="M22 20 Q30 14 40 16" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>`,
  );
}

// --- Icons and effects ---------------------------------------------------

function peaSvg(): string {
  const defs = rGrad('pea', '#b8f07a', '#4f9e2a');
  return svg(64, 64, defs, `<circle cx="32" cy="32" r="26" fill="url(#pea)" ${stroke(4)}/><circle cx="23" cy="22" r="7" fill="#ffffff" opacity="0.6"/>`);
}

function heartSvg(): string {
  const defs = vGrad('heart', '#ff7a8f', '#e0334f');
  return svg(
    64,
    64,
    defs,
    `<path d="M32 56 C8 40 4 26 10 16 C16 6 28 8 32 18 C36 8 48 6 54 16 C60 26 56 40 32 56 Z" fill="url(#heart)" ${stroke(4)}/>` +
      `<ellipse cx="20" cy="20" rx="6" ry="4" fill="#ffffff" opacity="0.6"/>`,
  );
}

function boltSvg(): string {
  return svg(64, 64, '', `<path d="M36 4 L12 36 H30 L26 60 L52 26 H34 Z" fill="#ffd23f" ${stroke(4)}/>`);
}

function sunSvg(): string {
  const rays: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    rays.push(`M${(32 + Math.cos(a) * 20).toFixed(1)} ${(32 + Math.sin(a) * 20).toFixed(1)} L${(32 + Math.cos(a) * 29).toFixed(1)} ${(32 + Math.sin(a) * 29).toFixed(1)}`);
  }
  return svg(64, 64, '', `<path d="${rays.join(' ')}" stroke="#ffb020" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="32" r="15" fill="#ffd23f" ${stroke(4)}/>`);
}

function moonSvg(): string {
  return svg(64, 64, '', `<path d="M40 6 A26 26 0 1 0 58 44 A20 20 0 1 1 40 6 Z" fill="#fff2b3" ${stroke(4)}/><circle cx="24" cy="36" r="3" fill="#e6d38a"/><circle cx="32" cy="48" r="2" fill="#e6d38a"/>`);
}

// --- Duck power icons (shown on picker cards and info panels) ---

function splashIconSvg(): string {
  const defs = vGrad('drop', '#8fd3ff', '#2f7fc0');
  return svg(
    64,
    64,
    defs,
    `<path d="M30 6 C38 20 48 30 48 42 C48 52 40 58 30 58 C20 58 12 52 12 42 C12 30 22 20 30 6 Z" fill="url(#drop)" ${stroke(4)}/>` +
      `<ellipse cx="23" cy="40" rx="4" ry="7" fill="#ffffff" opacity="0.6"/>` +
      `<circle cx="54" cy="16" r="5" fill="#8fd3ff" ${stroke(3)}/><circle cx="52" cy="54" r="4" fill="#8fd3ff" ${stroke(3)}/>`,
  );
}

function flapIconSvg(): string {
  return svg(
    64,
    64,
    '',
    `<path d="M50 8 C58 24 48 46 22 56 L14 58 C18 40 30 18 50 8 Z" fill="#454a53" ${stroke(4)}/>` +
      `<path d="M14 58 L44 18 M24 44 L40 40 M30 34 L46 30 M20 52 L34 50" stroke="#9aa0a8" stroke-width="3" stroke-linecap="round"/>`,
  );
}

function quackIconSvg(): string {
  return svg(
    64,
    64,
    '',
    `<circle cx="20" cy="32" r="12" fill="#ffd23f" ${stroke(4)}/>` +
      `<path d="M36 18 Q46 32 36 46 M44 10 Q58 32 44 54" fill="none" stroke="#ffd23f" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M36 18 Q46 32 36 46 M44 10 Q58 32 44 54" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>`,
  );
}

/** A stop sign: Curtis holds the line. */
function holdIconSvg(): string {
  const points: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    points.push(`${(32 + Math.cos(a) * 26).toFixed(1)},${(32 + Math.sin(a) * 26).toFixed(1)}`);
  }
  return svg(64, 64, '', `<polygon points="${points.join(' ')}" fill="#e0334f" ${stroke(4)}/><rect x="16" y="28" width="32" height="8" rx="3" fill="#ffffff"/>`);
}

function trophySvg(): string {
  const defs = vGrad('cup', '#ffe680', '#e8a317');
  return svg(
    64,
    64,
    defs,
    `<path d="M16 10 H48 V26 C48 38 40 44 32 44 C24 44 16 38 16 26 Z" fill="url(#cup)" ${stroke(4)}/>` +
      `<path d="M16 16 H8 C8 28 14 30 18 30 M48 16 H56 C56 28 50 30 46 30" fill="none" ${stroke(4)}/>` +
      `<rect x="28" y="44" width="8" height="8" fill="#e8a317" ${stroke(3)}/>` +
      `<rect x="18" y="52" width="28" height="8" rx="3" fill="#b8791a" ${stroke(3)}/>` +
      `<path d="M24 16 Q24 30 30 36" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`,
  );
}

/** A soft white glow, tinted and blended for lights. */
function glowSvg(): string {
  return svg(128, 128, rGrad('g', '#ffffff', '#ffffff', 1, 0), `<circle cx="64" cy="64" r="64" fill="url(#g)"/>`);
}

function starSvg(): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 30 : 13;
    points.push(`${(32 + Math.cos(a) * r).toFixed(1)},${(32 + Math.sin(a) * r).toFixed(1)}`);
  }
  return svg(64, 64, '', `<polygon points="${points.join(' ')}" fill="#ffffff"/>`);
}

function featherSvg(): string {
  return svg(32, 64, '', `<path d="M16 4 C28 20 28 44 16 60 C4 44 4 20 16 4 Z" fill="#ffffff"/><path d="M16 8 V60" stroke="#cccccc" stroke-width="2"/>`);
}

/** Seamless grass tile with little tufts. */
function grassSvg(): string {
  // A fixed pattern (not random) so the tile looks the same every time.
  const tufts: string[] = [];
  for (let i = 0; i < 46; i++) {
    const x = 10 + ((i * 97) % 236);
    const y = 10 + ((i * 53 + (i % 7) * 31) % 236);
    const dark = i % 3 === 0;
    const color = dark ? '#4f9437' : '#8ccc62';
    tufts.push(`<path d="M${x} ${y} l-3 -7 M${x} ${y} l0 -9 M${x} ${y} l3 -7" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`);
  }
  return svg(256, 256, '', `<rect width="256" height="256" fill="#6db24c"/>${tufts.join('')}`);
}

export function allSprites(): SpriteArt[] {
  const ducks: SpriteArt[] = (['sunny', 'potato', 'chester', 'curtis', 'craig'] as const).map((kind) => ({
    key: `duck-${kind}`,
    svg: duckSvg(DUCK_LOOKS[kind]),
    width: 84,
    height: 84,
  }));
  return [
    ...ducks,
    { key: 'raccoon', svg: raccoonSvg(), width: 92, height: 67 },
    { key: 'fox', svg: foxSvg(), width: 100, height: 68 },
    { key: 'mink', svg: minkSvg(), width: 88, height: 44 },
    { key: 'turtle', svg: turtleSvg(), width: 110, height: 75 },
    { key: 'hawk', svg: hawkSvg(), width: 88, height: 88 },
    { key: 'bandit', svg: banditSvg(), width: 150, height: 112 },
    { key: 'house', svg: houseSvg(), width: 150, height: 144 },
    { key: 'fountain', svg: fountainSvg(), width: 64, height: 64 },
    { key: 'nest', svg: nestSvg(), width: 72, height: 72 },
    { key: 'lily', svg: lilyPadSvg(false), width: 40, height: 40 },
    { key: 'lily-flower', svg: lilyPadSvg(true), width: 40, height: 40 },
    { key: 'reeds', svg: reedsSvg(), width: 36, height: 60 },
    { key: 'bush', svg: bushSvg(), width: 84, height: 70 },
    { key: 'tree', svg: treeSvg(), width: 160, height: 160 },
    { key: 'flower-white', svg: flowerSvg('#ffffff'), width: 22, height: 22 },
    { key: 'flower-pink', svg: flowerSvg('#ff9ec0'), width: 22, height: 22 },
    { key: 'flower-purple', svg: flowerSvg('#b89cff'), width: 22, height: 22 },
    { key: 'rock', svg: rockSvg(), width: 44, height: 32 },
    { key: 'icon-pea', svg: peaSvg(), width: 36, height: 36 },
    { key: 'icon-heart', svg: heartSvg(), width: 36, height: 36 },
    { key: 'icon-bolt', svg: boltSvg(), width: 30, height: 30 },
    { key: 'icon-sun', svg: sunSvg(), width: 36, height: 36 },
    { key: 'icon-moon', svg: moonSvg(), width: 36, height: 36 },
    { key: 'power-splash', svg: splashIconSvg(), width: 32, height: 32 },
    { key: 'power-flap', svg: flapIconSvg(), width: 32, height: 32 },
    { key: 'power-quack', svg: quackIconSvg(), width: 32, height: 32 },
    { key: 'power-hold', svg: holdIconSvg(), width: 32, height: 32 },
    { key: 'icon-trophy', svg: trophySvg(), width: 40, height: 40 },
    { key: 'glow', svg: glowSvg(), width: 128, height: 128 },
    { key: 'star', svg: starSvg(), width: 24, height: 24 },
    { key: 'feather', svg: featherSvg(), width: 12, height: 24 },
    { key: 'grass', svg: grassSvg(), width: 256, height: 256 },
  ];
}
