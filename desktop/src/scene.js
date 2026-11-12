// Protok 3D terminal. A security hall with three zones: scanner lanes, serpentine queues,
// passengers walking airside to the gates, and arcs for staff moves. Plain three.js (inlined),
// no build step, so it runs from a file on a USB stick.
window.ProtokScene = function (host, opt = {}) {
  const T = window.THREE
  if (!T) return null
  let renderer
  try {
    renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    if (!renderer.getContext()) return null
  } catch { return null }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFSoftShadowMap
  renderer.domElement.className = 'scene-canvas'
  host.prepend(renderer.domElement)

  const ZONES = ['A', 'B', 'C']
  const ZX = { A: -27, B: 0, C: 27 }
  const ZW = 24
  const LANE_GAP = 3
  const ROW_LEN = 25, ROWS = 8, PER_ZONE = ROW_LEN * ROWS
  const WALKERS = 70
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888888'
  const col = n => new T.Color(css(n))

  const scene = new T.Scene()
  const camera = new T.PerspectiveCamera(36, 1, 0.5, 800)
  const target = new T.Vector3(0, 0, 1)
  const HOME = { r: 92, th: -0.16, ph: 0.93 }
  const cam = { ...HOME }
  const place = () => {
    camera.position.set(target.x + cam.r * Math.sin(cam.ph) * Math.sin(cam.th), target.y + cam.r * Math.cos(cam.ph), target.z + cam.r * Math.sin(cam.ph) * Math.cos(cam.th))
    camera.lookAt(target)
  }

  // ---------------------------------------------------------------- lights
  const hemi = new T.HemisphereLight(0xffffff, 0x8a8f80, 1.6)
  scene.add(hemi)
  const sun = new T.DirectionalLight(0xffffff, 2.2)
  sun.position.set(-40, 70, 45)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 50, bottom: -50, near: 1, far: 220 })
  sun.shadow.bias = -0.0004
  scene.add(sun)

  // ---------------------------------------------------------------- materials (recoloured per theme)
  const M = {
    ground: new T.MeshStandardMaterial({ roughness: 1 }),
    apron: new T.MeshStandardMaterial({ roughness: 0.95 }),
    floor: new T.MeshStandardMaterial({ roughness: 0.85 }),
    marking: new T.MeshStandardMaterial({ roughness: 0.6 }),
    taxi: new T.MeshStandardMaterial({ roughness: 0.6 }),
    building: new T.MeshStandardMaterial({ roughness: 0.7 }),
    glass: new T.MeshStandardMaterial({ roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.38 }),
    frame: new T.MeshStandardMaterial({ roughness: 0.5, metalness: 0.4 }),
    belt: new T.MeshStandardMaterial({ color: 0x3b4149, roughness: 0.8 }),
    post: new T.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.4, metalness: 0.6 }),
    tape: new T.MeshStandardMaterial({ color: 0x1d4f86, roughness: 0.6 }),
    aircraft: new T.MeshStandardMaterial({ roughness: 0.45, metalness: 0.1 }),
    walker: new T.MeshStandardMaterial({ roughness: 0.7 }),
    people: new T.MeshStandardMaterial({ roughness: 0.65 })
  }
  const box = (w, h, d, mat, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat)
    m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true
    scene.add(m); return m
  }

  // ---------------------------------------------------------------- site
  const ground = new T.Mesh(new T.PlaneGeometry(600, 600), M.ground)
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.3; ground.receiveShadow = true
  scene.add(ground)
  box(150, 0.2, 48, M.apron, 0, -0.2, -48, false) // apron behind the terminal
  for (let x = -60; x <= 60; x += 30) box(0.35, 0.02, 40, M.taxi, x, -0.08, -48, false) // lead-in lines
  box(150, 0.02, 0.4, M.taxi, 0, -0.08, -66, false)
  box(92, 0.4, 46, M.floor, 0, -0.2, -1, false) // hall floor
  // gate wall (glass) with a frame and roof beam
  box(92, 5.2, 0.5, M.glass, 0, 2.6, -23.5, false)
  box(92, 0.5, 1.2, M.frame, 0, 5.4, -23.5)
  for (let x = -46; x <= 46; x += 11.5) box(0.35, 5.2, 0.7, M.frame, x, 2.6, -23.5)
  box(0.5, 2.4, 46, M.glass, -46, 1.2, -1, false)
  box(0.5, 2.4, 46, M.glass, 46, 1.2, -1, false)
  // staff room (where reserves come from)
  box(9, 2.6, 7, M.building, -53, 1.3, 14)
  const staffSign = sprite('STAFF', 0.9)
  staffSign.position.set(-53, 4.4, 14); scene.add(staffSign)

  // simple aircraft at the gates
  function aircraft (x, z, rot, s = 1) {
    const g = new T.Group()
    const fus = new T.Mesh(new T.CapsuleGeometry(1.5 * s, 22 * s, 6, 14), M.aircraft); fus.rotation.x = Math.PI / 2; fus.position.y = 2.2 * s
    const wing = new T.Mesh(new T.BoxGeometry(28 * s, 0.35, 4.2 * s), M.aircraft); wing.position.set(0, 1.6 * s, 1 * s)
    const tail = new T.Mesh(new T.BoxGeometry(9 * s, 0.3, 2.4 * s), M.aircraft); tail.position.set(0, 2.6 * s, 11 * s)
    const fin = new T.Mesh(new T.BoxGeometry(0.35, 4.4 * s, 3 * s), M.aircraft); fin.position.set(0, 4.6 * s, 11.2 * s)
    for (const m of [fus, wing, tail, fin]) { m.castShadow = true; g.add(m) }
    g.position.set(x, 0, z); g.rotation.y = rot
    scene.add(g)
  }
  aircraft(-46, -45, 0, 0.9); aircraft(-16, -45, 0, 0.9); aircraft(14, -45, 0, 0.9); aircraft(44, -47, 0, 1.15)

  // canvas sprite for signs
  function sprite (text, scale = 1, color = '#ffffff', bg = 'rgba(29,79,134,.92)') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128
    const g = c.getContext('2d')
    g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, 504, 120, 26); g.fill()
    g.fillStyle = color; g.font = '700 64px "Segoe UI", Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.fillText(text, 256, 68)
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthWrite: false }))
    sp.scale.set(8 * scale, 2 * scale, 1)
    return sp
  }

  // ---------------------------------------------------------------- zones
  const MAXL = { A: 7, B: 6, C: 5 }
  const GATES = { A: 'GATES A1–A9', B: 'GATES B1–B8', C: 'GATES C1–C4' }
  const Z = {}
  for (const z of ZONES) {
    const x0 = ZX[z]
    const tint = new T.Mesh(new T.PlaneGeometry(ZW, 40), new T.MeshBasicMaterial({ transparent: true, opacity: 0.1, depthWrite: false }))
    tint.rotation.x = -Math.PI / 2; tint.position.set(x0, 0.02, -1); tint.userData.zone = z
    scene.add(tint)
    // status border and selection frame
    const edge = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(ZW, 0.01, 40)), new T.LineBasicMaterial({ transparent: true, opacity: 0.9 }))
    edge.position.set(x0, 0.04, -1); scene.add(edge)
    const selMat = new T.MeshBasicMaterial({ transparent: true, opacity: 0.95 })
    const sel = new T.Group()
    for (const [w, d, x, zz] of [[ZW + 0.6, 0.35, 0, 19.15], [ZW + 0.6, 0.35, 0, -21.15], [0.35, 40.6, -ZW / 2 - 0.15, -1], [0.35, 40.6, ZW / 2 + 0.15, -1]]) {
      const m = new T.Mesh(new T.BoxGeometry(w, 0.06, d), selMat); m.position.set(x, 0.05, zz); sel.add(m)
    }
    sel.position.x = x0; scene.add(sel)
    const pulse = new T.Mesh(new T.RingGeometry(13.5, 14.3, 64), new T.MeshBasicMaterial({ transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false }))
    pulse.rotation.x = -Math.PI / 2; pulse.position.set(x0, 0.06, 9); scene.add(pulse)
    // lanes
    const lanes = []
    const lx = i => x0 + (i - (MAXL[z] - 1) / 2) * LANE_GAP
    for (let i = 0; i < MAXL[z]; i++) {
      const x = lx(i)
      box(1.0, 0.75, 6.4, M.belt, x - 0.35, 0.37, 0.2)
      const scanMat = new T.MeshStandardMaterial({ roughness: 0.5 })
      const scan = box(1.9, 1.75, 2.4, scanMat, x - 0.35, 1.0, 0.2)
      const lightMat = new T.MeshStandardMaterial({ emissiveIntensity: 1.4, roughness: 0.4 })
      box(1.9, 0.14, 0.3, lightMat, x - 0.35, 1.95, 1.45, false)
      box(0.16, 2.3, 0.5, M.post, x + 0.95, 1.15, 0.2); box(0.16, 2.3, 0.5, M.post, x + 1.75, 1.15, 0.2); box(0.96, 0.2, 0.5, M.post, x + 1.35, 2.35, 0.2)
      const extraMat = new T.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      const ring = new T.Mesh(new T.PlaneGeometry(2.8, 7.6), extraMat); ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.05, 0.2); scene.add(ring)
      lanes.push({ scanMat, lightMat, extraMat, x })
    }
    // serpentine queue: stanchion tapes between people rows
    const rowZ = r => 3.2 + r * 1.95
    for (let r = 0; r < ROWS - 1; r++) {
      const zt = rowZ(r) + 0.975
      const off = r % 2 ? 1.6 : -1.6
      box(ZW - 5.2, 0.06, 0.06, M.tape, x0 + off, 0.95, zt, false)
      for (const px of [x0 + off - (ZW - 5.2) / 2, x0 + off + (ZW - 5.2) / 2]) {
        const p = new T.Mesh(new T.CylinderGeometry(0.07, 0.1, 1.0, 8), M.post); p.position.set(px, 0.5, zt); scene.add(p)
      }
    }
    const sign = sprite(GATES[z], 1.05)
    sign.position.set(x0, 7.2, -23.5); scene.add(sign)
    Z[z] = { x0, tint, edge, sel, selMat, pulse, lanes, rowZ, shown: 0, target: 0, level: 'ok', open: 0, hot: false }
  }

  // ---------------------------------------------------------------- people (instanced)
  const capsule = new T.CapsuleGeometry(0.22, 0.72, 4, 10)
  capsule.translate(0, 0.58, 0)
  const people = new T.InstancedMesh(capsule, M.people, PER_ZONE * 3)
  people.castShadow = true
  people.instanceMatrix.setUsage(T.DynamicDrawUsage)
  scene.add(people)
  const walkers = new T.InstancedMesh(capsule, M.walker, WALKERS * 3)
  walkers.castShadow = true
  walkers.instanceMatrix.setUsage(T.DynamicDrawUsage)
  scene.add(walkers)
  const dummy = new T.Object3D()
  const jitter = Array.from({ length: PER_ZONE * 3 }, (_, i) => ({ dx: (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.18, dz: (Math.sin(i * 78.233) * 12345.678 % 1) * 0.22, ph: (i * 0.618) % 1, h: 0.86 + ((i * 0.37) % 1) * 0.26 }))
  const walkSeed = Array.from({ length: WALKERS * 3 }, (_, i) => ({ ph: (i * 0.6180339) % 1, lane: (i * 7) % 7, dx: ((i * 0.37) % 1 - 0.5) * 6, sp: 0.06 + ((i * 0.13) % 1) * 0.04 }))
  const tmpC = new T.Color()

  // ---------------------------------------------------------------- team moves (arcs)
  const arcGroup = new T.Group(); scene.add(arcGroup)
  let arcKey = ''
  const arcs = []
  function buildArcs (moves) {
    const key = moves.map(m => `${m.from}>${m.to}:${m.active ? 1 : 0}`).join('|')
    if (key === arcKey) return
    arcKey = key
    arcGroup.clear(); arcs.length = 0
    for (const m of moves) {
      const a = m.from === 'R' ? new T.Vector3(-53, 2.6, 14) : new T.Vector3(ZX[m.from], 1.2, 10)
      const b = new T.Vector3(ZX[m.to], 1.2, 10)
      const mid = a.clone().add(b).multiplyScalar(0.5); mid.y = 15 + Math.abs(a.x - b.x) * 0.12
      const curve = new T.QuadraticBezierCurve3(a, mid, b)
      const color = col(m.from === 'R' ? '--limited' : '--accent2')
      const tube = new T.Mesh(new T.TubeGeometry(curve, 48, m.active ? 0.16 : 0.1, 8, false), new T.MeshBasicMaterial({ color, transparent: true, opacity: m.active ? 0.9 : 0.4 }))
      arcGroup.add(tube)
      const dots = []
      for (let k = 0; k < 3; k++) { const d = new T.Mesh(new T.SphereGeometry(0.42, 14, 10), new T.MeshBasicMaterial({ color })); arcGroup.add(d); dots.push(d) }
      arcs.push({ curve, dots, active: m.active })
    }
  }

  // ---------------------------------------------------------------- theme
  let LV = {}
  function applyTheme () {
    scene.background = col('--scene-sky')
    scene.fog = new T.Fog(scene.background, 180, 420)
    M.ground.color = col('--scene-ground')
    M.apron.color = col('--scene-runway')
    M.floor.color = col('--scene-paved')
    M.taxi.color = col('--scene-taxiline')
    M.marking.color = col('--scene-marking')
    M.building.color = col('--scene-building')
    M.frame.color = col('--scene-building')
    M.glass.color = col('--scene-glass')
    M.aircraft.color = col('--scene-aircraft')
    M.walker.color = col('--ink-dim')
    M.tape.color = col('--accent')
    const dark = css('--scene-dark') === '1'
    hemi.intensity = dark ? 0.9 : 1.6; sun.intensity = dark ? 1.1 : 2.2
    LV = { ok: col('--ok'), limited: col('--limited'), critical: col('--critical'), over: col('--over'), accent: col('--accent'), accent2: col('--accent2'), off: col('--muted-fill'), scan: col('--scene-building') }
    for (const z of ZONES) { Z[z].tint.material.color = col('--z' + z); Z[z].selMat.color = col('--accent') }
    arcKey = ''
    if (last) update(last)
  }

  // ---------------------------------------------------------------- state from the app
  let last = null
  let selected = 'A'
  function update (st) {
    last = st
    selected = st.sel
    for (const z of ZONES) {
      const s = st.zones[z], q = Z[z]
      q.target = Math.min(PER_ZONE, s.queue)
      q.level = s.level; q.open = s.open; q.perMin = Math.max(0.5, s.open * 138 / 60)
      q.edge.material.color = LV[s.level] || LV.ok
      q.pulse.material.color = LV.over
      q.sel.visible = z === selected
      q.tint.material.opacity = z === selected ? 0.16 : 0.08
      q.lanes.forEach((l, i) => {
        let state = 'closed'
        if (i < Math.min(s.open, s.base)) state = 'open'
        else if (i < s.open) state = 'extra'
        else if (i < s.base) state = 'gone'
        const c = state === 'open' ? LV.ok : state === 'extra' ? LV.accent2 : state === 'gone' ? LV.over : LV.off
        l.lightMat.color = c; l.lightMat.emissive = c; l.lightMat.emissiveIntensity = state === 'closed' ? 0.05 : 1.3
        l.scanMat.color = state === 'closed' ? LV.off : LV.scan
        l.extraMat.color = LV.accent2; l.extraMat.opacity = state === 'extra' ? 0.32 : state === 'gone' ? 0.0 : 0
        l.state = state
      })
    }
    buildArcs(st.moves || [])
  }

  // ---------------------------------------------------------------- labels (HTML, clickable)
  const labelHost = document.createElement('div'); labelHost.className = 'scene-labels'; host.append(labelHost)
  const labels = {}
  for (const z of ZONES) {
    const el = document.createElement('button'); el.className = 'zlabel'; el.dataset.zone = z
    el.onclick = () => opt.onSelect?.(z)
    labelHost.append(el); labels[z] = el
  }
  function setLabel (z, html, level) { const el = labels[z]; if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html } el.dataset.level = level; el.setAttribute('aria-pressed', z === selected) }
  const v3 = new T.Vector3()
  function placeLabels (w, h) {
    for (const z of ZONES) {
      v3.set(ZX[z], 0, 21.5).project(camera)
      const el = labels[z]
      el.style.transform = `translate(-50%, 6px) translate(${(v3.x * 0.5 + 0.5) * w}px, ${(-v3.y * 0.5 + 0.5) * h}px)`
      el.style.visibility = v3.z < 1 ? 'visible' : 'hidden'
    }
  }

  // ---------------------------------------------------------------- interaction
  const ray = new T.Raycaster(), ndc = new T.Vector2()
  let drag = null, moved = 0
  const cv = renderer.domElement
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, th: cam.th, ph: cam.ph }; moved = 0; cv.setPointerCapture(e.pointerId) })
  cv.addEventListener('pointermove', e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy))
      cam.th = drag.th - dx * 0.006; cam.ph = Math.max(0.32, Math.min(1.32, drag.ph - dy * 0.005)); place()
    } else cv.style.cursor = pick(e) ? 'pointer' : 'grab'
  })
  cv.addEventListener('pointerup', e => { if (drag && moved < 5) { const z = pick(e); if (z) opt.onSelect?.(z) } drag = null })
  cv.addEventListener('wheel', e => { e.preventDefault(); cam.r = Math.max(48, Math.min(190, cam.r * (1 + Math.sign(e.deltaY) * 0.08))); place() }, { passive: false })
  cv.addEventListener('dblclick', () => { Object.assign(cam, HOME); place() })
  function pick (e) {
    const r = cv.getBoundingClientRect()
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1)
    ray.setFromCamera(ndc, camera)
    const hit = ray.intersectObjects(ZONES.map(z => Z[z].tint))[0]
    return hit?.object.userData.zone || null
  }

  // ---------------------------------------------------------------- loop
  let W = 0, H = 0, visible = true, raf = 0
  const ro = new ResizeObserver(() => {
    W = host.clientWidth; H = host.clientHeight
    renderer.setSize(W, H, false)
    camera.aspect = W / Math.max(1, H)
    camera.fov = W < 700 ? 52 : 36
    camera.updateProjectionMatrix()
  })
  ro.observe(host)
  if (window.IntersectionObserver) new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick() }).observe(host)
  const clock = new T.Clock()
  function frame () {
    const t = clock.getElapsedTime()
    let n = 0
    for (const z of ZONES) {
      const q = Z[z]
      q.shown += (q.target - q.shown) * 0.08
      const count = Math.round(q.shown)
      for (let k = 0; k < count; k++) {
        const r = Math.floor(k / ROW_LEN), idx = k % ROW_LEN
        const dir = r % 2 ? -1 : 1
        const j = jitter[n]
        dummy.position.set(q.x0 + dir * (-9.4 + idx * 0.78) + j.dx, Math.abs(Math.sin(t * 2.2 + j.ph * 6.28)) * 0.04, q.rowZ(r) + j.dz)
        dummy.scale.set(1, j.h, 1); dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix(); people.setMatrixAt(n, dummy.matrix)
        const wait = k / q.perMin
        tmpC.copy(wait > 10 ? LV.over : wait > 7 ? LV.limited : LV.accent).lerp(LV.scan, 0.12 + (j.ph * 0.18))
        people.setColorAt(n, tmpC)
        n++
      }
    }
    people.count = n
    people.instanceMatrix.needsUpdate = true
    if (people.instanceColor) people.instanceColor.needsUpdate = true
    let w = 0
    for (const z of ZONES) {
      const q = Z[z]
      const active = Math.min(WALKERS, Math.round(q.open * 10))
      const openLanes = q.lanes.filter(l => l.state === 'open' || l.state === 'extra')
      for (let k = 0; k < active && openLanes.length; k++) {
        const s = walkSeed[w]
        const lane = openLanes[s.lane % openLanes.length]
        const p = (t * s.sp + s.ph) % 1
        dummy.position.set(lane.x + 1.3 + (s.dx - 1.3) * p, 0, -2.2 - p * 19.6)
        dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix(); walkers.setMatrixAt(w, dummy.matrix); w++
      }
      const pz = q.pulse.material
      pz.opacity = q.level === 'over' ? 0.35 + 0.35 * Math.sin(t * 4) : 0
      q.pulse.scale.setScalar(q.level === 'over' ? 1 + 0.04 * Math.sin(t * 4) : 1)
    }
    walkers.count = w
    walkers.instanceMatrix.needsUpdate = true
    for (const a of arcs) a.dots.forEach((d, k) => { d.position.copy(a.curve.getPoint(((t * (a.active ? 0.35 : 0.18)) + k / 3) % 1)) })
    renderer.render(scene, camera)
    placeLabels(W, H)
  }
  // 30 fps is plenty for this scene; while the day is being fast-forwarded draw once a second,
  // so the simulation worker gets the CPU (matters on machines without a GPU).
  let busy = false, lastT = 0, timer = 0
  function loop (ts = performance.now()) {
    raf = 0
    if (!visible || document.hidden) return
    if (busy) { frame(); timer = setTimeout(() => { timer = 0; loop() }, 1000); return }
    if (ts - lastT >= 32) { lastT = ts; frame() }
    raf = requestAnimationFrame(loop)
  }
  const kick = () => { if (!raf && !timer) loop() }
  function setBusy (b) { if (b === busy) return; busy = b; if (!b) { if (timer) { clearTimeout(timer); timer = 0 } kick() } }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick() })

  place()
  applyTheme()
  loop()
  return { update, setLabel, applyTheme, setBusy, home () { Object.assign(cam, HOME); place() } }
}
