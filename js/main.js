/* ============================================================
   NEXORAA — Interactive Core Engine & Layered Smart Room Motion
   ============================================================ */

(function () {
  'use strict';

  var PHONE = '8133942204';
  var WA = '918133942204';
  var MAIL = 'chirag@nexorahomesolution.com';

  /* ---------- Nav & Header Scroll ---------- */
  var hdr = document.getElementById('hdr');
  var mobileToggle = document.getElementById('mobile-toggle');
  var navLinks = document.getElementById('nav-links');

  window.addEventListener('scroll', function () {
    if (!hdr) return;
    if (window.scrollY > 20) {
      hdr.classList.add('stuck');
    } else {
      hdr.classList.remove('stuck');
    }
  });

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', function () {
      navLinks.classList.toggle('active');
      var isExpanded = navLinks.classList.contains('active');
      mobileToggle.setAttribute('aria-expanded', isExpanded);
    });
  }

  // Highlight active menu link based on URL
  var currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(function (link) {
    var href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  /* ---------- Scroll Reveal Animations ---------- */
  var observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.12
  };

  var revealObserver = new IntersectionObserver(function (entries, observer) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal-up').forEach(function (el) {
    revealObserver.observe(el);
  });  /* ============================================================================
     NEXORAA — Reference Lighting Engine & Hero Room Cutaway System
     ========================================================================= */

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var NS = 'http://www.w3.org/2000/svg';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sm(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }

  function el(tag, attrs) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function pts(arr) { return arr.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }

  /* --- A. Kelvin → Colour --------------------------------------------------- */
  function kelvin(k) {
    var t = clamp(k, 2400, 6000) / 100;
    var r, g, b;
    if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
    else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
    if (t >= 66) b = 255;
    else if (t <= 19) b = 0;
    else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
  }

  var WHITE_POINT = kelvin(3400);
  function tintOf(k) {
    var c = kelvin(k);
    var t = [c[0] / WHITE_POINT[0], c[1] / WHITE_POINT[1], c[2] / WHITE_POINT[2]];
    var m = Math.max(t[0], t[1], t[2]);
    return [t[0] / m * 255, t[1] / m * 255, t[2] / m * 255];
  }
  var COOL = tintOf(6500);
  var BRAND_BG = [5, 7, 10]; // #05070A

  function palette(k, lvl) {
    var g = tintOf(k);
    return {
      '--deep': mix(BRAND_BG, g, 0.012 + lvl * 0.020),
      '--bg': mix(BRAND_BG, g, 0.035 + lvl * 0.055),
      '--glow': g,
      '--spec': mix([255, 255, 255], g, 0.32)
    };
  }

  /* --- B. State ------------------------------------------------------------- */
  var CH = ['k', 'lvl', 'cove', 'down', 'lamp', 'path', 'screen', 'shades', 'day', 'hour'];
  var CUR = { k: 2700, lvl: .45, cove: .55, down: .25, lamp: .75, path: .10, screen: 0, shades: 1, day: .04, hour: 19.5 };
  var TGT = Object.assign({}, CUR);

  var SCENES = {
    wake: { label: 'Wake', k: 3000, lvl: .50, cove: .25, down: .10, lamp: .10, path: .10, screen: 0, shades: .20, day: .75, hour: 7.0 },
    day: { label: 'Day', k: 6000, lvl: .88, cove: .08, down: .12, lamp: 0, path: 0, screen: 0, shades: 0, day: 1, hour: 12 },
    work: { label: 'Work', k: 4300, lvl: .78, cove: .45, down: .88, lamp: .30, path: 0, screen: 0, shades: .55, day: .70, hour: 15 },
    evening: { label: 'Evening', k: 2700, lvl: .45, cove: .55, down: .25, lamp: .75, path: .10, screen: 0, shades: 1, day: .04, hour: 19.5 },
    cinema: { label: 'Cinema', k: 2400, lvl: .13, cove: .06, down: 0, lamp: .04, path: .14, screen: 1, shades: 1, day: 0, hour: 21 },
    night: { label: 'Night', k: 2400, lvl: .07, cove: 0, down: 0, lamp: 0, path: .18, screen: 0, shades: 1, day: 0, hour: 23.5 },
    away: { label: 'Away', k: 4000, lvl: .22, cove: .12, down: .08, lamp: .24, path: 0, screen: 0, shades: .5, day: .12, hour: 20.5 }
  };

  var sceneKey = 'evening';
  var dirty = true, last = 0;
  var wake = function () { dirty = true; };

  function setScene(key) {
    var s = SCENES[key];
    if (!s) return;
    sceneKey = key;
    for (var i = 0; i < CH.length; i++) {
      var c = CH[i];
      if (c in s) TGT[c] = s[c];
    }
    syncButtons();
    wake();
  }

  function syncButtons() {
    var radio = document.querySelector('#keypad input[value="' + sceneKey + '"]');
    document.querySelectorAll('#keypad input[name="scene"]').forEach(function (r) { r.checked = (r === radio); });
    document.querySelectorAll('#keypad .scene-stop').forEach(function (stop) {
      var inp = stop.querySelector('input');
      stop.classList.toggle('active', inp && inp.value === sceneKey);
    });
    var hudScene = document.getElementById('hudScene');
    if (hudScene) hudScene.textContent = sceneKey ? SCENES[sceneKey].label : 'Auto';
  }

  /* --- B2. Pointer Light Engine (Reference math, +10% brightness) ---------- */
  var dir = { x: -0.34, y: -0.58, tx: -0.34, ty: -0.58, idle: 0, auto: 0 };
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    dir.tx = clamp((e.clientX / window.innerWidth - 0.5) * 2.1, -1, 1);
    dir.ty = clamp((e.clientY / window.innerHeight - 0.5) * 2.1, -1, 1);
    dir.idle = 0;
    wake();
  }, { passive: true });

  function advance(dt) {
    var k = 1 - Math.pow(0.004, dt / 1000);
    for (var i = 0; i < CH.length; i++) {
      var c = CH[i];
      var d = TGT[c] - CUR[c];
      if (Math.abs(d) > (c === 'k' ? 0.4 : 0.0004)) { CUR[c] += d * k; wake(); }
      else CUR[c] = TGT[c];
    }
    dir.idle += dt;
    if (dir.idle > 2800 && !REDUCED) {
      dir.auto += dt / 8000;
      dir.tx = Math.cos(dir.auto) * 0.72;
      dir.ty = -0.30 + Math.sin(dir.auto * 1.3) * 0.44;
      wake();
    }
    var kd = 1 - Math.pow(0.0016, dt / 1000);
    dir.x += (dir.tx - dir.x) * kd;
    dir.y += (dir.ty - dir.y) * kd;
    if (Math.abs(dir.tx - dir.x) > 0.0005 || Math.abs(dir.ty - dir.y) > 0.0005) wake();
  }

  function writeVars() {
    var s = document.documentElement.style;
    var p = palette(CUR.k, CUR.lvl);
    for (var v in p) s.setProperty(v, rgb(p[v]));
    s.setProperty('--lx', dir.x.toFixed(3));
    s.setProperty('--ly', dir.y.toFixed(3));
    s.setProperty('--lxp', (50 + dir.x * 44).toFixed(1) + '%');
    s.setProperty('--lyp', (50 + dir.y * 44).toFixed(1) + '%');
  }

  /* --- C. SVG Room Cutaway Renderer --------------------------------------- */
  var FRONT = { x0: 30, x1: 870, y0: 40, y1: 500 };
  var BACK = { x0: 240, x1: 660, y0: 160, y1: 390 };

  var floorPt = function (u, v) {
    var fx = FRONT.x0 + u * (FRONT.x1 - FRONT.x0), bx = BACK.x0 + u * (BACK.x1 - BACK.x0);
    return [fx + (bx - fx) * v, FRONT.y1 + (BACK.y1 - FRONT.y1) * v];
  };
  var ceilPt = function (u, v) {
    var fx = FRONT.x0 + u * (FRONT.x1 - FRONT.x0), bx = BACK.x0 + u * (BACK.x1 - BACK.x0);
    return [fx + (bx - fx) * v, FRONT.y0 + (BACK.y0 - FRONT.y0) * v];
  };
  var depth = function (v) { return 1 - v * 0.5; };
  var rightPt = function (t, h) {
    var fy = FRONT.y0 + h * (FRONT.y1 - FRONT.y0), by = BACK.y0 + h * (BACK.y1 - BACK.y0);
    return [FRONT.x1 + (BACK.x1 - FRONT.x1) * t, fy + (by - fy) * t];
  };

  var DOWNS = [0.15, 0.37, 0.63, 0.85].map(function (u) { return { u: u, v: 0.52 }; });
  var LAMP = { u: 0.09, v: 0.36, h: 190, r: 30 };
  var WIN = { t0: 0.22, t1: 0.80, h0: 0.16, h1: 0.70 };
  var SCREEN = { x0: 298, y0: 192, x1: 602, y1: 363 };

  var room = document.getElementById('room');
  var R = {};

  function buildRoom() {
    if (!room) return;
    room.innerHTML = '';

    var defs = el('defs', {});
    var grad = function (id, stops, radial, attrs) {
      var g = el(radial ? 'radialGradient' : 'linearGradient', Object.assign({ id: id }, attrs || {}));
      for (var i = 0; i < stops.length; i++) {
        var s = stops[i];
        var st = el('stop', { offset: s[0] });
        st.style.stopColor = s[1];
        st.style.stopOpacity = s[2];
        g.appendChild(st);
      }
      defs.appendChild(g);
    };

    grad('gCone', [['0', 'var(--glow)', .55], ['1', 'var(--glow)', 0]], false, { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad('gPool', [['0', 'var(--glow)', .95], ['.55', 'var(--glow)', .35], ['1', 'var(--glow)', 0]], true);
    grad('gWash', [['0', 'var(--glow)', .60], ['1', 'var(--glow)', 0]], false, { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad('gUp', [['0', 'var(--glow)', 0], ['1', 'var(--glow)', .5]], false, { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad('gScreen', [['0', 'var(--cool)', .95], ['1', 'var(--cool)', .55]], false, { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad('gScrGlow', [['0', 'var(--cool)', .48], ['1', 'var(--cool)', 0]], false, { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad('gScrPool', [['0', 'var(--cool)', .55], ['1', 'var(--cool)', 0]], true);
    grad('gSky', [['0', 'var(--cool)', .95], ['1', 'var(--cool)', .35]], false, { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad('gShaft', [['0', 'var(--cool)', .40], ['1', 'var(--cool)', 0]], false, { x1: 1, y1: 0, x2: 0, y2: 1 });
    grad('gPatch', [['0', 'var(--cool)', .70], ['1', 'var(--cool)', 0]], true);

    var soft = el('filter', { id: 'soft', x: '-30%', y: '-30%', width: '160%', height: '160%' });
    soft.appendChild(el('feGaussianBlur', { stdDeviation: 7 }));
    defs.appendChild(soft);
    var softer = el('filter', { id: 'softer', x: '-40%', y: '-40%', width: '180%', height: '180%' });
    softer.appendChild(el('feGaussianBlur', { stdDeviation: 16 }));
    defs.appendChild(softer);
    room.appendChild(defs);

    var add = function (tag, attrs, parent) { const n = el(tag, attrs); (parent || room).appendChild(n); return n; };

    R.ceil = add('polygon', { points: pts([ceilPt(0, 0), ceilPt(1, 0), ceilPt(1, 1), ceilPt(0, 1)]) });
    R.floor = add('polygon', { points: pts([floorPt(0, 0), floorPt(1, 0), floorPt(1, 1), floorPt(0, 1)]) });
    R.wallL = add('polygon', { points: pts([ceilPt(0, 0), ceilPt(0, 1), floorPt(0, 1), floorPt(0, 0)]) });
    R.wallR = add('polygon', { points: pts([ceilPt(1, 0), ceilPt(1, 1), floorPt(1, 1), floorPt(1, 0)]) });
    R.wallB = add('polygon', { points: pts([ceilPt(0, 1), ceilPt(1, 1), floorPt(1, 1), floorPt(0, 1)]) });

    R.washB = add('polygon', { points: R.wallB.getAttribute('points'), fill: 'url(#gWash)' });
    R.washC = add('polygon', { points: R.ceil.getAttribute('points'), fill: 'url(#gUp)' });
    R.coveL = add('polygon', { points: pts([ceilPt(0, .06), ceilPt(0, .98), ceilPt(.06, .98), ceilPt(.06, .06)]), fill: 'var(--glow)' });
    R.coveB = add('rect', { x: BACK.x0, y: BACK.y0 - 3, width: BACK.x1 - BACK.x0, height: 3, fill: 'var(--spec)' });
    R.coveGrp = add('g', { filter: 'url(#soft)' });
    R.coveGrp.appendChild(R.coveL);
    R.coveGrp.appendChild(R.coveB);

    R.winSky = add('polygon', { fill: 'url(#gSky)' });
    R.winFrame = add('polygon', { fill: 'none', 'stroke-width': 2 });
    R.shade = add('polygon', {});
    R.shaft = add('polygon', { fill: 'url(#gShaft)' });
    R.patch = add('polygon', { fill: 'url(#gPatch)', filter: 'url(#soft)' });

    R.scrGlow = add('polygon', {
      points: pts([[SCREEN.x0, SCREEN.y1], [SCREEN.x1, SCREEN.y1], [790, 500], [110, 500]]),
      fill: 'url(#gScrGlow)', filter: 'url(#softer)'
    });
    R.scrPool = add('ellipse', { cx: (SCREEN.x0 + SCREEN.x1) / 2, cy: 470, rx: 330, ry: 46, fill: 'url(#gScrPool)', filter: 'url(#soft)' });
    R.scrBezel = add('rect', {
      x: SCREEN.x0 - 3,
      y: SCREEN.y0 - 3,
      width: (SCREEN.x1 - SCREEN.x0) + 6,
      height: (SCREEN.y1 - SCREEN.y0) + 6,
      rx: 2,
      fill: 'none',
      stroke: 'rgba(255, 255, 255, 0.15)',
      'stroke-width': 1.5
    });
    R.scrBody = add('rect', { x: SCREEN.x0, y: SCREEN.y0, width: SCREEN.x1 - SCREEN.x0, height: SCREEN.y1 - SCREEN.y0 });
    R.scrLit = add('rect', { x: SCREEN.x0, y: SCREEN.y0, width: SCREEN.x1 - SCREEN.x0, height: SCREEN.y1 - SCREEN.y0, fill: 'url(#gScreen)' });
    R.scrLogo = add('text', {
      x: (SCREEN.x0 + SCREEN.x1) / 2,
      y: (SCREEN.y0 + SCREEN.y1) / 2 + 5,
      'text-anchor': 'middle',
      fill: 'var(--cyan)',
      'font-family': 'var(--display)',
      'font-size': '15px',
      'font-weight': '400',
      'letter-spacing': '5px',
      filter: 'drop-shadow(0 0 6px var(--cyan-glow))'
    });
    R.scrLogo.textContent = 'NEXORAA';

    var junction = pts([floorPt(0, 0), floorPt(0, 1), floorPt(1, 1), floorPt(1, 0)]);
    R.pathWash = add('polyline', { points: junction, fill: 'none', stroke: 'var(--glow)', 'stroke-width': 16, filter: 'url(#soft)' });
    R.pathLine = add('polyline', { points: junction, fill: 'none', stroke: 'var(--spec)', 'stroke-width': 1.6 });

    R.downs = DOWNS.map(function (d) {
      var c = ceilPt(d.u, d.v), f = floorPt(d.u, d.v);
      var r = 74 * depth(d.v);
      var g = el('g', {});
      var cone = el('polygon', { points: pts([[c[0] - 7, c[1]], [c[0] + 7, c[1]], [f[0] + r, f[1]], [f[0] - r, f[1]]]), fill: 'url(#gCone)' });
      var pool = el('ellipse', { cx: f[0], cy: f[1], rx: r, ry: r * 0.30, fill: 'url(#gPool)', filter: 'url(#soft)' });
      g.appendChild(pool); g.appendChild(cone);
      room.appendChild(g);
      var trim = el('rect', { x: c[0] - 8, y: c[1] - 2, width: 16, height: 3.5, fill: 'var(--accent-lo)' });
      room.appendChild(trim);
      var lamp = el('rect', { x: c[0] - 6, y: c[1] - 1, width: 12, height: 2, fill: 'var(--spec)' });
      room.appendChild(lamp);
      return { g: g, lamp: lamp };
    });

    var lb = floorPt(LAMP.u, LAMP.v);
    var lh = LAMP.h * depth(LAMP.v), lr = LAMP.r * depth(LAMP.v);
    var top = [lb[0], lb[1] - lh];
    R.lampG = el('g', {});
    R.lampG.appendChild(el('ellipse', { cx: lb[0], cy: lb[1], rx: lr * 3.4, ry: lr * 1.05, fill: 'url(#gPool)', filter: 'url(#soft)' }));
    R.lampG.appendChild(el('polygon', { points: pts([[top[0] - lr, top[1] + 6], [top[0] + lr, top[1] + 6], [lb[0] + lr * 3, lb[1]], [lb[0] - lr * 3, lb[1]]]), fill: 'url(#gCone)' }));
    var lampCeil = ceilPt(LAMP.u, LAMP.v)[1];
    R.lampG.appendChild(el('polygon', { points: pts([[top[0] - lr * 2.6, lampCeil], [top[0] + lr * 2.6, lampCeil], [top[0] + lr, top[1] - 4], [top[0] - lr, top[1] - 4]]), fill: 'url(#gUp)' }));
    room.appendChild(R.lampG);
    R.lampStem = add('line', { x1: lb[0], y1: lb[1], x2: top[0], y2: top[1], 'stroke-width': 2 });
    R.lampShade = add('polygon', { points: pts([[top[0] - lr * .78, top[1] - 18], [top[0] + lr * .78, top[1] - 18], [top[0] + lr, top[1] + 8], [top[0] - lr, top[1] + 8]]) });

    var box = function (u0, u1, v0, v1, hi, lo) {
      var s0 = depth(v0), s1 = depth(v1);
      var fl = floorPt(u0, v0), fr = floorPt(u1, v0), bl = floorPt(u0, v1), br = floorPt(u1, v1);
      var t = [[fl[0], fl[1] - hi * s0], [fr[0], fr[1] - hi * s0], [br[0], br[1] - hi * s1], [bl[0], bl[1] - hi * s1]];
      var f = [[fl[0], fl[1] - (lo || 0) * s0], [fr[0], fr[1] - (lo || 0) * s0], t[1], t[0]];
      return { top: t, face: f };
    };
    R.furn = [];
    var solid = function (poly, key) { var n = add('polygon', { points: pts(poly) }); R.furn.push({ n: n, key: key }); return n; };

    var media = box(.34, .66, .92, .99, 46, 0);
    solid(media.top, 'mid'); solid(media.face, 'lo');

    var rug = [floorPt(.22, .05), floorPt(.80, .05), floorPt(.76, .60), floorPt(.26, .60)];
    R.rug = add('polygon', { points: pts(rug) });

    var sofa = box(.30, .72, .30, .52, 78, 0);
    solid(sofa.top, 'hi'); solid(sofa.face, 'lo');
    var seat = box(.32, .70, .18, .34, 36, 0);
    solid(seat.top, 'mid'); solid(seat.face, 'lo');

    var table = box(.44, .62, .06, .17, 26, 0);
    solid(table.top, 'mid'); solid(table.face, 'lo');

    var pb = floorPt(.93, .34), ps = depth(.34);
    solid([[pb[0] - 15 * ps, pb[1]], [pb[0] + 15 * ps, pb[1]], [pb[0] + 11 * ps, pb[1] - 30 * ps], [pb[0] - 11 * ps, pb[1] - 30 * ps]], 'mid');
    R.leaf = add('path', {
      d: 'M ' + pb[0] + ' ' + (pb[1] - 30 * ps) +
        ' c -34 -14 -46 -52 -20 -74 m 20 74 c 30 -10 44 -46 26 -72 m -26 72 c -8 -22 -2 -52 12 -66',
      fill: 'none', 'stroke-width': 2
    });

    var hud = add('g', { opacity: .5 });
    for (var i = 0; i <= 8; i++) {
      var x = 30 + i * 105;
      hud.appendChild(el('line', { x1: x, y1: 536, x2: x, y2: i % 2 ? 542 : 546, stroke: 'var(--accent)', 'stroke-width': 1 }));
    }
    hud.appendChild(el('line', { x1: 30, y1: 536, x2: 870, y2: 536, stroke: 'var(--accent)', 'stroke-width': 1, opacity: .5 }));
    var dim = el('text', { class: 'hudt', x: 30, y: 528 });
    dim.textContent = '6.40 M';
    hud.appendChild(dim);
  }

  function drawRoom(ts) {
    if (!R.ceil) return;
    var g = tintOf(CUR.k), lvl = CUR.lvl;
    var base = BRAND_BG;
    var surf = function (amount) { return rgb(mix(base, g, amount * (0.10 + lvl * 0.55))); };

    R.ceil.setAttribute('fill', surf(0.30));
    R.floor.setAttribute('fill', surf(0.22));
    R.wallB.setAttribute('fill', surf(0.40));
    R.wallL.setAttribute('fill', surf(0.26));
    R.wallR.setAttribute('fill', surf(0.34));

    R.washB.setAttribute('opacity', (CUR.cove * 0.85).toFixed(3));
    R.washC.setAttribute('opacity', (CUR.cove * 0.55).toFixed(3));
    R.coveGrp.setAttribute('opacity', (CUR.cove * 0.9).toFixed(3));

    for (var i = 0; i < R.downs.length; i++) {
      var d = R.downs[i];
      d.g.setAttribute('opacity', CUR.down.toFixed(3));
      d.lamp.setAttribute('opacity', (0.12 + CUR.down * 0.88).toFixed(3));
    }

    R.lampG.setAttribute('opacity', CUR.lamp.toFixed(3));
    R.lampStem.setAttribute('stroke', rgb(mix(base, g, 0.20 + lvl * 0.3)));
    R.lampShade.setAttribute('fill', rgb(mix(base, g, 0.14 + CUR.lamp * 0.75)));

    R.pathWash.setAttribute('opacity', (CUR.path * 0.55).toFixed(3));
    R.pathLine.setAttribute('opacity', (CUR.path * 1.6 > 1 ? 1 : CUR.path * 1.6).toFixed(3));

    var flick = REDUCED ? 1 : 1 + 0.16 * (Math.sin(ts * 0.00042) + 0.55 * Math.sin(ts * 0.00131));
    var sc = clamp(CUR.screen * flick, 0, 1.2);
    if (R.scrBezel) R.scrBezel.setAttribute('stroke', rgb(mix(base, g, 0.16 + lvl * 0.28)));
    R.scrBody.setAttribute('fill', rgb(mix(base, g, 0.05 + lvl * 0.08)));
    R.scrLit.setAttribute('opacity', (sc * 0.92).toFixed(3));
    R.scrGlow.setAttribute('opacity', (sc * 0.85).toFixed(3));
    R.scrPool.setAttribute('opacity', (sc * 0.7).toFixed(3));
    if (R.scrLogo) R.scrLogo.setAttribute('opacity', (sc * 0.95).toFixed(3));

    var hTop = WIN.h0 + CUR.shades * (WIN.h1 - WIN.h0);
    var A = rightPt(WIN.t0, hTop), B = rightPt(WIN.t1, hTop),
      C = rightPt(WIN.t1, WIN.h1), D = rightPt(WIN.t0, WIN.h1);
    var full = [rightPt(WIN.t0, WIN.h0), rightPt(WIN.t1, WIN.h0), C, D];
    R.winFrame.setAttribute('points', pts(full));
    R.winFrame.setAttribute('stroke', rgb(mix(base, g, 0.30 + lvl * 0.4)));

    var openAmt = (1 - CUR.shades);
    var dayContrib = CUR.day * (0.15 + openAmt * 0.85);
    R.winSky.setAttribute('points', pts([A, B, C, D]));
    R.winSky.setAttribute('opacity', (0.05 + dayContrib * 0.95).toFixed(3));
    R.shade.setAttribute('points', pts([full[0], full[1], B, A]));
    R.shade.setAttribute('fill', rgb(mix(base, g, 0.24 + lvl * 0.28)));

    var elev = clamp(0.5 - dir.y * 0.5, 0, 1);
    var L = [-(95 + (1 - elev) * 350), 150 - (1 - elev) * 108 + dir.x * 26];
    var off = function (p) { return [p[0] + L[0], p[1] + L[1]]; };
    R.shaft.setAttribute('points', pts([A, B, off(B), off(C), off(D), off(A)]));
    R.shaft.setAttribute('opacity', (dayContrib * 0.60).toFixed(3));
    R.patch.setAttribute('points', pts([off(A), off(B), off(C), off(D)]));
    R.patch.setAttribute('opacity', (dayContrib * 0.90).toFixed(3));

    R.rug.setAttribute('fill', rgb(mix(base, g, 0.14 + lvl * 0.30)));
    for (var j = 0; j < R.furn.length; j++) {
      var f = R.furn[j];
      var amt = f.key === 'hi' ? 0.26 : f.key === 'mid' ? 0.18 : 0.10;
      f.n.setAttribute('fill', rgb(mix(base, g, amt * (0.5 + lvl * 1.5))));
    }
    R.leaf.setAttribute('stroke', rgb(mix(base, g, 0.16 + lvl * 0.34)));
  }

  /* --- C2. Telemetry Strip Renderer --------------------------------------- */
  var pct = function (v) { return Math.round(v * 100) + '%'; };
  var hhmm = function (h) {
    var t = ((h % 24) + 24) % 24;
    return String(Math.floor(t)).padStart(2, '0') + ':' + String(Math.round((t % 1) * 60) % 60).padStart(2, '0');
  };

  function drawReadout() {
    var rK = document.getElementById('rK');
    var bK = document.getElementById('bK');
    var rCove = document.getElementById('rCove');
    var bCove = document.getElementById('bCove');
    var rDown = document.getElementById('rDown');
    var bDown = document.getElementById('bDown');
    var rLamp = document.getElementById('rLamp');
    var bLamp = document.getElementById('bLamp');
    var rPath = document.getElementById('rPath');
    var bPath = document.getElementById('bPath');
    var rShade = document.getElementById('rShade');
    var bShade = document.getElementById('bShade');
    var hudTime = document.getElementById('hudTime');

    var k = Math.round(CUR.k / 10) * 10;
    if (rK) rK.textContent = k + ' K';
    if (bK) bK.style.width = clamp((CUR.k - 2400) / 3600, 0, 1) * 100 + '%';

    if (rCove) rCove.textContent = pct(CUR.cove);
    if (bCove) bCove.style.width = CUR.cove * 100 + '%';


    if (rDown) rDown.textContent = pct(CUR.down);
    if (bDown) bDown.style.width = CUR.down * 100 + '%';

    if (rLamp) rLamp.textContent = pct(CUR.lamp);
    if (bLamp) bLamp.style.width = CUR.lamp * 100 + '%';

    if (rPath) rPath.textContent = pct(CUR.path);
    if (bPath) bPath.style.width = CUR.path * 100 + '%';

    if (rShade) rShade.textContent = CUR.shades > 0.94 ? 'Closed' : CUR.shades < 0.05 ? 'Open' : pct(1 - CUR.shades) + ' open';
    if (bShade) bShade.style.width = (1 - CUR.shades) * 100 + '%';

    if (hudTime) hudTime.textContent = hhmm(CUR.hour);
  }

  /* --- Scene Keypad Handlers ---------------------------------------------- */
  function initKeypad() {
    var kp = document.getElementById('keypad');
    if (!kp) return;

    kp.querySelectorAll('input[name="scene"]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        if (this.checked) setScene(this.value);
      });
    });

    kp.querySelectorAll('.scene-stop').forEach(function (stop) {
      stop.addEventListener('click', function () {
        var inp = this.querySelector('input');
        if (inp) {
          inp.checked = true;
          setScene(inp.value);
        }
      });
    });

    setScene('evening');
  }

  /* --- E3. Animation Frame Loop ------------------------------------------- */
  function frame(ts) {
    var dt = Math.min(ts - last || 16, 50);
    last = ts;
    advance(dt);
    if (CUR.screen > 0.01 && !REDUCED) wake();
    if (dirty) {
      dirty = false;
      writeVars();
      drawRoom(ts);
      drawReadout();
    }
    requestAnimationFrame(frame);
  }

  // Initialize Reference Lighting Engine
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      buildRoom();
      initKeypad();
      requestAnimationFrame(frame);
    });
  } else {
    buildRoom();
    initKeypad();
    requestAnimationFrame(frame);
  }

})();

