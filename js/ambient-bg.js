/* ============================================================
   NEXORAA — Ambient Background: living 3D interior
   ------------------------------------------------------------
   BACKGROUND ONLY. This file renders into the #ambient-canvas
   that already sits inside .site-background. It does not touch
   the DOM, the stylesheet, the palette or any foreground element.

   What it draws: a real 3D residential interior — walls, ceiling,
   floor, a large window, curtains, a lounge group, cove lighting,
   recessed downlights, a floor lamp and a wall control panel —
   rasterised with raw WebGL. No library, no external request.

   How the site's colours survive untouched
   ----------------------------------------
   The canvas composites with `mix-blend-mode: screen`, so the shader
   outputs only the LIGHT in the room and black everywhere else.
   screen(backdrop, black) === backdrop, exactly, so an unlit surface
   cannot change a single pixel of the existing .site-background
   gradient. The operation is mathematically incapable of darkening
   or hue-shifting the page — it can only add light that wasn't there.
   The blend mode is set from JS, so the stylesheet is not touched.
   Every colour below is an existing site token (#00E0FF, #7FF0FF,
   #EEF4F8, and near neighbours of --bg-surface).

   Fallback: if WebGL is unavailable the original 2D ambient engine
   runs instead, byte-for-byte, so the site looks exactly as it did.
   ============================================================ */

(function () {
  'use strict';

  var canvas = document.getElementById('ambient-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'ambient-canvas';
    document.body.prepend(canvas);
  }

  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var COARSE  = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

  var gl = null;
  var glOpts = {
    // Opaque buffer: unlit pixels are pure black, which `screen` treats as
    // "leave the backdrop alone". No alpha maths, no accidental darkening.
    alpha: false,
    antialias: true,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power',
    failIfMajorPerformanceCaveat: false
  };
  try {
    gl = canvas.getContext('webgl', glOpts) || canvas.getContext('experimental-webgl', glOpts);
  } catch (e) { gl = null; }

  if (!gl) { legacyAmbient(); return; }

  // The scene needs roughly 21 fragment uniform vectors. GLES2 only guarantees
  // 16, though real hardware gives 64+. Rather than have the shader fail to
  // link on something ancient, check first and hand over to the 2D engine.
  if (gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) < 24) { legacyAmbient(); return; }

  /* ============================================================
     1. Room dimensions, in metres. Everything else derives here.
     ============================================================ */
  var RM = {
    x0: -4.0, x1: 4.0,          // side walls
    y0: 0.0,  y1: 3.10,         // floor, ceiling
    z0: -7.0, z1: 2.60,         // back wall, open end behind camera
    winX: 2.65, winY0: 0.78, winY1: 2.48,   // window opening in the back wall
    winZ: -6.99,
    extZ: -7.30,                // the exterior plane beyond the glass
    curtZ: -6.62,
    coveY: 2.98, coveIn: 0.16   // cove strip just below the ceiling
  };

  // Six recessed ceiling lights, in two rows of three.
  var DOWN = [
    [-2.35, RM.y1 - 0.02, -1.70], [0.0, RM.y1 - 0.02, -1.70], [2.35, RM.y1 - 0.02, -1.70],
    [-2.35, RM.y1 - 0.02, -4.55], [0.0, RM.y1 - 0.02, -4.55], [2.35, RM.y1 - 0.02, -4.55]
  ];
  var LAMP = [2.86, 1.62, -4.30];        // floor lamp head
  var PANEL = [RM.x1 - 0.02, 1.32, -2.20]; // smart-home wall panel

  /* Materials — indices shared with the fragment shader. */
  var M_WALL = 0, M_FLOOR = 1, M_CEIL = 2, M_SOFA = 3, M_TABLE = 4,
      M_CURTAIN = 5, M_COVE = 6, M_DISC = 7, M_WINDOW = 8, M_PANEL = 9,
      M_LAMP = 10, M_RUG = 11;

  /* ============================================================
     2. Geometry. Interleaved: pos(3) normal(3) uv(2) mat(1).
     ============================================================ */
  var V = [];

  function push(p, n, u, m) {
    V.push(p[0], p[1], p[2], n[0], n[1], n[2], u[0], u[1], m);
  }
  function faceNormal(a, b, c) {
    var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    var vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var l = Math.hypot(nx, ny, nz) || 1;
    return [nx / l, ny / l, nz / l];
  }
  // Winding a→b→c→d gives the outward face; the normal follows from it.
  function quad(a, b, c, d, m, uv) {
    var n = faceNormal(a, b, c);
    var q = uv || [[0, 0], [1, 0], [1, 1], [0, 1]];
    push(a, n, q[0], m); push(b, n, q[1], m); push(c, n, q[2], m);
    push(a, n, q[0], m); push(c, n, q[2], m); push(d, n, q[3], m);
  }
  function box(cx, cy, cz, sx, sy, sz, m) {
    var x0 = cx - sx / 2, x1 = cx + sx / 2,
        y0 = cy - sy / 2, y1 = cy + sy / 2,
        z0 = cz - sz / 2, z1 = cz + sz / 2;
    quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], m); // +z
    quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], m); // -z
    quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], m); // -x
    quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], m); // +x
    quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], m); // +y
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], m); // -y
  }

  /* --- the shell, all faces turned inward --- */
  (function shell() {
    var X0 = RM.x0, X1 = RM.x1, Y0 = RM.y0, Y1 = RM.y1, Z0 = RM.z0, Z1 = RM.z1;

    quad([X0, Y0, Z1], [X1, Y0, Z1], [X1, Y0, Z0], [X0, Y0, Z0], M_FLOOR);
    quad([X0, Y1, Z0], [X1, Y1, Z0], [X1, Y1, Z1], [X0, Y1, Z1], M_CEIL);
    quad([X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0], M_WALL); // left
    quad([X1, Y0, Z1], [X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1], M_WALL); // right

    // Back wall, built as four panels around the window opening.
    var wx = RM.winX, wy0 = RM.winY0, wy1 = RM.winY1, Z = Z0;
    quad([X1, Y0, Z], [X0, Y0, Z], [X0, wy0, Z], [X1, wy0, Z], M_WALL);   // under
    quad([X1, wy1, Z], [X0, wy1, Z], [X0, Y1, Z], [X1, Y1, Z], M_WALL);   // over
    quad([-wx, wy0, Z], [X0, wy0, Z], [X0, wy1, Z], [-wx, wy1, Z], M_WALL); // left pier
    quad([X1, wy0, Z], [wx, wy0, Z], [wx, wy1, Z], [X1, wy1, Z], M_WALL);   // right pier

    // The view beyond the glass: a dim, cool exterior.
    quad([wx, wy0, RM.extZ], [-wx, wy0, RM.extZ], [-wx, wy1, RM.extZ], [wx, wy1, RM.extZ], M_WINDOW);

    // Reveal (the depth of the opening) reads as real wall thickness.
    quad([-wx, wy0, RM.extZ], [-wx, wy0, Z], [-wx, wy1, Z], [-wx, wy1, RM.extZ], M_WALL);
    quad([wx, wy0, Z], [wx, wy0, RM.extZ], [wx, wy1, RM.extZ], [wx, wy1, Z], M_WALL);
    quad([-wx, wy1, Z], [wx, wy1, Z], [wx, wy1, RM.extZ], [-wx, wy1, RM.extZ], M_WALL);
  })();

  /* --- cove strip: a thin emissive line where wall meets ceiling --- */
  (function cove() {
    var y = RM.coveY, i = RM.coveIn, t = 0.045;
    var X0 = RM.x0 + i, X1 = RM.x1 - i, Z0 = RM.z0 + i, Z1 = RM.z1;
    quad([X0, y, Z0], [X1, y, Z0], [X1, y + t, Z0], [X0, y + t, Z0], M_COVE);
    quad([X0, y, Z1], [X0, y, Z0], [X0, y + t, Z0], [X0, y + t, Z1], M_COVE);
    quad([X1, y, Z0], [X1, y, Z1], [X1, y + t, Z1], [X1, y + t, Z0], M_COVE);
  })();

  /* --- recessed downlight discs; uv.x carries the light's index --- */
  DOWN.forEach(function (d, i) {
    var r = 0.085, x = d[0], y = RM.y1 - 0.008, z = d[2];
    var uv = [[i, 0], [i, 0], [i, 1], [i, 1]];
    quad([x - r, y, z + r], [x + r, y, z + r], [x + r, y, z - r], [x - r, y, z - r], M_DISC, uv);
  });

  /* --- lounge group, kept low and to the sides so it never crowds text --- */
  box(-1.45, 0.46, -4.05, 3.05, 0.44, 1.30, M_SOFA);   // seat
  box(-1.45, 0.80, -4.62, 3.05, 0.74, 0.24, M_SOFA);   // back
  box(-2.90, 0.62, -4.05, 0.22, 0.42, 1.30, M_SOFA);   // arm
  box(0.00, 0.62, -4.05, 0.22, 0.42, 1.30, M_SOFA);    // arm
  box(-1.45, 0.40, -2.62, 1.55, 0.07, 0.78, M_TABLE);  // coffee table top
  box(-1.45, 0.19, -2.62, 1.30, 0.30, 0.58, M_TABLE);  // base
  quad([-3.30, 0.004, -1.90], [0.55, 0.004, -1.90], [0.55, 0.004, -5.10], [-3.30, 0.004, -5.10], M_RUG);

  box(LAMP[0], 0.80, LAMP[2], 0.05, 1.60, 0.05, M_LAMP);           // lamp stem
  box(LAMP[0], LAMP[1], LAMP[2], 0.34, 0.06, 0.34, M_LAMP);        // lamp head
  box(PANEL[0] - 0.01, PANEL[1], PANEL[2], 0.02, 0.15, 0.24, M_PANEL); // wall panel

  var STATIC_COUNT = V.length / 9;

  /* --- curtains: two subdivided panels, deformed in the vertex shader.
         uv.x runs across the panel, uv.y up it; pos.x carries the side. --- */
  (function curtains() {
    var COLS = 26, ROWS = 7;
    [-1, 1].forEach(function (side) {
      for (var c = 0; c < COLS; c++) {
        for (var r = 0; r < ROWS; r++) {
          var u0 = c / COLS, u1 = (c + 1) / COLS;
          var v0 = r / ROWS, v1 = (r + 1) / ROWS;
          var y0 = RM.winY0 - 0.16 + v0 * (RM.winY1 - RM.winY0 + 0.34);
          var y1 = RM.winY0 - 0.16 + v1 * (RM.winY1 - RM.winY0 + 0.34);
          // Positions are placeholders; the vertex shader computes x and z.
          var a = [side, y0, 0], b = [side, y0, 0], cc = [side, y1, 0], d = [side, y1, 0];
          var n = [0, 0, 1];
          push(a, n, [u0, v0], M_CURTAIN); push(b, n, [u1, v0], M_CURTAIN); push(cc, n, [u1, v1], M_CURTAIN);
          push(a, n, [u0, v0], M_CURTAIN); push(cc, n, [u1, v1], M_CURTAIN); push(d, n, [u0, v1], M_CURTAIN);
        }
      }
    });
  })();

  var VERTS = new Float32Array(V);
  var VERT_COUNT = V.length / 9;
  V = null;

  /* ============================================================
     3. Shaders
     ============================================================ */
  var VS = [
    'precision highp float;',
    'attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV; attribute float aMat;',
    'uniform mat4 uProj, uView;',
    'uniform float uTime, uCurtainL, uCurtainR;',
    'uniform vec4 uCurtGeom;',   // x0span, zPlane, minW, maxW
    'varying vec3 vPos; varying vec3 vNrm; varying vec2 vUV; varying float vMat;',
    'void main(){',
    '  vec3 p = aPos; vec3 n = aNormal;',
    '  if (aMat > 4.5 && aMat < 5.5) {',            // curtain
    '    float side = aPos.x;',
    '    float closed = side < 0.0 ? uCurtainL : uCurtainR;',
    '    float pw = mix(uCurtGeom.z, uCurtGeom.w, closed);',
    '    float dir = side < 0.0 ? 1.0 : -1.0;',
    '    float edge = side < 0.0 ? -uCurtGeom.x : uCurtGeom.x;',
    // Gathered fabric has more, deeper folds; drawn fabric flattens out.
    '    float folds = mix(9.0, 4.2, closed);',
    '    float amp   = mix(0.150, 0.052, closed);',
    '    float ph    = aUV.x * folds * 6.28318 + side * 1.7;',
    // Fabric hangs from a track: folds open out slightly toward the hem.
    '    float hang  = mix(0.72, 1.06, aUV.y);',
    '    float sway  = sin(uTime * 0.19 + aUV.y * 1.3 + side * 2.1) * 0.014 * (1.0 - aUV.y);',
    '    float x = edge + dir * aUV.x * pw + cos(ph) * amp * 0.22 * hang;',
    '    float z = uCurtGeom.y + sin(ph) * amp * hang + sway;',
    '    p = vec3(x, aPos.y, z);',
    // Analytic normal from the fold curve, so the light catches each pleat.
    '    float dzdu = cos(ph) * amp * hang * folds * 6.28318;',
    '    vec3 T = normalize(vec3(dir * pw, 0.0, dzdu));',
    '    n = normalize(cross(vec3(0.0, 1.0, 0.0), T)) * -dir;',
    '  }',
    '  vPos = p; vNrm = n; vUV = aUV; vMat = aMat;',
    '  gl_Position = uProj * uView * vec4(p, 1.0);',
    '}'
  ].join('\n');

  var FS = [
    // highp is optional in fragment shaders on GLES2 hardware; asking for it
    // unconditionally is a compile failure on some older mobile GPUs.
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'varying vec3 vPos; varying vec3 vNrm; varying vec2 vUV; varying float vMat;',
    'uniform vec3 uEye;',
    'uniform vec3 uDownPos[6];',
    'uniform float uDown[6];',
    'uniform float uCove, uAccent, uDay, uPanel;',
    'uniform vec3 uLampPos, uPanelPos;',
    'uniform vec2 uRes;',
    'uniform float uFade;',

    // Every colour here is an existing Nexoraa token.
    'const vec3 CYAN  = vec3(0.000, 0.878, 1.000);',   // #00E0FF
    'const vec3 SOFT  = vec3(0.498, 0.941, 1.000);',   // #7FF0FF
    'const vec3 WHITE = vec3(0.933, 0.957, 0.973);',   // #EEF4F8

    'float att(float d, float k){ return 1.0 / (1.0 + k * d * d); }',

    'void main(){',
    '  vec3 N = normalize(vNrm);',
    '  vec3 Vv = normalize(uEye - vPos);',
    '  if (dot(N, Vv) < 0.0) N = -N;',   // keep two-sided surfaces (curtains) lit

    '  vec3 albedo; float emis = 0.0; vec3 emisC = WHITE; float rough = 1.0;',
    '  if (vMat < 0.5)       { albedo = vec3(0.058, 0.068, 0.083); }',           // wall
    '  else if (vMat < 1.5)  { albedo = vec3(0.042, 0.050, 0.062); rough = 0.55; }', // floor
    '  else if (vMat < 2.5)  { albedo = vec3(0.052, 0.060, 0.073); }',           // ceiling
    '  else if (vMat < 3.5)  { albedo = vec3(0.047, 0.055, 0.068); }',           // sofa
    '  else if (vMat < 4.5)  { albedo = vec3(0.036, 0.043, 0.054); rough = 0.6; }', // table
    '  else if (vMat < 5.5)  { albedo = vec3(0.066, 0.077, 0.092); }',           // curtain
    '  else if (vMat < 6.5)  { albedo = vec3(0.02); emis = uCove * 1.35; emisC = mix(CYAN, WHITE, 0.34); }',
    '  else if (vMat < 7.5)  { albedo = vec3(0.02); emisC = WHITE;',             // downlight disc
    '                          for (int i = 0; i < 6; i++) { if (abs(float(i) - vUV.x) < 0.5) emis = uDown[i] * 1.7; } }',
    '  else if (vMat < 8.5)  {',                                                // exterior beyond glass
    '                          float h = clamp((vPos.y - 0.6) / 2.1, 0.0, 1.0);',
    '                          albedo = vec3(0.02);',
    '                          emisC = mix(mix(CYAN, SOFT, 0.5), WHITE, uDay * 0.55);',
    '                          emis = (0.10 + 0.95 * uDay) * mix(1.0, 0.35, h); }',
    '  else if (vMat < 9.5)  { albedo = vec3(0.02); emis = uPanel * 1.15; emisC = CYAN; }',
    '  else if (vMat < 10.5) { albedo = vec3(0.050, 0.058, 0.070);',             // floor lamp
    '                          if (vNrm.y < -0.5) { emis = uAccent * 1.5; emisC = WHITE; } }',
    '  else                  { albedo = vec3(0.038, 0.045, 0.056); }',           // rug

    '  vec3 lit = vec3(0.0);',

    // --- recessed downlights: point sources with a soft cone ---
    '  for (int i = 0; i < 6; i++) {',
    '    if (uDown[i] > 0.003) {',
    '      vec3 dv = vPos - uDownPos[i];',
    '      float d = length(dv); vec3 L = dv / max(d, 0.001);',
    '      float cone = smoothstep(0.32, 0.86, dot(L, vec3(0.0, -1.0, 0.0)));',
    '      float dif = max(dot(N, -L), 0.0);',
    '      lit += WHITE * uDown[i] * dif * cone * att(d, 0.16) * 2.3;',
    '    }',
    '  }',

    // --- cove: a soft wash spilling down the walls from the ceiling line ---
    '  if (uCove > 0.003) {',
    '    float fall = smoothstep(-0.4, 2.9, vPos.y);',
    '    float up   = clamp(dot(N, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.62, 0.0, 1.0);',
    '    float nearW = smoothstep(2.1, 4.0, max(abs(vPos.x), abs(vPos.z + 2.2) * 0.55));',
    '    lit += mix(CYAN, WHITE, 0.30) * uCove * fall * up * (0.30 + 0.70 * nearW) * 0.85;',
    '  }',

    // --- floor lamp: a warmthless cool point light, close range ---
    '  if (uAccent > 0.003) {',
    '    vec3 dv = vPos - uLampPos; float d = length(dv); vec3 L = dv / max(d, 0.001);',
    '    lit += WHITE * uAccent * max(dot(N, -L), 0.0) * att(d, 0.20) * 2.0;',
    '  }',

    // --- daylight through the window: broad, directional, from -z ---
    '  if (uDay > 0.003) {',
    '    vec3 wdir = normalize(vec3(0.0, -0.16, 1.0));',
    '    float sh = smoothstep(-6.9, -1.0, vPos.z);',       // falls off deeper into the room
    '    lit += mix(SOFT, WHITE, 0.35) * uDay * max(dot(N, -wdir), 0.0) * mix(1.0, 0.28, sh) * 1.25;',
    '  }',

    // --- wall panel throws a small local glow ---
    '  if (uPanel > 0.003) {',
    '    vec3 dv = vPos - uPanelPos; float d = length(dv);',
    '    lit += CYAN * uPanel * att(d, 1.4) * 0.5;',
    '  }',

    // --- a whisper of ambient bounce so silhouettes exist in shadow ---
    '  lit += mix(CYAN, WHITE, 0.5) * (0.030 + 0.055 * uDay + 0.030 * uCove);',

    '  vec3 col = albedo * lit * 9.0 + emisC * emis;',

    // A grazing sheen on the floor picks up the lights without a reflection pass.
    '  if (rough < 0.7) {',
    '    float fres = pow(1.0 - max(dot(N, Vv), 0.0), 3.4);',
    '    col += mix(CYAN, WHITE, 0.45) * fres * (0.020 + 0.075 * (uCove + uDay * 0.5));',
    '  }',

    '  col = max(col, vec3(0.0));',

    // Distance haze settles the far end of the room into the page ground.
    '  float dist = length(vPos - uEye);',
    '  col *= exp(-max(dist - 3.2, 0.0) * 0.052);',

    // Keep the middle of the viewport quieter — that is where copy sits.
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  float cx = abs(uv.x - 0.5) * 2.0, cy = abs(uv.y - 0.5) * 2.0;',
    '  float centre = clamp(sqrt(cx * cx * 0.72 + cy * cy * 1.10), 0.0, 1.0);',
    '  col *= mix(0.42, 1.0, smoothstep(0.10, 0.95, centre));',

    '  col *= uFade;',
    // Black = "no change" once screened over the page. Never negative.
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (window.console && console.warn) console.warn('[nexoraa-bg] shader:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VS);
  var fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { legacyAmbient(); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    if (window.console && console.warn) console.warn('[nexoraa-bg] link:', gl.getProgramInfoLog(prog));
    legacyAmbient(); return;
  }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, VERTS, gl.STATIC_DRAW);

  var STRIDE = 9 * 4;
  function attr(name, size, off) {
    var loc = gl.getAttribLocation(prog, name);
    if (loc < 0) return;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE, off);
  }
  attr('aPos', 3, 0); attr('aNormal', 3, 12); attr('aUV', 2, 24); attr('aMat', 1, 32);

  var U = {};
  ['uProj', 'uView', 'uTime', 'uCurtainL', 'uCurtainR', 'uCurtGeom', 'uEye',
   'uCove', 'uAccent', 'uDay', 'uPanel', 'uLampPos', 'uPanelPos', 'uRes', 'uFade'
  ].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
  U.uDownPos = gl.getUniformLocation(prog, 'uDownPos[0]');
  U.uDown = gl.getUniformLocation(prog, 'uDown[0]');

  var downPos = new Float32Array(18);
  DOWN.forEach(function (d, i) { downPos[i * 3] = d[0]; downPos[i * 3 + 1] = d[1]; downPos[i * 3 + 2] = d[2]; });
  gl.uniform3fv(U.uDownPos, downPos);
  gl.uniform3f(U.uLampPos, LAMP[0], LAMP[1], LAMP[2]);
  gl.uniform3f(U.uPanelPos, PANEL[0], PANEL[1], PANEL[2]);
  gl.uniform4f(U.uCurtGeom, 3.72, RM.curtZ, 0.52, 3.80);

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  // No culling. The camera stands inside a closed shell, the curtains are
  // genuinely two-sided, and the fragment shader turns every normal to face
  // the viewer — so triangle winding carries no meaning here, and culling
  // would only risk erasing a wall. ~200 triangles; the saving is noise.
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 1);

  // Set from JS on purpose: the stylesheet stays untouched, and this is what
  // makes the layer additive-only over the existing background.
  canvas.style.mixBlendMode = 'screen';

  /* ============================================================
     4. Matrices
     ============================================================ */
  var proj = new Float32Array(16), view = new Float32Array(16);

  function perspective(o, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
    o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
    o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
    o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
  }
  function lookAt(o, e, c, up) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    var zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
    var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    var xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xy /= xl; xz /= xl;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0;
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2]);
    o[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
    o[14] = -(zx * e[0] + zy * e[1] + zz * e[2]);
    o[15] = 1;
  }

  /* ============================================================
     5. The lighting programme.

        Four states on a slow loop. Each channel eases independently
        and the six downlights are staggered, so zones of the room
        come up at slightly different moments rather than together.
        One full cycle is a little over three minutes.
     ============================================================ */
  var CYCLE = 196;   // seconds
  var KEYS = [
    /* residential calm  */ { cove: 0.34, down: 0.10, accent: 0.55, day: 0.10, panel: 0.55 },
    /* the house wakes   */ { cove: 0.58, down: 0.82, accent: 0.34, day: 0.16, panel: 0.75 },
    /* daylight          */ { cove: 0.12, down: 0.14, accent: 0.05, day: 1.00, panel: 0.45 },
    /* evening settle    */ { cove: 0.48, down: 0.30, accent: 0.72, day: 0.26, panel: 0.62 }
  ];
  var CH = ['cove', 'down', 'accent', 'day', 'panel'];
  var sm = function (t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

  // Sampling with a per-channel phase offset is what makes the room
  // change in stages instead of dissolving all at once.
  function channelAt(name, t, offset) {
    var n = KEYS.length;
    var f = ((t / CYCLE + (offset || 0)) % 1 + 1) % 1 * n;
    var i = Math.floor(f);
    var k = sm((f - i - 0.30) / 0.40);          // hold, then a slow crossfade
    return KEYS[i % n][name] + (KEYS[(i + 1) % n][name] - KEYS[i % n][name]) * k;
  }

  var downVals = new Float32Array(6);

  // Curtains: open, hold, close, hold — on their own, much slower clock.
  // A real motorised track runs about 10–20 cm/s, so a 3.8 m panel takes the
  // better part of half a minute to traverse. Matching that is what keeps the
  // movement believable and, deliberately, easy to miss at first glance.
  var CURTAIN_CYCLE = 240;   // seconds
  function curtainAt(t, offset) {
    var p = ((t / CURTAIN_CYCLE + offset) % 1 + 1) % 1;
    if (p < 0.117) return 1.0 - sm(p / 0.117);          // draw open   (~28 s)
    if (p < 0.420) return 0.0;                          // stay open   (~73 s)
    if (p < 0.550) return sm((p - 0.420) / 0.130);      // draw closed (~31 s)
    return 1.0;                                         // stay closed (~108 s)
  }

  /* ============================================================
     6. Camera — slow drift, with restrained pointer parallax.
     ============================================================ */
  var ptr = { x: 0, y: 0, tx: 0, ty: 0, seen: false };
  if (!COARSE) {
    window.addEventListener('pointermove', function (e) {
      ptr.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ptr.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      ptr.seen = true;
    }, { passive: true });
  }

  /* ============================================================
     7. Sizing, adaptive resolution, and the loop
     ============================================================ */
  var scale = COARSE ? 0.50 : 0.62;
  var MIN_SCALE = 0.34;
  var vw = 0, vh = 0;

  function resize() {
    vw = window.innerWidth; vh = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(2, Math.round(vw * dpr * scale));
    var h = Math.max(2, Math.round(vh * dpr * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uRes, w, h);
  }

  var fade = 0;                 // progressive fade-in, so nothing pops on load
  var t0 = 0, last = 0, running = true;
  var frames = 0, acc = 0, checked = 0;

  function draw(nowMs) {
    if (!t0) t0 = nowMs;
    var t = REDUCED ? 42 : (nowMs - t0) / 1000;

    var dt = last ? Math.min((nowMs - last) / 1000, 0.1) : 0.016;
    last = nowMs;

    // Adaptive resolution: if we are consistently slow, render smaller.
    if (!REDUCED && checked < 3) {
      acc += dt; frames++;
      if (frames >= 70) {
        var avg = acc / frames;
        if (avg > 0.026 && scale > MIN_SCALE) { scale = Math.max(MIN_SCALE, scale * 0.78); resize(); }
        frames = 0; acc = 0; checked++;
      }
    }

    fade = Math.min(1, fade + dt * 0.5);

    // camera
    var px = ptr.x, py = ptr.y;
    ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 1.6);
    ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 1.6);
    if (REDUCED) { px = 0; py = 0; ptr.x = 0; ptr.y = 0; }

    var drift = REDUCED ? 0 : 1;
    var eye = [
      Math.sin(t * 0.031) * 0.62 * drift + ptr.x * 0.40,
      1.56 + Math.sin(t * 0.019 + 1.1) * 0.10 * drift - ptr.y * 0.16,
      1.62 + Math.sin(t * 0.012 + 0.4) * 0.62 * drift
    ];
    var tgt = [
      Math.sin(t * 0.023 + 2.0) * 0.42 * drift + ptr.x * 0.20,
      1.36 + Math.sin(t * 0.017) * 0.07 * drift - ptr.y * 0.07,
      RM.z0
    ];

    var aspect = (vw || 1) / (vh || 1);
    var fov = (aspect < 0.85 ? 62 : 47) * Math.PI / 180;
    perspective(proj, fov, aspect, 0.1, 40);
    lookAt(view, eye, tgt, [0, 1, 0]);

    gl.uniformMatrix4fv(U.uProj, false, proj);
    gl.uniformMatrix4fv(U.uView, false, view);
    gl.uniform3f(U.uEye, eye[0], eye[1], eye[2]);
    gl.uniform1f(U.uTime, t);
    gl.uniform1f(U.uFade, fade);

    // lighting channels
    for (var i = 0; i < 6; i++) {
      // each fixture lags its neighbour a touch — zones, not a single switch
      downVals[i] = channelAt('down', t, -0.014 * i - (i > 2 ? 0.02 : 0));
    }
    gl.uniform1fv(U.uDown, downVals);
    gl.uniform1f(U.uCove, channelAt('cove', t, 0.03));
    gl.uniform1f(U.uAccent, channelAt('accent', t, -0.05));
    gl.uniform1f(U.uDay, channelAt('day', t, 0));
    gl.uniform1f(U.uPanel, channelAt('panel', t, 0.08));

    gl.uniform1f(U.uCurtainL, REDUCED ? 0.28 : curtainAt(t, 0.0));
    gl.uniform1f(U.uCurtainR, REDUCED ? 0.28 : curtainAt(t, 0.012));

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, VERT_COUNT);
  }

  function frame(now) {
    if (!running) return;
    draw(now);
    if (REDUCED && fade >= 1) { running = false; return; }  // one settled frame, then stop
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { running = false; }
    else if (!running && !(REDUCED && fade >= 1)) { running = true; last = 0; requestAnimationFrame(frame); }
  });

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      resize();
      if (!running) { running = true; last = 0; requestAnimationFrame(frame); }
    }, 160);
  }, { passive: true });

  resize();
  requestAnimationFrame(frame);

  /* ============================================================
     8. Fallback — the original ambient engine, unchanged.
        Runs only when WebGL is unavailable, so those visitors see
        exactly the site as it was.
     ============================================================ */
  function legacyAmbient() {
    // A canvas hands out exactly one context type for its lifetime. If we got
    // as far as creating a WebGL context before failing, 2d will be refused —
    // so swap in a fresh element carrying the same id and styling.
    var ctx = null;
    try { ctx = canvas.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx && canvas.parentNode) {
      var fresh = canvas.cloneNode(false);
      canvas.parentNode.replaceChild(fresh, canvas);
      canvas = fresh;
      try { ctx = canvas.getContext('2d'); } catch (e2) { ctx = null; }
    }
    if (!ctx) return;
    canvas.style.mixBlendMode = '';   // back to exactly the original behaviour

    var width = 0, height = 0;
    var dpr = window.devicePixelRatio || 1;
    var mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    window.addEventListener('mousemove', function (e) {
      mouse.targetX = (e.clientX - width / 2) * 0.012;
      mouse.targetY = (e.clientY - height / 2) * 0.012;
    }, { passive: true });

    var nodes = [], particles = [];
    var MAX_NODES = 24, MAX_PARTICLES = 28;

    function initNodes() {
      nodes = []; particles = [];
      for (var i = 0; i < MAX_NODES; i++) {
        nodes.push({
          x: Math.random() * width, y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
          radius: 1.5 + Math.random() * 1.2,
          pulseAngle: Math.random() * Math.PI * 2,
          pulseSpeed: 0.015 + Math.random() * 0.02,
          opacity: 0.04 + Math.random() * 0.03
        });
      }
      for (var j = 0; j < MAX_PARTICLES; j++) {
        particles.push({
          x: Math.random() * width, y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.15, vy: -0.1 - Math.random() * 0.18,
          radius: 0.8 + Math.random() * 1.2,
          opacity: 0.03 + Math.random() * 0.03
        });
      }
    }

    function resize2() {
      width = window.innerWidth; height = window.innerHeight;
      canvas.width = width * dpr; canvas.height = height * dpr;
      canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      initNodes();
    }

    function render() {
      ctx.clearRect(0, 0, width, height);
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;
      ctx.save();
      ctx.translate(mouse.x, mouse.y);

      for (var i = 0; i < nodes.length; i++) {
        var n1 = nodes[i];
        for (var j = i + 1; j < nodes.length; j++) {
          var n2 = nodes[j];
          var dx = n2.x - n1.x, dy = n2.y - n1.y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 190) {
            ctx.beginPath();
            ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y);
            ctx.strokeStyle = 'rgba(0, 224, 255, ' + ((1 - dist / 190) * 0.045) + ')';
            ctx.lineWidth = 0.8; ctx.stroke();
          }
        }
      }
      for (var k = 0; k < nodes.length; k++) {
        var node = nodes[k];
        node.x += node.vx; node.y += node.vy;
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;
        node.pulseAngle += node.pulseSpeed;
        var pulse = Math.sin(node.pulseAngle) * 0.02 + node.opacity;
        ctx.beginPath(); ctx.arc(node.x, node.y, node.radius * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 224, 255, ' + (pulse * 0.35) + ')'; ctx.fill();
        ctx.beginPath(); ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 224, 255, ' + pulse + ')'; ctx.fill();
      }
      for (var p = 0; p < particles.length; p++) {
        var pt = particles[p];
        pt.x += pt.vx; pt.y += pt.vy;
        if (pt.y < -10) pt.y = height + 10;
        if (pt.x < -10) pt.x = width + 10;
        if (pt.x > width + 10) pt.x = -10;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + pt.opacity + ')'; ctx.fill();
      }
      ctx.restore();
      requestAnimationFrame(render);
    }

    window.addEventListener('resize', resize2);
    resize2();
    requestAnimationFrame(render);
  }
})();
