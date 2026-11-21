/*
  Splash cursor: a WebGL fluid simulation that the pointer stirs (inspired by React Bits "Splash Cursor").
  Custom code because Webflow has no native fluid/cursor effect (guide 3.1).
  In a Webflow build this goes in Project Settings > Footer code, before the site script.

  Colors follow the portfolio palette and the section under the pointer:
  - dark sections: lime #d4ff3a, glowing toward bone at the densest points
  - .section-style-light: a deep olive lime, so it reads on the bone background
  The dye keeps the two themes in separate channels, so ink poured on a dark section stays lime
  even if it drifts over a light one.

  Off on touch-only devices, for prefers-reduced-motion, and on browsers without WebGL2 float targets.
*/
(function () {
  "use strict";

  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var cfg = {
    simRes: 128,
    dyeRes: 1024,
    densityDissipation: 3.2,   // how fast the ink fades
    velocityDissipation: 2,
    pressure: 0.1,
    pressureIterations: 20,
    curl: 3,                   // swirliness
    splatRadius: 0.2,
    splatForce: 6000,
    moveDye: 0.16,             // ink per pointer move
    clickDye: 1.1,             // ink per click
    sleepAfter: 4000           // ms without input before the loop stops
  };
  var LIGHT_SELECTOR = ".section-style-light";

  var canvas = document.createElement("canvas");
  canvas.className = "splash-cursor";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  var gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) { canvas.remove(); return; }

  /* ---------- Shaders ---------- */
  var VERT = "#version 300 es\nprecision highp float;\nin vec2 aPosition;\nout vec2 vUv, vL, vR, vT, vB;\nuniform vec2 texelSize;\n" +
    "void main(){ vUv = aPosition * 0.5 + 0.5; vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);" +
    " vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y); gl_Position = vec4(aPosition, 0.0, 1.0); }";

  var HEAD = "#version 300 es\nprecision highp float;\nprecision highp sampler2D;\nin vec2 vUv, vL, vR, vT, vB;\nout vec4 fragColor;\n";

  var FRAG = {
    clear: "uniform sampler2D uTexture; uniform float value;" +
      "void main(){ fragColor = value * texture(uTexture, vUv); }",

    splat: "uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;" +
      "void main(){ vec2 p = vUv - point; p.x *= aspectRatio; vec3 splat = exp(-dot(p, p) / radius) * color;" +
      " fragColor = vec4(texture(uTarget, vUv).xyz + splat, 1.0); }",

    advection: "uniform sampler2D uVelocity; uniform sampler2D uSource; uniform vec2 texelSize; uniform float dt; uniform float dissipation;" +
      "void main(){ vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;" +
      " fragColor = texture(uSource, coord) / (1.0 + dissipation * dt); }",

    divergence: "uniform sampler2D uVelocity;" +
      "void main(){ float L = texture(uVelocity, vL).x; float R = texture(uVelocity, vR).x; float T = texture(uVelocity, vT).y; float B = texture(uVelocity, vB).y;" +
      " vec2 C = texture(uVelocity, vUv).xy;" +
      " if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x; if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;" +
      " fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0); }",

    curl: "uniform sampler2D uVelocity;" +
      "void main(){ float L = texture(uVelocity, vL).y; float R = texture(uVelocity, vR).y; float T = texture(uVelocity, vT).x; float B = texture(uVelocity, vB).x;" +
      " fragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0); }",

    vorticity: "uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;" +
      "void main(){ float L = texture(uCurl, vL).x; float R = texture(uCurl, vR).x; float T = texture(uCurl, vT).x; float B = texture(uCurl, vB).x; float C = texture(uCurl, vUv).x;" +
      " vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); force /= length(force) + 0.0001; force *= curl * C; force.y *= -1.0;" +
      " vec2 vel = texture(uVelocity, vUv).xy + force * dt; fragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0); }",

    pressure: "uniform sampler2D uPressure; uniform sampler2D uDivergence;" +
      "void main(){ float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x; float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;" +
      " float div = texture(uDivergence, vUv).x; fragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0); }",

    gradientSubtract: "uniform sampler2D uPressure; uniform sampler2D uVelocity;" +
      "void main(){ float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x; float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;" +
      " vec2 vel = texture(uVelocity, vUv).xy - vec2(R - L, T - B); fragColor = vec4(vel, 0.0, 1.0); }",

    // dye.r = ink poured on dark sections, dye.g = ink poured on light sections
    display: "uniform sampler2D uTexture; uniform vec2 texelSize;" +
      "const vec3 LIME = vec3(0.831, 1.0, 0.227); const vec3 BONE = vec3(0.957, 0.957, 0.941); const vec3 OLIVE = vec3(0.42, 0.53, 0.04);" +
      "void main(){ vec3 c = texture(uTexture, vUv).rgb;" +
      " float dx = length(texture(uTexture, vR).rg) - length(texture(uTexture, vL).rg);" +
      " float dy = length(texture(uTexture, vT).rg) - length(texture(uTexture, vB).rg);" +
      " vec3 n = normalize(vec3(dx, dy, length(texelSize))); float shade = clamp(n.z + 0.7, 0.7, 1.0);" +
      " float aD = clamp(c.r, 0.0, 1.0); float aL = clamp(c.g, 0.0, 1.0) * 0.75;" +
      " vec3 dark = mix(LIME, BONE, smoothstep(0.7, 1.6, c.r)) * shade;" +
      " vec3 light = OLIVE * shade;" +
      " float a = 1.0 - (1.0 - aD) * (1.0 - aL);" +
      " vec3 rgb = dark * aD + light * aL * (1.0 - aD);" +
      " fragColor = vec4(min(rgb, vec3(a)), a); }"
  };

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var vs;
  function program(fragBody) {
    vs = vs || compile(gl.VERTEX_SHADER, VERT);
    var p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, HEAD + fragBody));
    gl.bindAttribLocation(p, 0, "aPosition");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) { var name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
    return { p: p, u: u, use: function () { gl.useProgram(p); return u; } };
  }

  var P;
  try {
    P = {};
    for (var key in FRAG) P[key] = program(FRAG[key]);
  } catch (err) { canvas.remove(); return; }

  /* Full-screen quad */
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  function blit(target) {
    if (target) { gl.viewport(0, 0, target.w, target.h); gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); }
    else { gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  /* ---------- Framebuffers ---------- */
  function fbo(w, h) {
    gl.activeTexture(gl.TEXTURE0);
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      tex: tex, fbo: fb, w: w, h: h, tx: 1 / w, ty: 1 / h,
      attach: function (id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; }
    };
  }
  function doubleFbo(w, h) {
    var a = fbo(w, h), b = fbo(w, h);
    return { get read() { return a; }, get write() { return b; }, swap: function () { var t = a; a = b; b = t; }, w: w, h: h, tx: 1 / w, ty: 1 / h };
  }
  function resolution(res) {
    var ar = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (ar < 1) ar = 1 / ar;
    var min = Math.round(res), max = Math.round(res * ar);
    return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: max, h: min } : { w: min, h: max };
  }

  var dye, velocity, divergence, curl, pressure;
  function initFramebuffers() {
    var s = resolution(cfg.simRes), d = resolution(cfg.dyeRes);
    dye = doubleFbo(d.w, d.h);
    velocity = doubleFbo(s.w, s.h);
    divergence = fbo(s.w, s.h);
    curl = fbo(s.w, s.h);
    pressure = doubleFbo(s.w, s.h);
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.floor(window.innerWidth * dpr), h = Math.floor(window.innerHeight * dpr);
    if (canvas.width === w && canvas.height === h && dye) return;
    canvas.width = w; canvas.height = h;
    initFramebuffers();
  }
  resize();
  window.addEventListener("resize", resize);

  /* ---------- Simulation ---------- */
  function splat(x, y, dx, dy, dyeColor) {
    var ar = canvas.width / canvas.height;
    var r = cfg.splatRadius / 100; if (ar > 1) r *= ar;
    var u = P.splat.use();
    gl.uniform1i(u.uTarget, velocity.read.attach(0));
    gl.uniform1f(u.aspectRatio, ar);
    gl.uniform2f(u.point, x, y);
    gl.uniform3f(u.color, dx, dy, 0);
    gl.uniform1f(u.radius, r);
    blit(velocity.write); velocity.swap();
    gl.uniform1i(u.uTarget, dye.read.attach(0));
    gl.uniform3f(u.color, dyeColor[0], dyeColor[1], 0);
    blit(dye.write); dye.swap();
  }

  function step(dt) {
    gl.disable(gl.BLEND);
    var u;
    u = P.curl.use();
    gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(curl);

    u = P.vorticity.use();
    gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uCurl, curl.attach(1));
    gl.uniform1f(u.curl, cfg.curl);
    gl.uniform1f(u.dt, dt);
    blit(velocity.write); velocity.swap();

    u = P.divergence.use();
    gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    blit(divergence);

    u = P.clear.use();
    gl.uniform1i(u.uTexture, pressure.read.attach(0));
    gl.uniform1f(u.value, cfg.pressure);
    blit(pressure.write); pressure.swap();

    u = P.pressure.use();
    gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
    gl.uniform1i(u.uDivergence, divergence.attach(0));
    for (var i = 0; i < cfg.pressureIterations; i++) {
      gl.uniform1i(u.uPressure, pressure.read.attach(1));
      blit(pressure.write); pressure.swap();
    }

    u = P.gradientSubtract.use();
    gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
    gl.uniform1i(u.uPressure, pressure.read.attach(0));
    gl.uniform1i(u.uVelocity, velocity.read.attach(1));
    blit(velocity.write); velocity.swap();

    u = P.advection.use();
    gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
    var vid = velocity.read.attach(0);
    gl.uniform1i(u.uVelocity, vid);
    gl.uniform1i(u.uSource, vid);
    gl.uniform1f(u.dt, dt);
    gl.uniform1f(u.dissipation, cfg.velocityDissipation);
    blit(velocity.write); velocity.swap();

    gl.uniform1i(u.uVelocity, velocity.read.attach(0));
    gl.uniform1i(u.uSource, dye.read.attach(1));
    gl.uniform1f(u.dissipation, cfg.densityDissipation);
    blit(dye.write); dye.swap();
  }

  function render() {
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    var u = P.display.use();
    gl.uniform2f(u.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
    gl.uniform1i(u.uTexture, dye.read.attach(0));
    blit(null);
  }

  /* ---------- Pointer ---------- */
  var pointer = { x: 0, y: 0, dx: 0, dy: 0, moved: false, down: false, theme: "dark", seen: false };
  var lastInput = 0, running = false, last = 0, raf = 0;

  function themeAt(cx, cy) {
    var el = document.elementFromPoint(cx, cy);
    return el && el.closest(LIGHT_SELECTOR) ? "light" : "dark";
  }
  function dyeFor(theme, amount) { return theme === "light" ? [0, amount * 1.3] : [amount, 0]; }

  function wake() {
    lastInput = performance.now();
    if (running || document.hidden) return;
    running = true; last = 0;
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    var x = e.clientX / window.innerWidth, y = 1 - e.clientY / window.innerHeight;
    var ar = canvas.width / canvas.height;
    if (pointer.seen) {
      var dx = x - pointer.x, dy = y - pointer.y;
      if (ar < 1) dx *= ar;
      if (ar > 1) dy /= ar;
      pointer.dx += dx; pointer.dy += dy;
      pointer.moved = Math.abs(pointer.dx) > 0 || Math.abs(pointer.dy) > 0;
    }
    pointer.x = x; pointer.y = y; pointer.seen = true;
    pointer.theme = themeAt(e.clientX, e.clientY);
    wake();
  }, { passive: true });

  document.documentElement.addEventListener("pointerleave", function () { pointer.seen = false; });

  window.addEventListener("pointerdown", function (e) {
    if (e.pointerType !== "mouse") return;
    var x = e.clientX / window.innerWidth, y = 1 - e.clientY / window.innerHeight;
    var theme = themeAt(e.clientX, e.clientY);
    var a = Math.random() * Math.PI * 2;
    splat(x, y, Math.cos(a) * 900, Math.sin(a) * 900, dyeFor(theme, cfg.clickDye));
    wake();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); }
  });

  function frame(t) {
    var dt = last ? Math.min((t - last) / 1000, 1 / 60) : 1 / 60;
    last = t;
    resize();
    if (pointer.moved) {
      splat(pointer.x, pointer.y, pointer.dx * cfg.splatForce, pointer.dy * cfg.splatForce, dyeFor(pointer.theme, cfg.moveDye));
      pointer.dx = pointer.dy = 0; pointer.moved = false;
    }
    step(dt);
    render();

    // Ink has faded by now: clear and sleep until the next input
    if (performance.now() - lastInput > cfg.sleepAfter) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }
})();
