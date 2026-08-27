/* ============================================================
   NEXORAA — Immersive smart-home experience
   ------------------------------------------------------------
   The environment is a REAL PHOTOGRAPH of a completed Nexoraa
   installation, not 3D geometry. Everything the visitor sees is
   the actual room: the actual cove strips, the actual pendant
   cluster, the actual brass lamp, the actual media wall, the
   actual control panel and smart lock on the right-hand door.

   How the room comes alive
   ------------------------
   assets/room/*.webp are not artwork. Each one is real pixels cut
   out of the same photograph by nexora-mock/build-room-layers.mjs,
   keyed on the photograph's own luminance — so a fixture's light
   has exactly the shape that fixture really casts. The base image
   is dimmed to "everything off" and those layers are screened back
   on to switch each circuit on. That is why the lighting reads as
   physically plausible: it is the real light, returning.

   The camera is a crop. Each chapter frames a different part of
   the same room — the ceiling, the window, the media wall, the
   door — so the visitor is moved through one coherent space
   rather than shown a slideshow of unrelated interiors.

   Two layers, deliberately separable:
     1. The narrative layer (chapters, rail, HUD, panel reveals) is
        plain DOM and runs unconditionally.
     2. The room compositor drives transforms and opacities on that
        DOM. If the imagery cannot load, the page falls back to the
        existing gradient and stays a complete, readable site.

   Brand colours are untouched: the photograph keeps its own warm
   interior light because that is what the room really looks like,
   and every piece of UI stays on the Nexoraa palette.
   ============================================================ */

(function () {
  'use strict';

  var doc = document, win = window;
  var REDUCED = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var COARSE = !!(win.matchMedia && win.matchMedia('(pointer: coarse)').matches);

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var sm = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ============================================================
     PART 1 — the narrative layer (unchanged, runs regardless)
     ============================================================ */

  var chapters = [].slice.call(doc.querySelectorAll('[data-cam]'));
  var railLinks = [].slice.call(doc.querySelectorAll('[data-rail]'));
  var hudZone = doc.getElementById('xp-zone');
  var hudState = doc.getElementById('xp-state');
  var progressBar = doc.querySelector('.xp-progress i');

  var CHAPTER_META = [
    { zone: 'Living Room', state: 'Standby' },
    { zone: 'Living Room', state: 'Lighting — scene rising' },
    { zone: 'Living Room', state: 'Shades — opening' },
    { zone: 'Media Wall', state: 'Cinema — engaged' },
    { zone: 'Entrance', state: 'Access — verifying' },
    { zone: 'Whole Home', state: 'All systems active' }
  ];

  var camProgress = 0, camTarget = 0, activeChapter = -1;

  /* --- geometry cache.

     Chapter positions only move when the page is laid out, so they are read
     once here and never again. Doing it per scroll event — six
     getBoundingClientRect() calls plus two scrollHeight reads — forced a
     synchronous layout of the whole document on every wheel tick, which is
     the single most expensive thing this file used to do. */
  var geo = { mids: [], vw: 0, vh: 0, docH: 0 };
  var scrollY = 0, scrollDirty = true;

  function remeasure() {
    var y = win.pageYOffset || doc.documentElement.scrollTop || 0;
    geo.vw = win.innerWidth;
    geo.vh = win.innerHeight;
    geo.mids.length = 0;
    for (var i = 0; i < chapters.length; i++) {
      var el = chapters[i];
      var top = el.getBoundingClientRect().top + y;
      geo.mids.push(top + Math.min(el.offsetHeight, geo.vh) * 0.5);
    }
    geo.docH = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight) - geo.vh;
    scrollY = y;
    scrollDirty = true;
  }

  // Pure arithmetic over the cache — touches no layout at all.
  function measure() {
    var focus = scrollY + geo.vh * 0.5;
    var idx = 0, local = 0, n = geo.mids.length;
    for (var i = 0; i < n; i++) {
      if (focus >= geo.mids[i]) { idx = i; local = 0; }
      else {
        if (i === 0) { idx = 0; local = 0; break; }
        idx = i - 1;
        local = clamp((focus - geo.mids[i - 1]) / Math.max(geo.mids[i] - geo.mids[i - 1], 1), 0, 1);
        break;
      }
    }
    camTarget = clamp(idx + local, 0, Math.max(n - 1, 0));
    setStyle(progressBar, 'height',
      (geo.docH > 0 ? clamp(scrollY / geo.docH, 0, 1) * 100 : 0).toFixed(1) + '%');
    doc.body.classList.toggle('xp-scrolled', scrollY > 40);
  }

  /* Every style write goes through here. The loop recomputes the same value
     many frames running — during a dwell the crop barely moves — and skipping
     an unchanged write avoids the style/layout/paint that would follow it. */
  function setStyle(el, prop, val) {
    if (!el) return;
    var c = el.__nx || (el.__nx = {});
    if (c[prop] === val) return;
    c[prop] = val;
    el.style[prop] = val;
  }

  function paintUI() {
    var near = Math.round(camProgress);
    if (near === activeChapter) return;
    activeChapter = near;
    for (var i = 0; i < chapters.length; i++) chapters[i].classList.toggle('is-active', i === near);
    for (var j = 0; j < railLinks.length; j++) railLinks[j].classList.toggle('is-on', +railLinks[j].dataset.rail === near);
    var meta = CHAPTER_META[near] || CHAPTER_META[0];
    if (hudZone) hudZone.textContent = meta.zone;
    if (hudState) hudState.textContent = meta.state;
  }

  if ('IntersectionObserver' in win) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('is-active'); });
    }, { rootMargin: '0px 0px -22% 0px' });
    chapters.forEach(function (c) { io.observe(c); });
  } else {
    chapters.forEach(function (c) { c.classList.add('is-active'); });
  }

  railLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;
      var t = doc.querySelector(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
    });
  });

  /* The scroll handler now records a number and nothing else. Every read and
     every write happens once per frame inside the loop, so scrolling can never
     interleave layout reads with style writes. */
  win.addEventListener('scroll', function () {
    scrollY = win.pageYOffset || doc.documentElement.scrollTop || 0;
    scrollDirty = true;
  }, { passive: true });

  var reT;
  win.addEventListener('resize', function () {
    clearTimeout(reT);
    reT = setTimeout(remeasure, 150);
  }, { passive: true });
  win.addEventListener('load', remeasure);

  remeasure();
  measure();
  camProgress = camTarget;
  paintUI();

  var bailed = false;
  function bailToFallback() {
    if (bailed) return;
    bailed = true;
    doc.body.classList.add('xp-fallback');
    (function tick() {
      camProgress += (camTarget - camProgress) * 0.12;
      paintUI();
      requestAnimationFrame(tick);
    })();
  }

  /* ============================================================
     PART 2 — the room compositor
     ============================================================ */

  // NOT id="room": js/main.js loads first on this page and does
  //   document.getElementById('room').innerHTML = ''
  // to build the inline SVG room card used on index.html. Naming the
  // background container "room" let main.js wipe the entire layer stack
  // before this file ever ran, which is why the background vanished.
  var stage = doc.getElementById('nx-stage');
  var room = doc.getElementById('nx-room');
  if (!stage || !room) { bailToFallback(); return; }

  var L = {
    base:    doc.querySelector('.rm-base'),
    day:     doc.querySelector('.rm-day'),
    drapeL:  doc.querySelector('.rm-drape--l'),
    drapeR:  doc.querySelector('.rm-drape--r'),
    fg:      doc.querySelector('.rm-fg'),
    dim:     doc.querySelector('.rm-dim'),
    ceiling: doc.querySelector('.rm-ceiling'),
    media:   doc.querySelector('.rm-media'),
    lamp:    doc.querySelector('.rm-lamp'),
    accent:  doc.querySelector('.rm-accent'),
    tv:      doc.querySelector('.rm-tv'),
    lock:    doc.querySelector('.rm-lock'),
    panel:   doc.querySelector('.rm-panel')
  };
  if (!L.base) { bailToFallback(); return; }

  // If the photograph itself cannot load there is nothing to show.
  L.base.addEventListener('error', bailToFallback);
  if (L.base.complete && L.base.naturalWidth === 0) { bailToFallback(); return; }

  /* --- the camera.

     Each stop is a framing of the SAME photograph: a zoom factor and the
     point in the image it centres on, in normalised image coordinates. This
     is what carries the visitor from the ceiling, to the window, to the media
     wall, to the front door, without ever leaving the room they arrived in. */
  var STOPS = [
    { // 01 ENTER — the whole room, at rest, barely lit
      zoom: 1.10, cx: 0.50, cy: 0.52,
      pzoom: 1.05, pcx: 0.545, pcy: 0.550,
      dim: 0.46, ceiling: 0.26, media: 0.16, lamp: 0.55, accent: 0.10,
      tv: 0.30, day: 0.00, drape: 0.55, lockGlow: 0.15, panelGlow: 0.30
    },
    { // 02 LIGHTING — every circuit comes up, cove first
      zoom: 1.34, cx: 0.44, cy: 0.33,
      pzoom: 1.30, pcx: 0.440, pcy: 0.260,
      dim: 0.24, ceiling: 1.00, media: 0.88, lamp: 0.82, accent: 0.92,
      tv: 0.35, day: 0.02, drape: 0.55, lockGlow: 0.20, panelGlow: 0.85
    },
    { // 03 DAYLIGHT — the shades draw back and daylight takes over
      zoom: 1.46, cx: 0.535, cy: 0.42,
      pzoom: 1.10, pcx: 0.532, pcy: 0.450,
      dim: 0.06, ceiling: 0.26, media: 0.16, lamp: 0.08, accent: 0.22,
      tv: 0.25, day: 1.00, drape: 0.00, lockGlow: 0.15, panelGlow: 0.55
    },
    { // 04 CINEMA — shades close, the room drops away, the wall takes over
      zoom: 1.62, cx: 0.215, cy: 0.385,
      pzoom: 1.15, pcx: 0.200, pcy: 0.400,
      dim: 0.76, ceiling: 0.05, media: 0.50, lamp: 0.14, accent: 0.06,
      tv: 1.00, day: 0.00, drape: 1.00, lockGlow: 0.10, panelGlow: 0.35
    },
    { // 05 SECURITY — across to the door: panel, switch plate, smart lock
      zoom: 2.05, cx: 0.862, cy: 0.415,
      pzoom: 1.30, pcx: 0.870, pcy: 0.420,
      dim: 0.30, ceiling: 0.44, media: 0.26, lamp: 0.52, accent: 1.00,
      tv: 0.20, day: 0.08, drape: 0.82, lockGlow: 1.00, panelGlow: 1.00
    },
    { // 06 THE HOME — pull back; everything running at once
      zoom: 1.02, cx: 0.50, cy: 0.50,
      pzoom: 1.02, pcx: 0.500, pcy: 0.500,
      dim: 0.18, ceiling: 0.88, media: 0.72, lamp: 0.72, accent: 0.78,
      tv: 0.55, day: 0.34, drape: 0.34, lockGlow: 0.80, panelGlow: 0.90
    }
  ];

  /* How much of the easing to keep between one chapter and the next.

     A full smoothstep drops the rate of change to exactly zero at every
     boundary, so scrolling at a steady speed made the room surge, stop, surge,
     stop — six chapters, five dead stops. Blending the smoothstep with a
     straight ramp keeps an ease either side of a stop while leaving the
     velocity non-zero as it passes through, which is what makes a continuous
     scroll read as one continuous move. Unlike a spline it cannot overshoot,
     so no channel can exceed its authored value. */
  var EASE = 0.40;

  function at(key, p) {
    var i = Math.floor(p), r = p - i;
    var f = r * (1 - EASE) + sm(r) * EASE;
    var a = STOPS[clamp(i, 0, STOPS.length - 1)];
    var b = STOPS[clamp(i + 1, 0, STOPS.length - 1)];
    return lerp(a[key], b[key], f);
  }

  /* --- pointer parallax, kept restrained --- */
  var ptr = { x: 0, y: 0, tx: 0, ty: 0, cx: -9e9, cy: -9e9 };
  if (!COARSE) {
    win.addEventListener('pointermove', function (e) {
      ptr.tx = (e.clientX / win.innerWidth - 0.5) * 2;
      ptr.ty = (e.clientY / win.innerHeight - 0.5) * 2;
      ptr.cx = e.clientX; ptr.cy = e.clientY;
    }, { passive: true });
  }

  /* --- hotspots: real devices in the photograph the cursor can find.
         Positions are normalised coordinates on the source image. --- */
  var HOT = [
    { el: L.panel, nx: 0.822, ny: 0.330, v: 0, pulse: 0, label: 'Control panel' },
    { el: L.lock, nx: 0.912, ny: 0.455, v: 0, pulse: 0, label: 'Smart lock' },
    { el: L.tv, nx: 0.190, ny: 0.375, v: 0, pulse: 0, label: 'Media wall' }
  ];

  // Where a normalised image point currently sits on screen, given the crop.
  var frame = { scale: 1, ox: 0, oy: 0, w: 0, h: 0 };
  function toScreen(nx, ny, out) {
    out[0] = frame.ox + nx * frame.w;
    out[1] = frame.oy + ny * frame.h;
  }
  var tmp = [0, 0];

  if (!COARSE) {
    win.addEventListener('click', function () {
      var best = null, bestD = 130;
      for (var i = 0; i < HOT.length; i++) {
        toScreen(HOT[i].nx, HOT[i].ny, tmp);
        var d = Math.hypot(tmp[0] - ptr.cx, tmp[1] - ptr.cy);
        if (d < bestD) { bestD = d; best = HOT[i]; }
      }
      if (best) {
        best.pulse = 1;
        if (hudState) hudState.textContent = best.label + ' — engaged';
      }
    }, { passive: true });
  }

  /* --- the loop ---------------------------------------------------------- */
  var IMG_W = 1537, IMG_H = 1023, IMG_AR = IMG_W / IMG_H;
  var last = 0, t0 = 0, running = true, fade = 0, isLive = false, camVel = 0;

  /* A circuit at zero is still a full-frame, screen-blended layer the
     compositor has to blend every frame. Taking it out of the box entirely
     costs nothing visually — it was invisible — and gives the GPU back a
     whole-viewport blend. */
  function setOpacity(el, v) {
    if (!el) return;
    if (v < 0.004) { setStyle(el, 'display', 'none'); return; }
    setStyle(el, 'display', 'block');
    setStyle(el, 'opacity', v.toFixed(3));
  }

  function draw(now) {
    if (!running) return;
    if (!t0) t0 = now;
    var t = (now - t0) / 1000;
    var dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016;
    last = now;

    if (scrollDirty) { measure(); scrollDirty = false; }

    /* Critically damped spring, not a lerp.

       `x += (target - x) * dt * k` is a linear approximation of exponential
       decay: its result depends on how the frame times happen to fall, and it
       steps the velocity the instant the scroll rate changes — which is felt
       as a small jolt at the start and end of every flick. A critically damped
       spring is exact for any dt, carries velocity through rate changes, and
       by construction never overshoots, so the room can never rubber-band. */
    var omega = REDUCED ? 26 : 4.4;
    var expo = Math.exp(-omega * dt);
    var change = camProgress - camTarget;
    var tv = (camVel + omega * change) * dt;
    camVel = (camVel - omega * tv) * expo;
    camProgress = camTarget + (change + tv) * expo;

    paintUI();

    if (fade < 1) {
      fade = Math.min(1, fade + dt * 0.7);
      if (fade > 0.02 && !isLive) { isLive = true; room.classList.add('is-live'); }
    }

    var pk = 1 - Math.pow(0.02, dt);            // frame-rate exact, unlike dt*k
    ptr.x += (ptr.tx - ptr.x) * pk;
    ptr.y += (ptr.ty - ptr.y) * pk;

    var p = camProgress;
    var drift = REDUCED ? 0 : 1;

    /* --- the crop.

       The photograph is sized to COVER the viewport, then scaled up by the
       chapter's zoom and slid so the chapter's focal point sits in the middle
       of the screen. Everything is one transform on one wrapper, so the whole
       move is composited on the GPU. */
    // viewport dimensions come from the cache; reading them off `window` each
    // frame can itself flush pending layout
    var vw = geo.vw, vh = geo.vh;
    var coverScale = Math.max(vw / IMG_W, vh / IMG_H);

    /* A phone is about 9:19.5 and this photograph is 3:2, so covering the
       screen leaves barely a quarter of the room's width visible. Each chapter
       therefore carries a second framing — pzoom/pcx/pcy — that pulls its
       subject into the narrow column a portrait screen actually shows: the cove
       for Lighting, the media wall for Cinema, the door for Security. */
    var portrait = vw / Math.max(vh, 1) < 0.9;
    var zoom = at(portrait ? 'pzoom' : 'zoom', p) * (1 + Math.sin(t * 0.055) * 0.019 * drift);
    var s = coverScale * zoom;
    var w = IMG_W * s, h = IMG_H * s;
    var cx = at(portrait ? 'pcx' : 'cx', p) + ptr.x * 0.018 + Math.sin(t * 0.05) * 0.004 * drift;
    var cy = at(portrait ? 'pcy' : 'cy', p) + ptr.y * 0.012 + Math.sin(t * 0.043 + 1.1) * 0.003 * drift;

    // top-left of the image so that (cx, cy) lands at the viewport centre
    var ox = vw * 0.5 - cx * w;
    var oy = vh * 0.5 - cy * h;

    /* Keep the photograph over the whole viewport. On a tall screen the cover
       scale makes the image barely taller than the screen, so any focal point
       away from centre would slide an edge into view and expose bare ground.
       Clamping the pan to the image bounds means an extreme framing simply
       pins to that edge — which is exactly what the Lighting chapter wants,
       since its subject is the ceiling. */
    ox = clamp(ox, Math.min(vw - w, 0), 0);
    oy = clamp(oy, Math.min(vh - h, 0), 0);

    frame.scale = s; frame.ox = ox; frame.oy = oy; frame.w = w; frame.h = h;

    /* Sub-pixel, deliberately.

       Rounding the stage to whole pixels saved a layout, but the size then
       stepped by a pixel while the transform beside it moved continuously, and
       that mismatch shows up as a shimmer along high-contrast edges. A tenth of
       a pixel is far below anything visible and still lets the coalescer skip
       most frames while the room is only breathing: the breath moves the crop
       about 0.03px per frame, so this writes roughly once every three. During
       an actual scroll it writes every frame, which is exactly when it should. */
    setStyle(stage, 'width', w.toFixed(1) + 'px');
    setStyle(stage, 'height', h.toFixed(1) + 'px');
    setStyle(stage, 'transform',
      'translate3d(' + ox.toFixed(1) + 'px,' + oy.toFixed(1) + 'px,0)');

    /* --- The foreground plate does NOT move.

       It is the sofa and table plant cut out of this very photograph, and the
       base image still contains those same pixels underneath it. Offsetting it
       therefore does not create depth — it draws the sofa twice, a few pixels
       apart, and the doubled edges read as if the furniture were out of focus.
       (Sliding it 26px is exactly what made the sofa look blurred.)

       Real layer parallax would need the sofa painted out of the base first.
       Until there is a plate to do that with, this layer earns its keep purely
       as an occluder: it lets the shades draw the full height of the glass and
       still pass behind the furniture. Depth comes from the camera crop below,
       which moves the whole photograph and so cannot ghost. --- */

    /* --- the circuits.

       Each emissive layer is the real light of one group of fixtures. Raising
       its opacity is, literally, switching that circuit on. --- */
    setOpacity(L.dim, at('dim', p));
    setOpacity(L.ceiling, at('ceiling', p));
    setOpacity(L.media, at('media', p));
    setOpacity(L.lamp, at('lamp', p));
    setOpacity(L.accent, at('accent', p));
    setOpacity(L.day, at('day', p));

    // hover / click response on the real devices
    for (var i = 0; i < HOT.length; i++) {
      var ho = HOT[i], want = 0;
      if (!COARSE) {
        toScreen(ho.nx, ho.ny, tmp);
        want = clamp(1 - Math.hypot(tmp[0] - ptr.cx, tmp[1] - ptr.cy) / 240, 0, 1) * 0.5;
      }
      ho.pulse = Math.max(0, ho.pulse - dt * 0.7);
      ho.v += (want + ho.pulse - ho.v) * Math.min(1, dt * 5);
    }
    setOpacity(L.tv, clamp(at('tv', p) + HOT[2].v * 0.35, 0, 1));
    setOpacity(L.panel, clamp(at('panelGlow', p) * 0.55 + HOT[0].v * 0.6, 0, 1));
    setOpacity(L.lock, clamp(at('lockGlow', p) * 0.6 + HOT[1].v * 0.7, 0, 1));

    /* --- the shades.

       Real fabric, cut from the right-hand drape of this same photograph and
       tiled, sliding on its track. Closed, the two panels meet over the glass;
       open, they gather back into the reveals. --- */
    var closed = at('drape', p);
    if (L.drapeL && L.drapeR) {
      // Quantised: width to 0.01% of the stage (a third of a pixel at the
      // deepest crop) and the fabric density to whole percent. Both are below
      // what the eye can resolve, and both are writes that would otherwise
      // trigger a layout and a repaint of the panel on every single frame.
      var span = ((DRAPE.span * closed + DRAPE.bunch) * 100).toFixed(2) + '%';
      setStyle(L.drapeL, 'width', span);
      setStyle(L.drapeR, 'width', span);
      // gathered fabric is denser; drawn fabric flattens out
      var bg = 'auto ' + Math.round(100 / lerp(0.55, 1, closed)) + '%';
      setStyle(L.drapeL, 'backgroundSize', bg);
      setStyle(L.drapeR, 'backgroundSize', bg);
      var dOp = (0.16 + 0.56 * Math.min(1, closed * 2.2)).toFixed(3);
      setStyle(L.drapeL, 'opacity', dOp);
      setStyle(L.drapeR, 'opacity', dOp);
    }

    requestAnimationFrame(draw);
  }

  // window geometry on the source image, measured from the photograph
  var DRAPE = { left: 0.392, right: 0.332, span: 0.126, bunch: 0.026 };

  doc.addEventListener('visibilitychange', function () {
    if (doc.hidden) running = false;
    else if (!running) { running = true; last = 0; requestAnimationFrame(draw); }
  });

  // resize is handled once, debounced, by remeasure() up in the narrative layer

  /* Verification hook, console only — adds no markup, no UI, no visible change.
     Run  __nxFps()  in DevTools and it reports the next second of frames. */
  win.__nxFps = function () {
    var n = 0, t = performance.now();
    (function count(now) {
      n++;
      if (now - t < 1000) requestAnimationFrame(count);
      else if (win.console) console.log('[nexoraa] ' + n + ' fps');
    })(t);
  };

  try {
    requestAnimationFrame(draw);
  } catch (err) {
    if (win.console) console.warn('[nexoraa-xp]', err);
    bailToFallback();
  }
})();
