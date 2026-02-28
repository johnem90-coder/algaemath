import {
  WebGLRenderer,
  Scene,
  Color,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  LineBasicMaterial,
  SphereGeometry,
  PlaneGeometry,
  BoxGeometry,
  CylinderGeometry,
  ShapeGeometry,
  TubeGeometry,
  Shape,
  Vector3,
  Vector4,
  Group,
  BufferGeometry,
  BufferAttribute,
  LineSegments,
  CatmullRomCurve3,
  DoubleSide,
  PCFShadowMap,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  CanvasTexture,
  ExternalTexture,
} from 'three'
import type { PondAPI, PondConfig } from './pond-types'

// Timer utility (matches Three.js addons Timer)
class Timer {
  private _previousTime: number = 0
  private _currentTime: number = 0
  private _delta: number = 0
  private _elapsed: number = 0
  private _timescale: number = 1
  private _usePageVisibility: boolean = true
  private _pageVisible: boolean = true

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this._pageVisible = !document.hidden
        if (this._pageVisible) {
          this._previousTime = performance.now() / 1000
        }
      })
    }
  }

  getDelta(): number {
    return this._delta
  }

  getElapsed(): number {
    return this._elapsed
  }

  update(): void {
    const now = performance.now() / 1000
    if (this._previousTime === 0) {
      this._previousTime = now
    }
    this._delta = (now - this._previousTime) * this._timescale
    if (this._usePageVisibility && !this._pageVisible) {
      this._delta = 0
    }
    this._previousTime = now
    this._elapsed += this._delta
  }
}

export function initPond(config: PondConfig): PondAPI {
  const { canvas, width, height } = config

  const renderer = new WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  renderer.outputColorSpace = SRGBColorSpace

  const scene = new Scene()
  scene.background = new Color(0xdde8ee)

  const aspect = width / height
  const camera = new PerspectiveCamera(28, aspect, 0.1, 300)
  const dist = 35
  const az = Math.PI / 4
  const el = Math.atan(1 / Math.sqrt(2))
  camera.position.set(
    dist * Math.cos(el) * Math.sin(az),
    dist * Math.sin(el),
    dist * Math.cos(el) * Math.cos(az)
  )
  camera.lookAt(0.5, 0.5, -0.5)
  camera.updateProjectionMatrix()

  // Lighting
  const ambientLight = new AmbientLight(0xdde0ff, 1.2)
  scene.add(ambientLight)

  const sunLight = new DirectionalLight(0xfffff0, 2.6)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.set(2048, 2048)
  sunLight.shadow.camera.near = 1
  sunLight.shadow.camera.far = 120
  sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -22
  sunLight.shadow.camera.right = sunLight.shadow.camera.top = 22
  sunLight.shadow.radius = 2
  sunLight.shadow.bias = -0.001
  scene.add(sunLight)

  const fill = new DirectionalLight(0xb0c8e0, 0.4)
  fill.position.set(-15, 8, -10)
  scene.add(fill)

  const hemi = new HemisphereLight(0xe11d08, 0x9ab828, 0.3)
  scene.add(hemi)

  // Sun sphere
  const sunSphere = new Mesh(
    new SphereGeometry(0.9, 16, 16),
    new MeshBasicMaterial({ color: 0xfff6e8 })
  )
  scene.add(sunSphere)

  const SUN_RADIUS = 12
  function sunPositionForHour(hour: number) {
    // Offset so sun peeks above horizon at hour 6 and 18
    const angle = ((hour - 5.5) / 13) * Math.PI
    const x0 = -Math.cos(angle) * SUN_RADIUS
    const y0 = Math.sin(angle) * SUN_RADIUS * 0.85
    const z0 = Math.sin(angle) * SUN_RADIUS * 0.25
    const rot = -30 * (Math.PI / 180)
    const x = x0 * Math.cos(rot) - z0 * Math.sin(rot)
    const z = x0 * Math.sin(rot) + z0 * Math.cos(rot)
    return { x, y: y0, z, aboveHorizon: hour >= 5.5 && hour <= 18.5 }
  }

  function lerpColor(c1: Color, c2: Color, t: number): Color {
    return new Color(
      c1.r + (c2.r - c1.r) * t,
      c1.g + (c2.g - c1.g) * t,
      c1.b + (c2.b - c1.b) * t
    )
  }

  const skyColors = {
    night: new Color(0x0a1020),
    dawn: new Color(0x8a5050),
    morning: new Color(0xc8d8e8),
    noon: new Color(0xdde8ee),
    evening: new Color(0x9a6e60),
    dusk: new Color(0x1a1830),
  }

  const sunColors = {
    horizon: new Color(0xffc044),
    midday: new Color(0xfffff0),
    night: new Color(0x111122),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyTimeOfDay(hour: number) {
    const pos = sunPositionForHour(hour)
    sunSphere.position.set(pos.x, pos.y, pos.z)
    sunSphere.visible = pos.aboveHorizon && pos.y > -2
    sunLight.position.set(pos.x, Math.max(pos.y, 0.5), pos.z)
    sunLight.target.position.set(0, 0, 0)
    sunLight.target.updateMatrixWorld()

    if (!pos.aboveHorizon) {
      sunLight.intensity = 0.05
      sunLight.color.set(0x222266)
      ambientLight.intensity = 0.3
      ambientLight.color.set(0x101828)
      ;(scene.background as Color).set(skyColors.night)
      ;(sunSphere.material as MeshBasicMaterial).color.set(0x222266)
      hemi.color.set(0x203050)
      hemi.groundColor.set(0x0a1015)
      return
    }

    const elev = Math.sin(((hour - 6) / 12) * Math.PI)
    const sCol = lerpColor(sunColors.horizon, sunColors.midday, Math.min(elev * 1.8, 1))
    sunLight.color.copy(sCol)
    ;(sunSphere.material as MeshBasicMaterial).color.copy(sCol)
    sunLight.intensity = elev * 2.6
    ambientLight.intensity = 0.4 + elev * 0.9

    const aSky =
      hour < 12
        ? lerpColor(skyColors.dawn, skyColors.morning, Math.min(elev * 2, 1))
        : lerpColor(
            skyColors.morning,
            skyColors.evening,
            Math.max((elev - 0.5) * -2 + 1, 0)
          )
    ambientLight.color.copy(aSky)

    let bgColor: Color
    if (hour < 7) {
      bgColor = lerpColor(skyColors.dawn, skyColors.morning, hour - 6)
    } else if (hour < 12) {
      bgColor = lerpColor(skyColors.morning, skyColors.noon, (hour - 7) / 5)
    } else if (hour < 17) {
      bgColor = lerpColor(skyColors.noon, skyColors.morning, (hour - 12) / 5)
    } else if (hour < 18) {
      bgColor = lerpColor(skyColors.morning, skyColors.evening, hour - 17)
    } else {
      bgColor = skyColors.evening
    }
    ;(scene.background as Color).copy(bgColor)
    hemi.color.copy(bgColor)
    hemi.intensity = 0.2 + elev * 0.3
    // Store base intensities for cloud shadow calculation
    ;(sunLight as any)._baseIntensity = sunLight.intensity
    ;(ambientLight as any)._baseIntensity = ambientLight.intensity
  }

  applyTimeOfDay(12)

  // Ground plane
  const ground = new Mesh(
    new PlaneGeometry(200, 200),
    new MeshLambertMaterial({ color: 0xc8ccb4 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // Pond geometry constants
  const PX = 1.65
  const PZ = 9.55
  const HW = 0.35
  const WH = 0.3
  const DX = 0.1
  const DZ = 7.9
  const BW = 0.22
  const iW = PX - BW
  const SZ = DZ
  const SEGS = 48

  // Materials
  const mConc = new MeshLambertMaterial({ color: 0xd2d8be })
  const mTop = new MeshLambertMaterial({ color: 0xe2e8cb })
  const mDiv = new MeshLambertMaterial({ color: 0xc8ccb2 })
  const mMetal = new MeshLambertMaterial({ color: 0x383e4e })
  const mBlade = new MeshLambertMaterial({ color: 0x1c2a2a })
  const mDefl = new MeshLambertMaterial({
    color: 0xb8c8d8,
    transparent: true,
    opacity: 0.65,
    side: DoubleSide,
  })
  const mWater = new MeshStandardMaterial({
    color: 0x5a8c3e,
    roughness: 0.22,
    metalness: 0.04,
  })
  const mWaterSide = new MeshStandardMaterial({
    color: 0x3a6a25,
    roughness: 0.6,
  })

  const pond = new Group()
  const blades: Mesh[] = []

  function shadow(m: Mesh, cast = true, recv = true): Mesh {
    m.castShadow = cast
    m.receiveShadow = recv
    return m
  }

  function add(m: Mesh): Mesh {
    pond.add(m)
    return m
  }

  function makeMesh(
    geo: any,
    mat: any,
    px = 0,
    py = 0,
    pz = 0,
    rx = 0,
    ry = 0,
    rz = 0
  ): Mesh {
    const m = new Mesh(geo, mat)
    m.position.set(px, py, pz)
    m.rotation.set(rx, ry, rz)
    return m
  }

  // Berms (side walls)
  add(shadow(makeMesh(new BoxGeometry(BW, HW, SZ * 2), mConc, -(iW + BW / 2), HW / 2, 0)))
  add(shadow(makeMesh(new BoxGeometry(BW, HW, SZ * 2), mConc, iW + BW / 2, HW / 2, 0)))

  // Berm end caps
  function addBermCap(zPos: number) {
    const thetaStart = zPos > 0 ? -Math.PI / 2 : Math.PI / 2
    const outerCap = shadow(
      makeMesh(
        new CylinderGeometry(PX, PX, HW, SEGS, 1, true, thetaStart, Math.PI),
        mConc,
        0,
        HW / 2,
        zPos
      )
    )
    add(outerCap)

    const ring = new Shape()
    if (zPos > 0) {
      ring.absarc(0, 0, PX, Math.PI, 0, false)
      ring.lineTo(iW, 0)
      ring.absarc(0, 0, iW, 0, Math.PI, true)
      ring.lineTo(-PX, 0)
    } else {
      ring.absarc(0, 0, PX, 0, Math.PI, false)
      ring.lineTo(-iW, 0)
      ring.absarc(0, 0, iW, Math.PI, 0, true)
      ring.lineTo(PX, 0)
    }
    const ringMesh = new Mesh(new ShapeGeometry(ring, SEGS), mTop)
    ringMesh.rotation.x = -Math.PI / 2
    ringMesh.position.set(0, HW, zPos)
    ringMesh.receiveShadow = true
    pond.add(ringMesh)
  }

  addBermCap(SZ)
  addBermCap(-SZ)

  // Top edges of berms
  add(shadow(makeMesh(new BoxGeometry(BW, 0.012, SZ * 2), mTop, -(iW + BW / 2), HW, 0), false, true))
  add(shadow(makeMesh(new BoxGeometry(BW, 0.012, SZ * 2), mTop, iW + BW / 2, HW, 0), false, true))

  // Water lanes
  const laneW = iW - DX
  const leftWater = add(
    shadow(makeMesh(new BoxGeometry(laneW, WH, SZ * 2), mWater, -(DX + laneW / 2), WH / 2, 0), false)
  )
  leftWater.userData.isWater = true
  const rightWater = add(
    shadow(makeMesh(new BoxGeometry(laneW, WH, SZ * 2), mWater, DX + laneW / 2, WH / 2, 0), false)
  )
  rightWater.userData.isWater = true

  // Water surface caps
  const leftSurf = makeMesh(new BoxGeometry(laneW, 0.008, SZ * 2), mWater, -(DX + laneW / 2), WH, 0)
  leftSurf.userData.isWater = true
  add(leftSurf)
  const rightSurf = makeMesh(new BoxGeometry(laneW, 0.008, SZ * 2), mWater, DX + laneW / 2, WH, 0)
  rightSurf.userData.isWater = true
  add(rightSurf)

  function addWaterCap(zPos: number) {
    const s = new Shape()
    if (zPos > 0) {
      s.absarc(0, 0, iW, Math.PI, 0, false)
      s.lineTo(DX, 0)
      s.absarc(0, 0, DX, 0, Math.PI, true)
      s.lineTo(-iW, 0)
    } else {
      s.absarc(0, 0, iW, 0, Math.PI, false)
      s.lineTo(-DX, 0)
      s.absarc(0, 0, DX, Math.PI, 0, true)
      s.lineTo(iW, 0)
    }
    const geo = new ShapeGeometry(s, SEGS)
    const capTop = new Mesh(geo, mWater.clone())
    capTop.rotation.x = -Math.PI / 2
    capTop.position.set(0, WH, zPos)
    capTop.userData.isWater = true
    pond.add(capTop)
  }

  addWaterCap(SZ)
  addWaterCap(-SZ)

  // Center divider
  add(shadow(makeMesh(new BoxGeometry(DX * 2, HW, DZ * 2), mDiv, 0, HW / 2, 0)))

  // Deflectors at ends
  ;[SZ, -SZ].forEach((endZ, ei) => {
    const dir = ei === 0 ? 1 : -1
    ;[0.5, 0.85, 1.2].forEach((r) => {
      const pts: Vector3[] = []
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI
        pts.push(new Vector3(Math.cos(a) * r, 0, dir * Math.sin(a) * r))
      }
      const defMesh = new Mesh(
        new TubeGeometry(new CatmullRomCurve3(pts), 32, 0.022, 6, false),
        mDefl
      )
      defMesh.position.set(0, WH + 0.01, endZ)
      pond.add(defMesh)
    })
  })

  // Paddlewheel
  const pwZ = -6.5
  const pwX = (DX + iW) / 2
  const axleLen = iW - DX - 0.08
  const pwGroup = new Group()
  pwGroup.position.set(pwX, HW + 0.02, pwZ)
  pwGroup.add(shadow(makeMesh(new BoxGeometry(axleLen + 0.1, 0.04, 0.62), mConc, 0, -0.01)))

  const axle = makeMesh(
    new CylinderGeometry(0.038, 0.038, axleLen, 12),
    mMetal,
    0,
    0.14,
    0,
    0,
    0,
    Math.PI / 2
  )
  axle.castShadow = true
  pwGroup.add(axle)

  for (let b = 0; b < 6; b++) {
    const blade = makeMesh(new BoxGeometry(axleLen - 0.04, 0.024, 0.2), mBlade)
    blade.userData.baseAngle = (b / 6) * Math.PI * 2
    blade.castShadow = true
    pwGroup.add(blade)
    blades.push(blade)
  }

  ;[-(axleLen / 2), axleLen / 2].forEach((x) => {
    const hub = makeMesh(
      new CylinderGeometry(0.11, 0.11, 0.055, 16),
      mMetal,
      x,
      0.14,
      0,
      0,
      0,
      Math.PI / 2
    )
    hub.castShadow = true
    pwGroup.add(hub)
  })

  pond.add(pwGroup)
  scene.add(pond)

  // Wind state
  let windFromDeg = 225
  let windSpeed = 3.8

  function windMovement(fromDeg: number, speed: number) {
    const rad = ((fromDeg + 180) * Math.PI) / 180
    return { dx: Math.sin(rad) * speed, dz: Math.cos(rad) * speed }
  }

  // Wind wisps
  const WISP_COUNT = 56
  const SCENE_EXTENT = 60
  const SPAWN_EXTENT = 60
  const BODY_SEGS = 16
  const CURL_SEGS = 20
  const VERTS_PER_WISP = (BODY_SEGS + CURL_SEGS) * 2
  const wispPositions = new Float32Array(WISP_COUNT * VERTS_PER_WISP * 3)
  const wispBodyLen = new Float32Array(WISP_COUNT)
  const wispBow = new Float32Array(WISP_COUNT)
  const wispBowSide = new Float32Array(WISP_COUNT)
  const wispCurlR = new Float32Array(WISP_COUNT)
  const wispCurlTurns = new Float32Array(WISP_COUNT)
  const wispHasCurl = new Uint8Array(WISP_COUNT)
  const wispY = new Float32Array(WISP_COUNT)
  const wispSpd = new Float32Array(WISP_COUNT)
  const wispPhase = new Float32Array(WISP_COUNT)
  const wispAnchorX = new Float32Array(WISP_COUNT)
  const wispAnchorZ = new Float32Array(WISP_COUNT)

  function initWispProps(i: number) {
    wispBodyLen[i] = 1.25 + Math.random() * 1.5
    wispBow[i] = 0.2 + Math.random() * 0.32
    wispBowSide[i] = Math.random() < 0.5 ? 1 : -1
    wispCurlR[i] = 0.14 + Math.random() * 0.1
    wispCurlTurns[i] = 0.9 + Math.random() * 0.2
    wispHasCurl[i] = Math.random() < 0.7 ? 1 : 0
    wispY[i] = 0.55 + Math.random() * 1.1
    wispSpd[i] = 0.45 + Math.random() * 0.9
    wispPhase[i] = Math.random()
  }

  function spawnWispAnchor(i: number, fromUpwindEdge: boolean) {
    const mv = windMovement(windFromDeg, 1)
    const mag = Math.sqrt(mv.dx * mv.dx + mv.dz * mv.dz) || 1
    const ux = mv.dx / mag
    const uz = mv.dz / mag

    if (fromUpwindEdge) {
      const perp = (Math.random() * 2 - 1) * SPAWN_EXTENT
      wispAnchorX[i] = -ux * SCENE_EXTENT * 0.5 + uz * perp
      wispAnchorZ[i] = -uz * SCENE_EXTENT * 0.5 - ux * perp
    } else {
      const perp = (Math.random() * 2 - 1) * SPAWN_EXTENT
      wispAnchorX[i] = (Math.random() * 2 - 1) * SCENE_EXTENT * 0.8 + uz * perp
      wispAnchorZ[i] = (Math.random() * 2 - 1) * SCENE_EXTENT * 0.8 - ux * perp
    }
    wispPhase[i] = 0
  }

  function bezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const u = 1 - t
    return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
  }

  function buildWispGeometry(i: number, ux: number, uz: number) {
    const px = -uz
    const pz = ux
    const L = wispBodyLen[i]
    const bow = wispBow[i]
    const side = wispBowSide[i]
    const hy = wispY[i]
    const ax = wispAnchorX[i]
    const az = wispAnchorZ[i]
    const isS = i % 5 !== 0
    const bow1side = side
    const bow2side = isS ? -side : side

    const p0x = ax
    const p0z = az
    const p1x = ax + ux * L * 0.33 + px * bow * 0.6 * bow1side
    const p1z = az + uz * L * 0.33 + pz * bow * 0.6 * bow1side
    const p2x = ax + ux * L * 0.66 + px * bow * 0.6 * bow2side
    const p2z = az + uz * L * 0.66 + pz * bow * 0.6 * bow2side
    const p3x = ax + ux * L
    const p3z = az + uz * L
    const base = i * VERTS_PER_WISP * 3

    for (let s = 0; s < BODY_SEGS; s++) {
      const t0 = s / BODY_SEGS
      const t1 = (s + 1) / BODY_SEGS
      const x0 = bezier(p0x, p1x, p2x, p3x, t0)
      const z0 = bezier(p0z, p1z, p2z, p3z, t0)
      const x1 = bezier(p0x, p1x, p2x, p3x, t1)
      const z1 = bezier(p0z, p1z, p2z, p3z, t1)
      const vi = base + s * 6
      wispPositions[vi] = x0
      wispPositions[vi + 1] = hy
      wispPositions[vi + 2] = z0
      wispPositions[vi + 3] = x1
      wispPositions[vi + 4] = hy
      wispPositions[vi + 5] = z1
    }

    const curlR0 = wispHasCurl[i] ? wispCurlR[i] : 0
    const totalAngle = wispCurlTurns[i] * Math.PI * 2
    const tanX = 3 * (p3x - p2x)
    const tanZ = 3 * (p3z - p2z)
    const tanMag = Math.sqrt(tanX * tanX + tanZ * tanZ) || 1
    const tx = tanX / tanMag
    const tz = tanZ / tanMag
    const curlSign = wispBowSide[i]
    const nx = -tz * curlSign
    const nz = tx * curlSign
    const scx = p3x + nx * curlR0
    const scz = p3z + nz * curlR0

    for (let s = 0; s < CURL_SEGS; s++) {
      const t0 = s / CURL_SEGS
      const t1 = (s + 1) / CURL_SEGS
      const r0 = curlR0 * (1 - t0)
      const r1 = curlR0 * (1 - t1)
      const a0 = t0 * totalAngle
      const a1 = t1 * totalAngle
      const cx0 = scx - (Math.cos(a0) * nx - Math.sin(a0) * tx) * r0
      const cz0 = scz - (Math.cos(a0) * nz - Math.sin(a0) * tz) * r0
      const cx1 = scx - (Math.cos(a1) * nx - Math.sin(a1) * tx) * r1
      const cz1 = scz - (Math.cos(a1) * nz - Math.sin(a1) * tz) * r1
      const vi = base + (BODY_SEGS + s) * 6
      wispPositions[vi] = cx0
      wispPositions[vi + 1] = hy
      wispPositions[vi + 2] = cz0
      wispPositions[vi + 3] = cx1
      wispPositions[vi + 4] = hy
      wispPositions[vi + 5] = cz1
    }
  }

  for (let i = 0; i < WISP_COUNT; i++) {
    initWispProps(i)
    spawnWispAnchor(i, false)
  }

  {
    const mv = windMovement(windFromDeg, 1)
    const mag = Math.sqrt(mv.dx * mv.dx + mv.dz * mv.dz) || 1
    const ux = mv.dx / mag
    const uz = mv.dz / mag
    for (let i = 0; i < WISP_COUNT; i++) {
      buildWispGeometry(i, ux, uz)
    }
  }

  const wispGeo = new BufferGeometry()
  wispGeo.setAttribute('position', new BufferAttribute(wispPositions, 3))
  const wispMat = new LineBasicMaterial({
    color: 0x6b9eb0,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  })
  const wispLines = new LineSegments(wispGeo, wispMat)
  scene.add(wispLines)

  // Flag and pole
  const FLAG_X = -(iW + BW * 0.5)
  const FLAG_Z = SZ + 0.3
  const POLE_H = 1.8
  const poleMat = new MeshStandardMaterial({ color: 0x888888, roughness: 0.5 })
  const poleMesh = new Mesh(new CylinderGeometry(0.018, 0.018, POLE_H, 6), poleMat)
  poleMesh.position.set(FLAG_X, HW + POLE_H / 2, FLAG_Z)
  scene.add(poleMesh)

  const FLAG_L = 0.75
  const FLAG_W = 0.3
  const FLAG_SEGS = 10
  const flagGeoF = new PlaneGeometry(FLAG_L, FLAG_W, FLAG_SEGS, 2)
  const flagMat = new MeshBasicMaterial({
    color: 0x4a740a,
    side: DoubleSide,
    transparent: true,
    opacity: 0.88,
  })
  const flagMesh = new Mesh(flagGeoF, flagMat)
  flagMesh.position.set(FLAG_X, HW + POLE_H - FLAG_W * 0.5 + 0.05, FLAG_Z)
  scene.add(flagMesh)

  {
    const pos = (flagGeoF.attributes.position as BufferAttribute).array as Float32Array
    for (let i = 0; i < pos.length / 3; i++) {
      pos[i * 3] += FLAG_L / 2
    }
    flagGeoF.attributes.position.needsUpdate = true
  }

  const flagBasePos = (flagGeoF.attributes.position as BufferAttribute).array.slice() as Float32Array
  let flagTime = 0

  // Chevrons (paddlewheel flow indicators)
  const CHEV_COUNT = 5
  const CHEV_SPREAD = 0.3
  const CHEV_MAX_DIST = 2
  const CHEV_SPEED = 1.2
  const chevPos = new Float32Array(CHEV_COUNT * 12)
  const chevPhase = new Float32Array(CHEV_COUNT)
  for (let i = 0; i < CHEV_COUNT; i++) {
    chevPhase[i] = i / CHEV_COUNT
  }

  const chevGeo = new BufferGeometry()
  chevGeo.setAttribute('position', new BufferAttribute(chevPos, 3))
  const chevMat = new LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  })
  scene.add(new LineSegments(chevGeo, chevMat))

  // Raceway flow path
  const rightLaneX = pwX
  const leftLaneX = -(DX + (iW - DX) / 2)
  const flowY = WH + 0.022
  const TURN_SEGS = 20

  function buildRacewayPath() {
    const pts: { x: number; z: number }[] = []
    pts.push({ x: rightLaneX, z: pwZ })
    pts.push({ x: rightLaneX, z: SZ })
    for (let s = 0; s <= TURN_SEGS; s++) {
      const a = (s / TURN_SEGS) * Math.PI
      const cx = rightLaneX + (leftLaneX - rightLaneX) / 2
      const r = (rightLaneX - leftLaneX) / 2
      pts.push({ x: cx + r * Math.cos(a), z: SZ + r * Math.abs(Math.sin(a)) * 0.6 })
    }
    pts.push({ x: leftLaneX, z: SZ })
    pts.push({ x: leftLaneX, z: -SZ })
    for (let s = 0; s <= TURN_SEGS; s++) {
      const a = (s / TURN_SEGS) * Math.PI
      const cx = leftLaneX + (rightLaneX - leftLaneX) / 2
      const r = (rightLaneX - leftLaneX) / 2
      pts.push({ x: cx - r * Math.cos(a), z: -SZ - r * Math.abs(Math.sin(a)) * 0.6 })
    }
    pts.push({ x: rightLaneX, z: -SZ })
    pts.push({ x: rightLaneX, z: pwZ })
    return pts
  }

  const racewayPath = buildRacewayPath()
  const pathDists = [0]
  for (let i = 1; i < racewayPath.length; i++) {
    const dx = racewayPath[i].x - racewayPath[i - 1].x
    const dz = racewayPath[i].z - racewayPath[i - 1].z
    pathDists.push(pathDists[i - 1] + Math.sqrt(dx * dx + dz * dz))
  }
  const totalPathLen = pathDists[pathDists.length - 1]

  function samplePath(d: number) {
    const dw = ((d % totalPathLen) + totalPathLen) % totalPathLen
    for (let i = 1; i < pathDists.length; i++) {
      if (pathDists[i] >= dw) {
        const t = (dw - pathDists[i - 1]) / (pathDists[i] - pathDists[i - 1])
        const p0 = racewayPath[i - 1]
        const p1 = racewayPath[i]
        const x = p0.x + t * (p1.x - p0.x)
        const z = p0.z + t * (p1.z - p0.z)
        const dx = p1.x - p0.x
        const dz = p1.z - p0.z
        const mag = Math.sqrt(dx * dx + dz * dz) || 1
        return { x, z, tx: dx / mag, tz: dz / mag }
      }
    }
    return { x: racewayPath[0].x, z: racewayPath[0].z, tx: 0, tz: 1 }
  }

  // Flow arrows
  const ARROW_COUNT = 9
  const ARROW_TAIL_LEN = 0.3
  const ARROW_HEAD_LEN = 0.14
  const ARROW_HEAD_ANG = 0.42
  const ARROW_SPACING = totalPathLen / ARROW_COUNT
  const arrowPos = new Float32Array(ARROW_COUNT * 18)
  const arrowDist = new Float32Array(ARROW_COUNT)
  for (let i = 0; i < ARROW_COUNT; i++) {
    arrowDist[i] = i * ARROW_SPACING
  }

  function buildArrowGeometry(i: number) {
    const d = arrowDist[i]
    const tip = samplePath(d)
    const tai = samplePath(d - ARROW_TAIL_LEN)
    const hy = flowY
    const base = i * 18

    arrowPos[base] = tai.x
    arrowPos[base + 1] = hy
    arrowPos[base + 2] = tai.z
    arrowPos[base + 3] = tip.x
    arrowPos[base + 4] = hy
    arrowPos[base + 5] = tip.z

    const cos = Math.cos(ARROW_HEAD_ANG)
    const sin = Math.sin(ARROW_HEAD_ANG)
    const lx = tip.x + ARROW_HEAD_LEN * (-tip.tx * cos + tip.tz * sin)
    const lz = tip.z + ARROW_HEAD_LEN * (-tip.tz * cos - tip.tx * sin)
    const rx = tip.x + ARROW_HEAD_LEN * (-tip.tx * cos - tip.tz * sin)
    const rz = tip.z + ARROW_HEAD_LEN * (-tip.tz * cos + tip.tx * sin)

    arrowPos[base + 6] = tip.x
    arrowPos[base + 7] = hy
    arrowPos[base + 8] = tip.z
    arrowPos[base + 9] = lx
    arrowPos[base + 10] = hy
    arrowPos[base + 11] = lz
    arrowPos[base + 12] = tip.x
    arrowPos[base + 13] = hy
    arrowPos[base + 14] = tip.z
    arrowPos[base + 15] = rx
    arrowPos[base + 16] = hy
    arrowPos[base + 17] = rz
  }

  for (let i = 0; i < ARROW_COUNT; i++) {
    buildArrowGeometry(i)
  }

  const arrowGeo = new BufferGeometry()
  arrowGeo.setAttribute('position', new BufferAttribute(arrowPos, 3))
  const arrowMat = new LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  })
  scene.add(new LineSegments(arrowGeo, arrowMat))

  const FLOW_SPEED = 1.8

  function updatePaddlewheel(dt: number) {
    for (let i = 0; i < CHEV_COUNT; i++) {
      chevPhase[i] = (chevPhase[i] + (dt * CHEV_SPEED) / CHEV_MAX_DIST) % 1
      const dist2 = chevPhase[i] * CHEV_MAX_DIST
      const z = pwZ + dist2
      const spread = CHEV_SPREAD * (0.3 + (dist2 / CHEV_MAX_DIST) * 0.7)
      const hy = WH + 0.018
      const base = i * 12
      const zTip = z + 0.18
      const zArms = z

      chevPos[base] = pwX - spread
      chevPos[base + 1] = hy
      chevPos[base + 2] = zArms
      chevPos[base + 3] = pwX
      chevPos[base + 4] = hy
      chevPos[base + 5] = zTip
      chevPos[base + 6] = pwX
      chevPos[base + 7] = hy
      chevPos[base + 8] = zTip
      chevPos[base + 9] = pwX + spread
      chevPos[base + 10] = hy
      chevPos[base + 11] = zArms
    }
    chevGeo.attributes.position.needsUpdate = true
    chevMat.opacity = 0.55

    for (let i = 0; i < ARROW_COUNT; i++) {
      arrowDist[i] = (arrowDist[i] + dt * FLOW_SPEED) % totalPathLen
      buildArrowGeometry(i)
    }
    arrowGeo.attributes.position.needsUpdate = true
  }

  function updateWind(dt: number) {
    const mv = windMovement(windFromDeg, windSpeed)
    const len = Math.sqrt(mv.dx * mv.dx + mv.dz * mv.dz) || 1
    const ux = mv.dx / len
    const uz = mv.dz / len
    const step = windSpeed * dt * 1.8

    for (let i = 0; i < WISP_COUNT; i++) {
      wispPhase[i] += dt * 0.14 * wispSpd[i]
      wispAnchorX[i] += ux * step * wispSpd[i]
      wispAnchorZ[i] += uz * step * wispSpd[i]
      if (
        Math.abs(wispAnchorX[i]) > SCENE_EXTENT ||
        Math.abs(wispAnchorZ[i]) > SCENE_EXTENT ||
        wispPhase[i] > 1
      ) {
        initWispProps(i)
        spawnWispAnchor(i, true)
      }
      buildWispGeometry(i, ux, uz)
    }
    wispGeo.attributes.position.needsUpdate = true
    wispMat.opacity = 0.35 + Math.min(windSpeed / 12, 0.3)

    flagTime += dt
    const yaw = Math.atan2(ux, uz)
    flagMesh.rotation.y = yaw + Math.PI / 2 + Math.PI

    const pos = (flagGeoF.attributes.position as BufferAttribute).array as Float32Array
    const speed = Math.max(windSpeed, 0.5)
    const amplitude = 0.05 + speed * 0.014
    const freq = 3.8
    const waveSpd = speed * 1
    for (let vi = 0; vi < pos.length / 3; vi++) {
      const t = flagBasePos[vi * 3] / FLAG_L
      const wave = amplitude * t * t * Math.sin(freq * t - waveSpd * flagTime)
      pos[vi * 3 + 2] = flagBasePos[vi * 3 + 2] + wave
    }
    flagGeoF.attributes.position.needsUpdate = true

    updatePaddlewheel(dt)
  }

  // Cloud system
  let cloudDensity01 = 0
  const CLOUD_COUNT = 32
  const SHADOW_SUN_MAX = 0.7
  const SHADOW_AMB_MAX = 0.5
  const SHADOW_RADIUS = 9

  const CLOUD_DEFS = [
    { x: -14, y: 8, z: -10, scale: 3.2, op: 0.92, rot: 0.15 },
    { x: 2, y: 9, z: -14, scale: 2.8, op: 0.88, rot: 0.15 },
    { x: 10, y: 7, z: -8, scale: 2.4, op: 0.85, rot: 0.15 },
    { x: -22, y: 9, z: -12, scale: 3.5, op: 0.9, rot: 0.15 },
    { x: -4, y: 10, z: -18, scale: 2.6, op: 0.82, rot: 0.15 },
    { x: 16, y: 8, z: -10, scale: 3, op: 0.88, rot: 0.15 },
    { x: -9, y: 7, z: -6, scale: 2, op: 0.85, rot: 0.15 },
    { x: 7, y: 9, z: -16, scale: 2.2, op: 0.8, rot: 0.15 },
    { x: -18, y: 8, z: -4, scale: 2.9, op: 0.86, rot: 0.15 },
    { x: 0, y: 10, z: -9, scale: 3.1, op: 0.84, rot: 0.15 },
    { x: 12, y: 9, z: -20, scale: 2.5, op: 0.9, rot: 0.15 },
    { x: -28, y: 8, z: -15, scale: 3.4, op: 0.88, rot: 0.15 },
    { x: 5, y: 8, z: -5, scale: 2.3, op: 0.82, rot: 0.15 },
    { x: 20, y: 9, z: -14, scale: 2.7, op: 0.86, rot: 0.15 },
    { x: -11, y: 10, z: -22, scale: 3, op: 0.8, rot: 0.15 },
    { x: -1, y: 8, z: -12, scale: 2.1, op: 0.84, rot: 0.15 },
    { x: -10, y: 11, z: 7, scale: 3.6, op: 0.88, rot: -0.55 },
    { x: -20, y: 11, z: 11, scale: 4, op: 0.9, rot: -0.57 },
    { x: -8, y: 12, z: 17, scale: 3.5, op: 0.84, rot: -0.6 },
    { x: -28, y: 11, z: 8, scale: 3.8, op: 0.88, rot: -0.56 },
    { x: -16, y: 12, z: 21, scale: 3.6, op: 0.85, rot: -0.62 },
    { x: -32, y: 11, z: 15, scale: 4, op: 0.89, rot: -0.58 },
    { x: -12, y: 12, z: 25, scale: 3.4, op: 0.83, rot: -0.63 },
    { x: -24, y: 12, z: 23, scale: 3.7, op: 0.86, rot: -0.65 },
    { x: -18, y: 11, z: 13, scale: 3.9, op: 0.88, rot: -0.58 },
    { x: -6, y: 12, z: 27, scale: 3.5, op: 0.84, rot: -0.65 },
    { x: -14, y: 11, z: 9, scale: 3.3, op: 0.87, rot: -0.55 },
    { x: -26, y: 12, z: 19, scale: 3.8, op: 0.88, rot: -0.62 },
    { x: -12, y: 11, z: 0, scale: 3.6, op: 0.88, rot: 0.1 },
    { x: -16, y: 11, z: 2, scale: 4, op: 0.9, rot: 0.1 },
    { x: -20, y: 11, z: -1, scale: 3.8, op: 0.88, rot: 0.1 },
    { x: -18, y: 11, z: 4, scale: 3.5, op: 0.86, rot: 0.1 },
  ]

  function makeCloudTexture(seed: number): CanvasTexture {
    const canvas2 = document.createElement('canvas')
    canvas2.width = 256
    canvas2.height = 256
    const ctx = canvas2.getContext('2d')!
    let s = seed * 9301 + 49297
    function rand() {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }

    ctx.clearRect(0, 0, 256, 256)
    const blobs = 6 + Math.floor(rand() * 4)
    for (let b = 0; b < blobs; b++) {
      const cx = 256 * (0.2 + rand() * 0.6)
      const cy = 256 * (0.25 + rand() * 0.5)
      const r = 256 * (0.12 + rand() * 0.22)
      const alpha = 0.25 + rand() * 0.3
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
      grad.addColorStop(0, `rgba(255,255,255,${alpha.toFixed(2)})`)
      grad.addColorStop(0.5, `rgba(240,244,250,${(alpha * 0.5).toFixed(2)})`)
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.ellipse(cx, cy, r, r * (0.55 + rand() * 0.3), rand() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
    return new CanvasTexture(canvas2)
  }

  const cloudMeshes: Mesh[] = []
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const def = CLOUD_DEFS[i]
    const tex = makeCloudTexture(i * 137 + 42)
    const mat = new MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: def.op,
      depthWrite: false,
      side: DoubleSide,
    })
    const geo = new PlaneGeometry(def.scale * 8, def.scale * 4)
    const mesh2 = new Mesh(geo, mat)
    mesh2.rotation.x = def.rot !== undefined ? def.rot : 0.15
    mesh2.position.set(def.x, def.y, def.z)
    mesh2.visible = false
    scene.add(mesh2)
    cloudMeshes.push(mesh2)
  }

  function computeCloudShadow(): number {
    if (cloudDensity01 <= 0) return 0
    let shadowVal = 0
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const def = CLOUD_DEFS[i]
      const dist2 = Math.abs(def.x)
      const r = SHADOW_RADIUS * def.scale
      if (dist2 < r) {
        const contrib = (1 - dist2 / r) * (1 - dist2 / r)
        shadowVal = Math.min(shadowVal + contrib * 0.6, 1)
      }
    }
    return Math.min(shadowVal, 1) * cloudDensity01
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function updateClouds(dt: number) {
    for (let i = 0; i < CLOUD_COUNT; i++) {
      let tierProgress: number
      if (i < 8) {
        tierProgress = Math.min(cloudDensity01 / 0.3, 1)
      } else if (i < 16) {
        tierProgress = Math.max(0, (cloudDensity01 - 0.3) / 0.35)
        tierProgress = Math.min(tierProgress, 1)
      } else {
        const t3offset = ((i - 16) / 15) * 0.25
        tierProgress = Math.max(0, (cloudDensity01 - 0.65 - t3offset) / (0.35 - t3offset))
        tierProgress = Math.min(tierProgress, 1)
      }
      cloudMeshes[i].visible = tierProgress > 0
      if (cloudMeshes[i].visible) {
        ;(cloudMeshes[i].material as MeshBasicMaterial).opacity = Math.min(
          CLOUD_DEFS[i].op * tierProgress,
          0.95
        )
      }
    }

    const shadowVal = computeCloudShadow()
    const sunFactor = 1 - shadowVal * SHADOW_SUN_MAX
    const ambFactor = 1 - shadowVal * SHADOW_AMB_MAX
    sunLight.intensity = ((sunLight as any)._baseIntensity ?? 2.6) * sunFactor
    ambientLight.intensity = ((ambientLight as any)._baseIntensity ?? 1) * ambFactor
  }

  // Rain system
  let rainDensity01 = 0
  const RAIN_COUNT = 600
  const RAIN_SPAWN_Y = 14
  const RAIN_KILL_Y = 0
  const RAIN_SPEED = 14
  const RAIN_STREAK = 0.35
  const RAIN_SPREAD_X = 16
  const RAIN_SPREAD_Z = 16
  const rainPositions = new Float32Array(RAIN_COUNT * 6)

  function spawnRaindrop(i: number) {
    const x = (Math.random() * 2 - 1) * RAIN_SPREAD_X
    const y = RAIN_SPAWN_Y + Math.random() * 6
    const z = (Math.random() * 2 - 1) * RAIN_SPREAD_Z
    rainPositions[i * 6] = x
    rainPositions[i * 6 + 1] = y
    rainPositions[i * 6 + 2] = z
    rainPositions[i * 6 + 3] = x
    rainPositions[i * 6 + 4] = y - RAIN_STREAK
    rainPositions[i * 6 + 5] = z
  }

  for (let i = 0; i < RAIN_COUNT; i++) {
    spawnRaindrop(i)
    const randomY = Math.random() * (RAIN_SPAWN_Y - RAIN_KILL_Y) + RAIN_KILL_Y
    rainPositions[i * 6 + 1] = randomY
    rainPositions[i * 6 + 4] = randomY - RAIN_STREAK
  }

  const rainGeo = new BufferGeometry()
  rainGeo.setAttribute('position', new BufferAttribute(rainPositions, 3))
  const rainMat = new LineBasicMaterial({
    color: 0xaabbdd,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  })
  const rainLines = new LineSegments(rainGeo, rainMat)
  rainLines.visible = false
  scene.add(rainLines)

  // Splash system
  const SPLASH_COUNT = 160
  const SPLASH_MAX_R = 0.18
  const SPLASH_LIFE = 0.35
  const splashPos = new Float32Array(SPLASH_COUNT * 12)
  const splashX = new Float32Array(SPLASH_COUNT)
  const splashZ = new Float32Array(SPLASH_COUNT)
  const splashY = new Float32Array(SPLASH_COUNT)
  const splashPhase = new Float32Array(SPLASH_COUNT)
  const splashAlive = new Uint8Array(SPLASH_COUNT)
  for (let i = 0; i < SPLASH_COUNT; i++) {
    splashPhase[i] = 1
  }

  let splashHead = 0
  const splashGeo = new BufferGeometry()
  splashGeo.setAttribute('position', new BufferAttribute(splashPos, 3))
  const splashMat = new LineBasicMaterial({
    color: 0xc8d8f0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  const splashLines = new LineSegments(splashGeo, splashMat)
  splashLines.visible = false
  scene.add(splashLines)

  function spawnSplash(x: number, z: number) {
    const i = splashHead % SPLASH_COUNT
    splashHead++
    splashX[i] = x
    splashZ[i] = z
    splashY[i] = WH + 0.012
    splashPhase[i] = 0
    splashAlive[i] = 1
  }

  function buildSplashGeometry(i: number) {
    const r = SPLASH_MAX_R * Math.min(splashPhase[i] * 2.5, 1)
    const x = splashX[i]
    const y = splashY[i]
    const z = splashZ[i]
    const base = i * 12

    splashPos[base] = x - r
    splashPos[base + 1] = y
    splashPos[base + 2] = z
    splashPos[base + 3] = x + r
    splashPos[base + 4] = y
    splashPos[base + 5] = z
    splashPos[base + 6] = x
    splashPos[base + 7] = y
    splashPos[base + 8] = z - r
    splashPos[base + 9] = x
    splashPos[base + 10] = y
    splashPos[base + 11] = z + r
  }

  function updateRain(dt: number) {
    const pos = rainGeo.attributes.position.array as Float32Array
    const step = RAIN_SPEED * dt
    const activeCount = Math.round(RAIN_COUNT * rainDensity01)

    for (let i = 0; i < RAIN_COUNT; i++) {
      if (i >= activeCount) {
        pos[i * 6 + 1] = -999
        pos[i * 6 + 4] = -999
        continue
      }
      pos[i * 6 + 1] -= step
      pos[i * 6 + 4] -= step
      if (pos[i * 6 + 4] < RAIN_KILL_Y) {
        spawnSplash(pos[i * 6 + 3], pos[i * 6 + 5])
        spawnRaindrop(i)
      }
    }
    rainGeo.attributes.position.needsUpdate = true

    let maxOpacity = 0
    for (let i = 0; i < SPLASH_COUNT; i++) {
      if (!splashAlive[i]) continue
      splashPhase[i] += dt / SPLASH_LIFE
      if (splashPhase[i] >= 1) {
        splashAlive[i] = 0
        const base = i * 12
        for (let k = 0; k < 12; k++) splashPos[base + k] = 0
        continue
      }
      buildSplashGeometry(i)
      const fade = 1 - splashPhase[i]
      if (fade > maxOpacity) maxOpacity = fade
    }
    splashMat.opacity = maxOpacity * 0.7
    splashGeo.attributes.position.needsUpdate = true
  }

  // Animation loop
  const timer = new Timer()
  let frameId: number

  function animate() {
    frameId = requestAnimationFrame(animate)
    timer.update()
    const dt = Math.min(timer.getDelta(), 0.05)
    const spin = timer.getElapsed() * 1.4

    blades.forEach((blade) => {
      const a = blade.userData.baseAngle + spin
      blade.position.y = 0.14 + Math.sin(a) * 0.18
      blade.position.z = Math.cos(a) * 0.18
      blade.rotation.x = a
    })

    updateWind(dt)
    updateClouds(dt)
    if (rainDensity01 > 0) updateRain(dt)
    renderer.render(scene, camera)
  }

  animate()

  // Density → water color mapping
  function setDensity(density: number) {
    const stops = [
      { d: 0.05, r: 0.84, g: 0.93, b: 0.76 },
      { d: 0.4, r: 0.65, g: 0.82, b: 0.57 },
      { d: 1, r: 0.4, g: 0.63, b: 0.28 },
      { d: 2, r: 0.25, g: 0.47, b: 0.16 },
      { d: 4, r: 0.14, g: 0.3, b: 0.09 },
    ]
    const d = Math.max(0.05, Math.min(density, 4))
    let r = stops[0].r
    let g = stops[0].g
    let b = stops[0].b

    for (let i = 0; i < stops.length - 1; i++) {
      if (d <= stops[i + 1].d) {
        const t = (d - stops[i].d) / (stops[i + 1].d - stops[i].d)
        r = stops[i].r + t * (stops[i + 1].r - stops[i].r)
        g = stops[i].g + t * (stops[i + 1].g - stops[i].g)
        b = stops[i].b + t * (stops[i + 1].b - stops[i].b)
        break
      }
    }

    const col = new Color(r, g, b)
    scene.traverse((child) => {
      if ((child as Mesh).isMesh && child.userData.isWater && (child as Mesh).material) {
        const mat = (child as Mesh).material as MeshStandardMaterial
        if (mat.color) mat.color.copy(col)
      }
    })
  }

  return {
    setDensity,
    setTime(hour: number) {
      applyTimeOfDay(hour)
    },
    setWind(fromDeg: number, speed: number) {
      windFromDeg = fromDeg
      windSpeed = speed
    },
    setClouds(density01: number) {
      cloudDensity01 = Math.max(0, Math.min(1, density01))
      if (cloudDensity01 === 0) {
        sunLight.intensity = (sunLight as any)._baseIntensity ?? sunLight.intensity
        ambientLight.intensity = (ambientLight as any)._baseIntensity ?? ambientLight.intensity
      }
    },
    setRain(density01: number) {
      rainDensity01 = Math.max(0, Math.min(1, density01))
      rainLines.visible = rainDensity01 > 0
      splashLines.visible = rainDensity01 > 0
      if (rainLines.material) {
        ;(rainLines.material as LineBasicMaterial).opacity = 0.45 + rainDensity01 * 0.4
      }
    },
    resize(w: number, h: number) {
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    },
    dispose() {
      cancelAnimationFrame(frameId)
      renderer.dispose()
      scene.traverse((obj) => {
        if ((obj as Mesh).isMesh) {
          const m = obj as Mesh
          m.geometry?.dispose()
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose())
          } else {
            m.material?.dispose()
          }
        }
      })
    },
  }
}
