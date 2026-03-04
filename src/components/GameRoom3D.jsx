/**
 * GameRoom3D – Three.js WebGL 아이소메트릭 씬 v2
 *
 * 크래시 수정: React render 중 Three.js (Vector3.project) 호출 제거.
 * 오버레이(배지/프롬프트/운반)는 OBJS 2D 좌표 직접 사용.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { useGameStore } from '../store/useGameStore'

/* ── 게임 상수 ───────────────────────────────────────────────── */
const CW = 620, CH = 460
const ROOM = { W: 13, D: 9.5, H: 3.6 }
const SX = ROOM.W / CW, SZ = ROOM.D / CH
const CHAR_R = 20, SPEED = 3, INTERACT_D = 68

const OBJS = [
  { id: 'farm_tomato',  x: 140, y: 140, label: '수경재배기 (토마토)' },
  { id: 'farm_lettuce', x: 140, y: 285, label: '수경재배기 (상추)'   },
  { id: 'fridge',       x: 252, y: 88,  label: '냉장고'   },
  { id: 'sink',         x: 355, y: 88,  label: '씽크대'   },
  { id: 'grill',        x: 456, y: 88,  label: '불판'     },
  { id: 'kitchen',      x: 556, y: 88,  label: '조리대'   },
  { id: 'order',        x: 548, y: 385, label: '발주대'   },
]
const WALLS2D = OBJS.map(o => ({ x: o.x - 35, y: o.y - 35, w: 70, h: 70 }))

/* ── 유틸 ───────────────────────────────────────────────────── */
const d2  = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
const clp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
function collides(x, y) {
  for (const w of WALLS2D)
    if (x > w.x - CHAR_R && x < w.x + w.w + CHAR_R &&
        y > w.y - CHAR_R && y < w.y + w.h + CHAR_R) return true
  return false
}
const v3 = (x2, z2, y = 0) => new THREE.Vector3(x2 * SX, y, z2 * SZ)

/* ── 테마 ───────────────────────────────────────────────────── */
const THEMES = {
  modern: {
    bgColor: 0xebe0d4,
    floor: 0xe2d4c0, grid: 0xc8b8a4,
    wBack: 0xcfc4b4, wLeft: 0xc4bab0, trim: 0xa89070,
    glass: 0xc4d8e8, glassOpacity: 0.50,
    farmF: 0x8b6040, soil: 0x5d4037,
    counter: 0xf4ede4, cDark: 0xd8ccbc,
    plants: 0x4a9e5c, plantsAlt: 0x6ab87a,
    tomato: 0xcc4444, lettuce: 0x78c890,
    skin: 0xfcd9b6, hair: 0x78350f, hairAlt: 0x92400e,
    ob: {
      farm_tomato: 0xa4cca8, farm_lettuce: 0xb0d4bc,
      fridge: 0xb4ccd8, sink: 0xc4d4d8,
      grill: 0x3c4450, kitchen: 0xd8c4a0, order: 0xc4b0cc,
    },
    obDark: {
      farm_tomato: 0x78aa80, farm_lettuce: 0x88b898,
      fridge: 0x88aac0, sink: 0x90a8b4,
      grill: 0x1f2937, kitchen: 0xb8a070, order: 0x9888aa,
    },
  },
  hanok: {
    bgColor: 0x1a0e06,
    floor: 0xc8a060, grid: 0x8b6030,
    wBack: 0xf2e4c0, wLeft: 0xe8d4a0, trim: 0x6b3a18,
    glass: 0xfff0c8, glassOpacity: 0.6,
    farmF: 0x6b4020, soil: 0x4a3020,
    counter: 0xd4a060, cDark: 0xa0702a,
    plants: 0x22c55e, plantsAlt: 0x4ade80,
    tomato: 0xef4444, lettuce: 0x86efac,
    skin: 0xfcd9b6, hair: 0x78350f, hairAlt: 0x92400e,
    ob: {
      farm_tomato: 0x86efac, farm_lettuce: 0xa7f3d0,
      fridge: 0xbae6fd, sink: 0xe0f2fe,
      grill: 0x374151, kitchen: 0xfed7aa, order: 0xd8b4fe,
    },
    obDark: {
      farm_tomato: 0x4ade80, farm_lettuce: 0x34d399,
      fridge: 0x7dd3fc, sink: 0x86efac,
      grill: 0x1f2937, kitchen: 0xfcd34d, order: 0xa78bfa,
    },
  },
}

/* ── 타일 바닥 텍스처 ────────────────────────────────────────── */
function makeTileTexture(floorHex) {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  const r = (floorHex >> 16) & 0xff
  const g = (floorHex >> 8) & 0xff
  const b = floorHex & 0xff
  ctx.fillStyle = `rgb(${r},${g},${b})`
  ctx.fillRect(0, 0, size, size)
  // 타일 경계선 (미묘한 홈)
  ctx.strokeStyle = `rgba(160,138,110,0.35)`
  ctx.lineWidth = 1.5
  ctx.strokeRect(1, 1, size - 2, size - 2)
  // 내부 하이라이트 (광택)
  ctx.strokeStyle = `rgba(255,248,235,0.18)`
  ctx.lineWidth = 1
  ctx.strokeRect(3, 3, size - 6, size - 6)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(ROOM.W, ROOM.D)
  return tex
}

/* ── 재질 헬퍼 ──────────────────────────────────────────────── */
const lm  = (c, opts = {}) => new THREE.MeshLambertMaterial({ color: c, ...opts })
const bm  = (c, opts = {}) => new THREE.MeshBasicMaterial({ color: c, ...opts })
const box = (w, h, d)       => new THREE.BoxGeometry(w, h, d)
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s)
const sph = (r, s = 16)    => new THREE.SphereGeometry(r, s, s)

function mkMesh(geo, mat) {
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true; m.receiveShadow = true
  return m
}

function setEmissive(material, hex, intensity) {
  if (material && material.emissive) {
    material.emissive.setHex(hex)
    material.emissiveIntensity = intensity
  }
}

/* ══ 씬 빌더 ═════════════════════════════════════════════════ */
function buildScene(theme) {
  const t = THEMES[theme] || THEMES.modern
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(t.bgColor)
  scene.fog = new THREE.FogExp2(t.bgColor, 0.018)

  /* 조명 */
  scene.add(new THREE.AmbientLight(0xfff5e4, 0.7))

  const sun = new THREE.DirectionalLight(0xfff5e8, 1.0)
  sun.position.set(15, 16, 4)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left   = -16
  sun.shadow.camera.right  =  16
  sun.shadow.camera.top    =  14
  sun.shadow.camera.bottom = -14
  sun.shadow.camera.near   =  0.5
  sun.shadow.camera.far    =  60
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.bias = -0.001
  scene.add(sun)

  const fillLight = new THREE.DirectionalLight(0xc8e0ff, 0.35)
  fillLight.position.set(-6, 10, -4)
  scene.add(fillLight)

  scene.add(new THREE.HemisphereLight(0xfff0e0, 0xb09060, 0.35))

  const lamp = new THREE.PointLight(0xffcc66, theme === 'hanok' ? 1.4 : 0.8, 6)
  lamp.position.set(1.8, 2.8, 2.5)
  scene.add(lamp)

  const kitchenLight = new THREE.PointLight(0xff9955, 0.6, 4)
  kitchenLight.position.set(9.5, 1.8, 1.5)
  scene.add(kitchenLight)

  /* 바닥 (타일 텍스처) */
  const floorTex = theme === 'modern' ? makeTileTexture(t.floor) : null
  const floorMat = floorTex
    ? new THREE.MeshLambertMaterial({ map: floorTex })
    : lm(t.floor)
  const floor = mkMesh(box(ROOM.W + 0.2, 0.1, ROOM.D + 0.2), floorMat)
  floor.position.set(ROOM.W / 2, -0.05, ROOM.D / 2)
  scene.add(floor)

  /* hanok은 기존 grid 유지 */
  if (theme === 'hanok') {
    const grid = new THREE.GridHelper(Math.max(ROOM.W, ROOM.D) + 1, 13, t.grid, t.grid)
    grid.position.set(ROOM.W / 2, 0.02, ROOM.D / 2)
    ;(Array.isArray(grid.material) ? grid.material : [grid.material]).forEach(m => {
      m.transparent = true; m.opacity = 0.3
    })
    scene.add(grid)
  }


  /* 뒷벽 */
  const bw = mkMesh(box(ROOM.W + 0.2, ROOM.H, 0.18), lm(t.wBack))
  bw.position.set(ROOM.W / 2, ROOM.H / 2, -0.09)
  scene.add(bw)

  /* 왼쪽 벽 */
  const lw = mkMesh(box(0.18, ROOM.H, ROOM.D + 0.2), lm(t.wLeft))
  lw.position.set(-0.09, ROOM.H / 2, ROOM.D / 2)
  scene.add(lw)

  /* 몰딩 */
  ;[
    { w: ROOM.W, h: 0.2, d: 0.14, px: ROOM.W / 2, py: 0.1, pz: 0.07 },
    { w: 0.14,   h: 0.2, d: ROOM.D, px: 0.07, py: 0.1, pz: ROOM.D / 2 },
  ].forEach(({ w, h, d, px, py, pz }) => {
    const m = mkMesh(box(w, h, d), lm(t.trim))
    m.position.set(px, py, pz); scene.add(m)
  })

  /* 천장 몰딩 */
  ;[
    { w: ROOM.W, h: 0.12, d: 0.1, px: ROOM.W / 2, py: ROOM.H - 0.06, pz: 0.05 },
    { w: 0.1,   h: 0.12, d: ROOM.D, px: 0.05, py: ROOM.H - 0.06, pz: ROOM.D / 2 },
  ].forEach(({ w, h, d, px, py, pz }) => {
    const m = mkMesh(box(w, h, d), lm(t.trim))
    m.position.set(px, py, pz); scene.add(m)
  })

  /* 창문 - hanok만 유지 (modern은 도어처럼 보여 제거) */
  if (theme === 'hanok') {
    buildHanokWindow(scene, t, 8.5, 1.8)
    buildHanokWindow(scene, t, 3.5, 1.4)
  }

  /* 왼쪽 벽 장식 */
  if (theme === 'hanok') {
    buildHanokArt(scene, t)
    buildHanokLantern(scene, t)
  }

  /* 주방 카운터 */
  buildKitchenCounter(scene, t, theme)

  /* 장식 */
  buildWallClock(scene, t)
  if (theme === 'hanok') buildBookshelf(scene, t)
  buildPottedPlant(scene, t, 0.4, 8.2)   // 왼쪽 벽 뒤쪽 코너

  return scene
}

/* ── 모던 창문 ──────────────────────────────────────────────── */
function buildModernWindow(scene, t, cx, w, topY) {
  const h = 1.8
  const glass = mkMesh(box(w, h, 0.05), lm(t.glass, { transparent: true, opacity: t.glassOpacity }))
  glass.position.set(cx, topY - h / 2, 0.0); scene.add(glass)
  const fMat = lm(t.trim)
  ;[
    [w + 0.08, 0.07, 0.1, cx, topY, 0],
    [w + 0.08, 0.07, 0.1, cx, topY - h, 0],
    [0.07, h + 0.07, 0.1, cx - w / 2, topY - h / 2, 0],
    [0.07, h + 0.07, 0.1, cx + w / 2, topY - h / 2, 0],
    [0.07, h, 0.1, cx, topY - h / 2, 0],
    [w, 0.07, 0.1, cx, topY - h / 2, 0],
  ].forEach(([bw, bh, bd, px, py, pz]) => {
    const f = mkMesh(box(bw, bh, bd), fMat); f.position.set(px, py, pz); scene.add(f)
  })
  ;[[cx - 0.7, topY - 0.6, 0.5, 0.7], [cx + 0.3, topY - 0.4, 0.4, 0.9],
    [cx + 0.9, topY - 0.7, 0.35, 0.6]].forEach(([bx, by, bww, bh]) => {
    const b = mkMesh(box(bww, bh, 0.02), lm(0xd4b896, { transparent: true, opacity: 0.35 }))
    b.position.set(bx, by, -0.04); scene.add(b)
  })
}

/* ── 한옥 창호지 창문 ───────────────────────────────────────── */
function buildHanokWindow(scene, t, cx, w) {
  const h = 1.9, topY = ROOM.H - 0.3
  const fMat = lm(t.trim)
  const glass = mkMesh(box(w, h, 0.04), lm(t.glass, { transparent: true, opacity: t.glassOpacity }))
  glass.position.set(cx, topY - h / 2, 0.02); scene.add(glass)
  ;[
    [w + 0.1, 0.08, 0.1, cx, topY, 0],
    [w + 0.1, 0.08, 0.1, cx, topY - h, 0],
    [0.08, h + 0.08, 0.1, cx - w / 2, topY - h / 2, 0],
    [0.08, h + 0.08, 0.1, cx + w / 2, topY - h / 2, 0],
  ].forEach(([fw, fh, fd, px, py, pz]) => {
    const f = mkMesh(box(fw, fh, fd), fMat); f.position.set(px, py, pz); scene.add(f)
  })
  const lMat = lm(t.trim, { transparent: true, opacity: 0.5 })
  for (let i = 1; i < 4; i++) {
    const hLine = mkMesh(box(w, 0.04, 0.05), lMat)
    hLine.position.set(cx, topY - h * i / 4, 0.04); scene.add(hLine)
  }
  for (let i = 1; i < 5; i++) {
    const vLine = mkMesh(box(0.04, h, 0.05), lMat)
    vLine.position.set(cx - w / 2 + w * i / 5, topY - h / 2, 0.04); scene.add(vLine)
  }
}

/* ── 스탠드 조명 ─────────────────────────────────────────────── */
function buildLamp(scene, t) {
  const base = mkMesh(cyl(0.12, 0.18, 0.08), lm(t.trim))
  base.position.set(1.6, 0.04, 2.2); scene.add(base)
  const pole = mkMesh(cyl(0.04, 0.04, 1.6), lm(t.trim))
  pole.position.set(1.6, 0.88, 2.2); scene.add(pole)
  const shade = mkMesh(cyl(0.35, 0.18, 0.45, 16), lm(0xfef9c3, { transparent: true, opacity: 0.92 }))
  shade.position.set(1.6, 2.0, 2.2); scene.add(shade)
  const glow = mkMesh(sph(0.12), bm(0xfffde7, { transparent: true, opacity: 0.85 }))
  glow.position.set(1.6, 1.85, 2.2); scene.add(glow)
}

/* ── 한옥 족자 ──────────────────────────────────────────────── */
function buildHanokArt(scene, t) {
  const frame = mkMesh(box(0.08, 1.5, 0.1), lm(t.trim))
  frame.position.set(0.04, 2.0, 2.5); scene.add(frame)
  const paper = mkMesh(box(0.04, 1.3, 0.8), lm(0xf5ead0))
  paper.position.set(0.02, 2.0, 2.5); scene.add(paper)
  const stroke1 = mkMesh(box(0.01, 0.6, 0.06), lm(0x3b2010, { transparent: true, opacity: 0.6 }))
  stroke1.position.set(0.01, 2.1, 2.3); scene.add(stroke1)
}

/* ── 한옥 바닥 등 ────────────────────────────────────────────── */
function buildHanokLantern(scene, t) {
  const base = mkMesh(box(0.3, 0.06, 0.3), lm(t.trim))
  base.position.set(11.5, 0.03, 8.2); scene.add(base)
  ;[[-0.12, 0, -0.12], [0.12, 0, -0.12], [-0.12, 0, 0.12], [0.12, 0, 0.12]].forEach(([ox,, oz]) => {
    const post = mkMesh(cyl(0.025, 0.025, 0.7), lm(t.trim))
    post.position.set(11.5 + ox, 0.38, 8.2 + oz); scene.add(post)
  })
  const shade = mkMesh(box(0.28, 0.5, 0.28), lm(0xfef3c7, { transparent: true, opacity: 0.85 }))
  shade.position.set(11.5, 0.42, 8.2); scene.add(shade)
  const roof = mkMesh(box(0.38, 0.08, 0.38), lm(t.trim))
  roof.position.set(11.5, 0.72, 8.2); scene.add(roof)
}

/* ── 주방 카운터 ─────────────────────────────────────────────── */
function buildKitchenCounter(scene, t, theme) {
  const cMat = lm(t.counter); const cDarkMat = lm(t.cDark)
  const counter = mkMesh(box(7.5, 0.12, 1.0), cMat)
  counter.position.set(8.5, 1.02, 0.55); scene.add(counter)
  const body = mkMesh(box(7.5, 1.05, 0.85), cDarkMat)
  body.position.set(8.5, 0.525, 0.475); scene.add(body)
  if (theme === 'modern') {
    const shelf = mkMesh(box(5, 0.07, 0.45), cMat)
    shelf.position.set(7.5, 2.8, 0.25); scene.add(shelf)
    ;[6.2, 7.0, 7.8, 8.6].forEach(sx => {
      const bowl = mkMesh(cyl(0.1, 0.14, 0.18), lm(0xffffff))
      bowl.position.set(sx, 2.97, 0.25); scene.add(bowl)
    })
  } else {
    const shelf = mkMesh(box(4, 0.07, 0.4), lm(t.cDark))
    shelf.position.set(8.0, 2.6, 0.22); scene.add(shelf)
    ;[7.0, 7.8, 8.6, 9.4].forEach(sx => {
      const jar = mkMesh(cyl(0.09, 0.12, 0.25), lm(0x8b6040))
      jar.position.set(sx, 2.77, 0.22); scene.add(jar)
    })
  }
}

/* ── 물뿌리개 ───────────────────────────────────────────────── */
function buildWateringCan(scene, t) {
  const wPos = v3(25, 180)
  const body = mkMesh(cyl(0.22, 0.28, 0.45, 10), lm(0x9ca3af))
  body.position.set(wPos.x, 0.28, wPos.z); scene.add(body)
  const spout = mkMesh(cyl(0.04, 0.07, 0.5, 8), lm(0x9ca3af))
  spout.rotation.z = -0.8; spout.position.set(wPos.x - 0.35, 0.5, wPos.z); scene.add(spout)
}

/* ── 농장 화단 ──────────────────────────────────────────────── */
function buildFarmBed(scene, t, cropType, pos) {
  const fMat = lm(t.farmF)
  const frame = mkMesh(box(1.5, 0.35, 2.0), fMat)
  frame.position.set(pos.x, 0.18, pos.z); scene.add(frame)
  const soil = mkMesh(box(1.3, 0.08, 1.8), lm(t.soil))
  soil.position.set(pos.x, 0.4, pos.z); scene.add(soil)
  const plantColor = cropType === 'tomato' ? t.plants : t.plantsAlt
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      const px = pos.x - 0.35 + i * 0.35
      const pz = pos.z - 0.45 + j * 0.9
      const stem = mkMesh(cyl(0.025, 0.025, 0.25), lm(0x4a7c59))
      stem.position.set(px, 0.57, pz); scene.add(stem)
      const leaf = mkMesh(sph(0.14, 8), lm(plantColor))
      leaf.scale.set(1, 0.6, 1); leaf.position.set(px, 0.72, pz); scene.add(leaf)
      if (cropType === 'tomato') {
        const tomato = mkMesh(sph(0.09, 8), lm(t.tomato))
        tomato.position.set(px, 0.68, pz + 0.08); scene.add(tomato)
      }
    }
  }
  ;[-0.72, 0, 0.72].forEach(dz => {
    const post = mkMesh(cyl(0.04, 0.04, 0.5), lm(t.farmF))
    post.position.set(pos.x - 0.82, 0.3, pos.z + dz); scene.add(post)
    const post2 = post.clone(); post2.position.x = pos.x + 0.82; scene.add(post2)
  })
  ;[0.15, 0.4].forEach(dy => {
    const rail = mkMesh(box(1.7, 0.04, 0.04), lm(t.farmF))
    rail.position.set(pos.x, dy, pos.z - 0.88); scene.add(rail)
    const rail2 = rail.clone(); rail2.position.z = pos.z + 0.88; scene.add(rail2)
  })
}

/* ── 실내 수경재배기 — AeroGarden 스타일 ─────────────────────
 *  저수조(베이스) + 수직 암 + LED 패널이 식물 위로 뻗는 형태
 * ─────────────────────────────────────────────────────────── */
function buildHydroponicUnit(scene, t, cropType, pos) {
  const metalMat = lm(0xc0c8d0)
  const isLet    = cropType === 'lettuce'
  const leafCol  = isLet ? (t.plantsAlt ?? 0x6ab87a) : (t.plants  ?? 0x4a9e5c)
  const fruitCol = isLet ? null : (t.tomato ?? 0xcc4444)

  // ── 저수조 베이스 (낮고 넓은 흰 사각형)
  const base = mkMesh(box(1.05, 0.20, 0.58), lm(0xeef2f5))
  base.position.set(pos.x, 0.10, pos.z); scene.add(base)

  // 베이스 테두리 (살짝 어두운 엣지)
  const rim = mkMesh(box(1.09, 0.04, 0.62), lm(0xd4dce4))
  rim.position.set(pos.x, 0.22, pos.z); scene.add(rim)

  // 물 색 창 (베이스 옆면에 작은 파란 슬릿 — 수위 표시)
  const sight = mkMesh(box(0.06, 0.08, 0.03), lm(0x74bcd8, { transparent: true, opacity: 0.85 }))
  sight.position.set(pos.x - 0.51, 0.10, pos.z); scene.add(sight)

  // 베이스 상판 (포드 구멍 있는 덮개)
  const lid = mkMesh(box(1.05, 0.03, 0.58), lm(0xe0e8ee))
  lid.position.set(pos.x, 0.225, pos.z); scene.add(lid)

  // ── 수직 암 (베이스 뒤쪽에서 위로 뻗음)
  const armX = pos.x + 0.40
  const armZ = pos.z - 0.22
  const arm  = mkMesh(box(0.055, 1.20, 0.055), metalMat)
  arm.position.set(armX, 0.84, armZ); scene.add(arm)

  // 암 → LED 패널 수평 연결
  const hBar = mkMesh(box(0.85, 0.045, 0.045), metalMat)
  hBar.position.set(pos.x - 0.02, 1.47, armZ); scene.add(hBar)

  // ── LED 패널 (검정 하우징 + 핑크/보라 발광)
  const ledBody = mkMesh(box(0.88, 0.055, 0.42), lm(0x22262e))
  ledBody.position.set(pos.x - 0.02, 1.50, pos.z - 0.02); scene.add(ledBody)

  // LED 발광 스트립 (2줄 — 핑크 + 보라)
  ;[[0xee55cc, -0.10], [0x9955ee, 0.10]].forEach(([col, dz]) => {
    const strip = mkMesh(box(0.84, 0.018, 0.07), bm(col, { transparent: true, opacity: 0.80 }))
    strip.position.set(pos.x - 0.02, 1.532, pos.z - 0.02 + dz); scene.add(strip)
  })

  // ── 식물 포드 5개 (1열)
  for (let i = 0; i < 5; i++) {
    const px = pos.x - 0.36 + i * 0.18
    const pz = pos.z

    // 포드컵 (작은 흰 원기둥)
    const pod = mkMesh(cyl(0.055, 0.072, 0.085, 10), lm(0xf4f8fa))
    pod.position.set(px, 0.268, pz); scene.add(pod)

    // 줄기
    const stemH = 0.16 + (i % 3) * 0.04
    const stem = mkMesh(cyl(0.012, 0.012, stemH), lm(0x5a885a))
    stem.position.set(px, 0.35 + stemH / 2, pz); scene.add(stem)

    // 잎 (상추는 옆으로 퍼짐, 토마토는 위로 모임)
    const lf = mkMesh(sph(0.088, 8), lm(leafCol))
    lf.scale.set(isLet ? 1.7 : 1.15, 0.50, 1.2)
    lf.position.set(px, 0.35 + stemH + 0.04, pz); scene.add(lf)

    // 토마토 열매
    if (fruitCol && i % 2 === 0) {
      const fr = mkMesh(sph(0.045, 8), lm(fruitCol))
      fr.position.set(px + 0.04, 0.35 + stemH, pz + 0.03); scene.add(fr)
    }
  }

  // 바닥 그림자
  const shd = mkMesh(cyl(0.55, 0.55, 0.016, 16), bm(0x000000, { transparent: true, opacity: 0.08 }))
  shd.position.set(pos.x, 0.01, pos.z); scene.add(shd)
}

/* ── 잭과 콩나물 이벤트 콩나물 ────────────────────────────────── */
function buildBeanstalk(scene, pos) {
  const group = new THREE.Group()

  // 굵어지는 줄기 세그먼트 (지그재그)
  for (let i = 0; i < 7; i++) {
    const seg = mkMesh(
      cyl(0.04 + i * 0.01, 0.06 + i * 0.01, 0.65, 8),
      lm(i % 2 === 0 ? 0x22c55e : 0x16a34a),
    )
    seg.position.set(
      pos.x + Math.sin(i * 0.9) * 0.12,
      i * 0.65 + 0.33,
      pos.z + Math.cos(i * 0.9) * 0.08,
    )
    group.add(seg)
  }

  // 잎 (교대로 양쪽)
  for (let i = 1; i <= 5; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const leaf = mkMesh(sph(0.22, 8), lm(0x4ade80))
    leaf.scale.set(2.2, 0.3, 0.9)
    leaf.rotation.y = side * 0.4
    leaf.position.set(pos.x + side * 0.45, i * 0.82, pos.z)
    group.add(leaf)
    // 잎 무늬
    const vein = mkMesh(box(0.04, 0.02, 0.35), lm(0x86efac))
    vein.position.set(pos.x + side * 0.45, i * 0.82 + 0.02, pos.z)
    group.add(vein)
  }

  // 꼭대기 콩꼬투리들
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const pod = mkMesh(cyl(0.05, 0.03, 0.42, 6), lm(0x86efac))
    pod.rotation.z = Math.PI / 4 * (i % 2 === 0 ? 1 : -1)
    pod.position.set(
      pos.x + Math.cos(angle) * 0.35,
      4.6,
      pos.z + Math.sin(angle) * 0.25,
    )
    group.add(pod)
  }

  // 구름 / 마법 빛
  const cloud = mkMesh(sph(0.55, 10), lm(0xf0f9ff, { transparent: true, opacity: 0.8 }))
  cloud.scale.set(1.4, 0.7, 1.1)
  cloud.position.set(pos.x, 5.2, pos.z)
  group.add(cloud)

  const glow = mkMesh(sph(0.28, 8), bm(0xfef08a, { transparent: true, opacity: 0.7 }))
  glow.position.set(pos.x, 5.1, pos.z)
  group.add(glow)

  // 황금 콩 (잭의 마법 콩)
  const goldBean = mkMesh(sph(0.14, 10), lm(0xfbbf24))
  goldBean.position.set(pos.x, 5.5, pos.z)
  group.add(goldBean)

  group.visible = false
  scene.add(group)
  return group
}

/* ── 책장 (왼쪽 벽) ─────────────────────────────────────────── */
function buildBookshelf(scene, t) {
  const fMat = lm(t.cDark ?? 0xa0702a)
  const frame = mkMesh(box(0.14, 1.6, 0.92), fMat)
  frame.position.set(0.07, 0.8, 4.5); scene.add(frame)
  ;[0.38, 0.80, 1.22].forEach(sy => {
    const shelf = mkMesh(box(0.1, 0.04, 0.90), lm(t.counter ?? 0xfefefe))
    shelf.position.set(0.05, sy, 4.5); scene.add(shelf)
  })
  const bookColors = [0xef4444, 0x3b82f6, 0x22c55e, 0xf59e0b, 0xa855f7, 0xec4899, 0xfb923c, 0x0ea5e9]
  bookColors.forEach((col, i) => {
    const bk = mkMesh(box(0.08, 0.22 + (i % 3) * 0.04, 0.11), lm(col))
    bk.position.set(0.05, 0.27 + Math.floor(i / 4) * 0.42, 4.15 + (i % 4) * 0.20); scene.add(bk)
  })
}

/* ── 벽 시계 (뒷벽) ─────────────────────────────────────────── */
function buildWallClock(scene, t) {
  const clockBase = mkMesh(cyl(0.3, 0.3, 0.045, 24), lm(0xf8fafc))
  clockBase.rotation.x = Math.PI / 2; clockBase.position.set(6.8, 2.9, 0.055); scene.add(clockBase)
  const rim = mkMesh(cyl(0.32, 0.32, 0.03, 24), lm(t.trim))
  rim.rotation.x = Math.PI / 2; rim.position.set(6.8, 2.9, 0.03); scene.add(rim)
  // 시침
  const hHand = mkMesh(box(0.025, 0.14, 0.025), lm(0x1e293b))
  hHand.rotation.z = -0.8; hHand.position.set(6.77, 2.97, 0.085); scene.add(hHand)
  // 분침
  const mHand = mkMesh(box(0.018, 0.20, 0.018), lm(0x374151))
  mHand.rotation.z = 1.2; mHand.position.set(6.89, 2.84, 0.085); scene.add(mHand)
  // 중심 축
  const center = mkMesh(sph(0.028, 8), lm(0xef4444))
  center.position.set(6.8, 2.9, 0.09); scene.add(center)
  // 숫자 점 (12, 3, 6, 9 위치)
  ;[[0, 0.26], [0.26, 0], [0, -0.26], [-0.26, 0]].forEach(([dx, dz]) => {
    const dot = mkMesh(sph(0.024, 6), lm(0x64748b))
    dot.position.set(6.8 + dx, 2.9, 0.09 + dz); scene.add(dot)
  })
}

/* ── 화분 ────────────────────────────────────────────────────── */
function buildPottedPlant(scene, t, wx, wz) {
  const pot = mkMesh(cyl(0.12, 0.15, 0.22, 12), lm(0xc0622d))
  pot.position.set(wx, 0.11, wz); scene.add(pot)
  const soil = mkMesh(cyl(0.11, 0.11, 0.04, 12), lm(0x4e342e))
  soil.position.set(wx, 0.23, wz); scene.add(soil)
  const lc = [t.plants ?? 0x22c55e, t.plantsAlt ?? 0x4ade80]
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2
    const lf = mkMesh(sph(0.09, 8), lm(lc[i % 2]))
    lf.scale.set(1.5, 0.6, 1.1)
    lf.position.set(wx + Math.cos(ang) * 0.13, 0.36 + (i % 2) * 0.06, wz + Math.sin(ang) * 0.13)
    scene.add(lf)
  }
  const top = mkMesh(sph(0.10, 8), lm(lc[0])); top.position.set(wx, 0.46, wz); scene.add(top)
}

/* ── 3D 오브젝트 ─────────────────────────────────────────────── */
function buildObject3D(scene, t, obj) {
  const pos = v3(obj.x, obj.y, 0)
  const baseColor = t.ob[obj.id]
  const darkColor = t.obDark[obj.id]
  const group = new THREE.Group()
  group.position.copy(pos)

  let w = 0.9, h = 0.85, d = 0.75

  if (obj.id === 'fridge') {
    w = 0.85; h = 1.7; d = 0.7
    const body = mkMesh(box(w, h, d), lm(baseColor)); body.position.y = h / 2; group.add(body)
    const dark = mkMesh(box(w - 0.02, h - 0.02, 0.02), lm(darkColor)); dark.position.set(0, h / 2, d / 2 + 0.01); group.add(dark)
    const handle = mkMesh(cyl(0.02, 0.02, 0.4), lm(0xc0c0c0)); handle.rotation.x = Math.PI / 2
    handle.position.set(-0.2, h * 0.6, d / 2 + 0.06); group.add(handle)
    const sep = mkMesh(box(w + 0.02, 0.03, d + 0.02), lm(darkColor)); sep.position.y = h * 0.62; group.add(sep)
    const top = mkMesh(box(w, 0.05, d), lm(0xffffff, { transparent: true, opacity: 0.4 })); top.position.y = h + 0.025; group.add(top)

  } else if (obj.id === 'sink') {
    // 씽크대: 야채 세척 공간
    w = 0.88; h = 0.88; d = 0.72
    const body = mkMesh(box(w, h, d), lm(baseColor)); body.position.y = h / 2; group.add(body)
    // 스테인리스 서라운드
    const surround = mkMesh(box(w + 0.04, 0.06, d + 0.04), lm(0xcfd8dc)); surround.position.y = h + 0.03; group.add(surround)
    // 깊은 세면대
    const bW = 0.58, bD = 0.48, bH = 0.20
    const basin = mkMesh(box(bW, bH, bD), lm(0xb0c4cc)); basin.position.set(0, h + bH / 2 + 0.025, 0); group.add(basin)
    const basinIn = mkMesh(box(bW - 0.07, bH - 0.05, bD - 0.07), lm(0x6e9aa8)); basinIn.position.set(0, h + (bH - 0.05) / 2 + 0.05, 0); group.add(basinIn)
    // 물 (파란 반투명)
    const water = mkMesh(box(bW - 0.09, 0.045, bD - 0.09), lm(0x38bdf8, { transparent: true, opacity: 0.52 }))
    water.position.set(0, h + 0.075, 0); group.add(water)
    // 씽크 속 야채들
    const veg1 = mkMesh(sph(0.072, 8), lm(0x4ade80)); veg1.scale.set(1.25, 0.55, 1.1); veg1.position.set(-0.10, h + 0.13, -0.04); group.add(veg1)
    const veg2 = mkMesh(sph(0.060, 8), lm(0x22c55e)); veg2.scale.set(0.85, 0.65, 1.0); veg2.position.set(0.10, h + 0.12, 0.08); group.add(veg2)
    const sinkTom = mkMesh(sph(0.060, 10), lm(0xef4444)); sinkTom.position.set(0.02, h + 0.13, -0.11); group.add(sinkTom)
    // 아치형 수전 — post(수직) + topBar(수평, z방향) + spout(하향)
    const post = mkMesh(cyl(0.025, 0.025, 0.36), lm(0xcfd8dc))
    post.position.set(0, h + bH + 0.21, -0.29); group.add(post)
    const topBar = mkMesh(cyl(0.022, 0.022, 0.44), lm(0xcfd8dc))
    topBar.rotation.x = Math.PI / 2; topBar.position.set(0, h + bH + 0.39, -0.07); group.add(topBar)
    const spout = mkMesh(cyl(0.024, 0.016, 0.13), lm(0xcfd8dc))
    spout.position.set(0, h + bH + 0.32, 0.15); group.add(spout)
    const knob = mkMesh(cyl(0.032, 0.032, 0.055, 8), lm(0x90a4ae))
    knob.rotation.z = Math.PI / 2; knob.position.set(0.10, h + bH + 0.39, -0.21); group.add(knob)
    // 물방울
    for (let i = 0; i < 3; i++) {
      const drop = mkMesh(sph(0.012, 6), lm(0x7dd3fc, { transparent: true, opacity: 0.72 }))
      drop.position.set(0.015 * (i - 1), h + bH + 0.25 - i * 0.055, 0.15); group.add(drop)
    }

  } else if (obj.id === 'grill') {
    // 불판: 패티+베이컨 조리 공간
    w = 0.95; h = 0.82; d = 0.76
    const body = mkMesh(box(w, h, d), lm(baseColor)); body.position.y = h / 2; group.add(body)
    // 불판 상판 (어두운 철판)
    const plate = mkMesh(box(w + 0.06, 0.07, d + 0.06), lm(0x1f2937)); plate.position.y = h + 0.035; group.add(plate)
    // 그릴 격자 (가로 3줄)
    for (let i = 0; i < 3; i++) {
      const bar = mkMesh(box(w - 0.08, 0.025, 0.04), lm(0x374151))
      bar.position.set(0, h + 0.085, -0.22 + i * 0.22); group.add(bar)
    }
    // 그릴 격자 (세로 3줄)
    for (let i = 0; i < 3; i++) {
      const bar = mkMesh(box(0.04, 0.025, d - 0.08), lm(0x374151))
      bar.position.set(-0.26 + i * 0.26, h + 0.085, 0); group.add(bar)
    }
    // 패티 (갈색 원기둥)
    const patty1 = mkMesh(cyl(0.14, 0.14, 0.038, 12), lm(0x7c3a15)); patty1.position.set(-0.15, h + 0.11, 0.06); group.add(patty1)
    // 베이컨 (얇은 핑크 직사각)
    const bacon1 = mkMesh(box(0.30, 0.025, 0.10), lm(0xfca5a5)); bacon1.position.set(0.14, h + 0.095, -0.08); group.add(bacon1)
    const bacon2 = mkMesh(box(0.28, 0.025, 0.10), lm(0xf87171)); bacon2.position.set(0.14, h + 0.12, 0.08); group.add(bacon2)
    // 연기 (반투명 구)
    const smoke1 = mkMesh(sph(0.08, 6), lm(0xd1d5db, { transparent: true, opacity: 0.45 })); smoke1.position.set(-0.15, h + 0.38, 0.06); group.add(smoke1)
    const smoke2 = mkMesh(sph(0.06, 6), lm(0xe5e7eb, { transparent: true, opacity: 0.35 })); smoke2.position.set(-0.10, h + 0.52, 0.00); group.add(smoke2)
    // 화로 레그 (다리 4개)
    ;[[-0.35, -0.30], [0.35, -0.30], [-0.35, 0.30], [0.35, 0.30]].forEach(([lx, lz]) => {
      const leg = mkMesh(cyl(0.025, 0.025, 0.12), lm(0x4b5563))
      leg.position.set(lx, 0.06, lz); group.add(leg)
    })

  } else if (obj.id === 'kitchen') {
    // 조리대: 버거 준비 공간
    w = 1.05; h = 0.85; d = 0.82
    const body = mkMesh(box(w, h, d), lm(baseColor)); body.position.y = h / 2; group.add(body)
    // 대리석 상판
    const top = mkMesh(box(w + 0.06, 0.08, d + 0.06), lm(0xf8f8f5)); top.position.y = h + 0.04; group.add(top)
    const edge = mkMesh(box(w + 0.06, 0.02, 0.02), lm(darkColor)); edge.position.set(0, h + 0.046, (d + 0.06) / 2); group.add(edge)
    // 나무 도마
    const board = mkMesh(box(0.50, 0.025, 0.36), lm(0xb5854a)); board.position.set(-0.08, h + 0.093, 0.06); group.add(board)
    // 미니 버거 레이어 (아래빵 → 패티 → 상추 → 토마토 → 위빵)
    const bunB = mkMesh(cyl(0.13, 0.15, 0.05, 14), lm(0xf59e0b)); bunB.position.set(-0.08, h + 0.131, 0.06); group.add(bunB)
    const patty = mkMesh(cyl(0.12, 0.13, 0.04, 14), lm(0x7c3a15)); patty.position.set(-0.08, h + 0.171, 0.06); group.add(patty)
    const lets = mkMesh(cyl(0.14, 0.14, 0.025, 12), lm(0x4ade80)); lets.position.set(-0.08, h + 0.211, 0.06); group.add(lets)
    const tomS = mkMesh(cyl(0.11, 0.11, 0.022, 12), lm(0xef4444)); tomS.position.set(-0.08, h + 0.235, 0.06); group.add(tomS)
    const bunT = mkMesh(sph(0.135, 12), lm(0xf59e0b)); bunT.scale.set(1.05, 0.62, 1.05); bunT.position.set(-0.08, h + 0.287, 0.06); group.add(bunT)
    // 참깨
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2
      const seed = mkMesh(sph(0.011, 5), lm(0xfef3c7))
      seed.position.set(-0.08 + Math.cos(ang) * 0.062, h + 0.325, 0.06 + Math.sin(ang) * 0.048); group.add(seed)
    }
    // 케첩 병
    const kBody = mkMesh(cyl(0.038, 0.043, 0.19), lm(0xdc2626)); kBody.position.set(0.30, h + 0.165, -0.08); group.add(kBody)
    const kCap = mkMesh(cyl(0.018, 0.028, 0.055), lm(0xfbbf24)); kCap.position.set(0.30, h + 0.278, -0.08); group.add(kCap)
    // 머스타드 병
    const mBody = mkMesh(cyl(0.035, 0.040, 0.17), lm(0xfbbf24)); mBody.position.set(0.30, h + 0.155, 0.10); group.add(mBody)
    const mCap = mkMesh(cyl(0.017, 0.026, 0.050), lm(0xdc2626)); mCap.position.set(0.30, h + 0.255, 0.10); group.add(mCap)
    // 뒤집개
    const spatH = mkMesh(cyl(0.017, 0.017, 0.30), lm(0x7c5c32)); spatH.rotation.x = Math.PI / 2; spatH.position.set(-0.34, h + 0.10, 0.01); group.add(spatH)
    const spatB = mkMesh(box(0.155, 0.012, 0.11), lm(0xd1d5db)); spatB.position.set(-0.34, h + 0.10, -0.20); group.add(spatB)

  } else if (obj.id === 'order') {
    w = 1.0; h = 0.9; d = 0.85
    const body = mkMesh(box(w, h, d), lm(baseColor)); body.position.y = h / 2; group.add(body)
    const top = mkMesh(box(w + 0.04, 0.06, d + 0.04), lm(darkColor)); top.position.y = h + 0.03; group.add(top)
    ;[[-0.2, 0.1], [0.1, 0.25], [-0.1, -0.15]].forEach(([bx, bz]) => {
      const pkg = mkMesh(box(0.3, 0.25, 0.3), lm(0xfed7aa)); pkg.position.set(bx, h + 0.16, bz); group.add(pkg)
      const tape = mkMesh(box(0.32, 0.03, 0.03), lm(0xfbbf24)); tape.position.set(bx, h + 0.29, bz); group.add(tape)
    })

  } else {
    return null
  }

  const shadow = mkMesh(cyl(0.4, 0.4, 0.02, 16), bm(0x000000, { transparent: true, opacity: 0.12 }))
  shadow.position.y = 0.01; group.add(shadow)
  group.userData = { objectId: obj.id, label: obj.label }
  group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
  scene.add(group)
  return group
}

/* ══ 캐릭터 빌더 ═════════════════════════════════════════════ */
function buildCharacter(type, t) {
  const skin  = lm(t.skin)
  const hair  = lm(t.hair)
  const eyeM  = bm(0x1a1a2e)
  const eyeHL = bm(0xffffff)
  const cheek = bm(0xfca5a5, { transparent: true, opacity: 0.7 })
  const group = new THREE.Group()

  const shadow = mkMesh(cyl(0.25, 0.25, 0.02, 16), bm(0x000000, { transparent: true, opacity: 0.15 }))
  shadow.position.y = 0.01; group.add(shadow)

  const pantColor = type === 'dad' ? 0x1d4ed8 : type === 'son' ? 0x60a5fa : 0xfda4af
  ;[[-0.1], [0.1]].forEach(([lx]) => {
    const leg = mkMesh(cyl(0.07, 0.07, 0.38), lm(pantColor))
    leg.position.set(lx, 0.22, 0); group.add(leg)
    const shoe = mkMesh(box(0.18, 0.09, 0.22), lm(type === 'son' ? 0xfbbf24 : 0x8b5e3c))
    shoe.position.set(lx, 0.06, 0.04); group.add(shoe)
  })

  let bodyColor = 0x93c5fd
  if (type === 'mom')      bodyColor = 0xfbbf24
  if (type === 'son')      bodyColor = 0x4ade80
  if (type === 'daughter') bodyColor = 0xfb7185

  if (type === 'mom' || type === 'daughter') {
    const skirt = mkMesh(cyl(0.32, 0.24, 0.38, 16), lm(type === 'mom' ? 0xf9a8d4 : 0xfda4af))
    skirt.position.y = 0.48; group.add(skirt)
  }

  const torso = mkMesh(box(0.38, 0.44, 0.28), lm(bodyColor))
  torso.position.y = 0.66; group.add(torso)

  if (type === 'dad') {
    ;[0.58, 0.68, 0.78, 0.88].forEach(ty => {
      const stripe = mkMesh(box(0.39, 0.04, 0.29), lm(0x3b82f6))
      stripe.position.y = ty; group.add(stripe)
    })
  }

  ;[{ ax: -0.26, ay: 0.7, rot: -0.25 }, { ax: 0.26, ay: 0.7, rot: 0.25 }].forEach(({ ax, ay, rot }) => {
    const arm = mkMesh(cyl(0.06, 0.06, 0.3), skin)
    arm.rotation.z = rot; arm.position.set(ax, ay, 0); group.add(arm)
    const hand = mkMesh(sph(0.08, 8), skin)
    hand.position.set(ax * 1.12, ay - 0.14, 0); group.add(hand)
  })

  const head = mkMesh(sph(0.3, 20), skin)
  head.scale.set(1, 0.92, 0.88); head.position.y = 1.18; group.add(head)

  const hairGeo = new THREE.SphereGeometry(0.31, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)
  const hairMesh = mkMesh(hairGeo, hair)
  hairMesh.position.y = 1.21; group.add(hairMesh)

  if (type === 'son') {
    const capBrim = mkMesh(cyl(0.34, 0.34, 0.05, 16), lm(0xfbbf24))
    capBrim.position.y = 1.44; group.add(capBrim)
    const capBody = mkMesh(cyl(0.26, 0.3, 0.26, 16), lm(0xfbbf24))
    capBody.position.y = 1.57; group.add(capBody)
  }

  if (type === 'mom' || type === 'daughter') {
    ;[[-0.18, 1.46], [0.18, 1.46]].forEach(([rx, ry]) => {
      const bow = mkMesh(new THREE.SphereGeometry(0.1, 8, 6, 0, Math.PI), lm(0xf472b6))
      bow.rotation.y = rx < 0 ? -0.5 : 0.5; bow.position.set(rx, ry, 0.06); group.add(bow)
    })
    const knot = mkMesh(sph(0.06, 8), lm(0xec4899))
    knot.position.set(0, 1.46, 0.06); group.add(knot)
  }

  if (type === 'daughter') {
    ;[[-0.35, 1.28], [0.35, 1.28]].forEach(([px, py]) => {
      const tail = mkMesh(cyl(0.1, 0.07, 0.32), lm(t.hairAlt || t.hair))
      tail.rotation.z = px < 0 ? 0.4 : -0.4; tail.position.set(px, py, 0); group.add(tail)
    })
  }

  ;[[-0.1, 1.22, 0.27], [0.1, 1.22, 0.27]].forEach(([ex, ey, ez]) => {
    const eye = mkMesh(sph(0.045, 8), eyeM); eye.position.set(ex, ey, ez); group.add(eye)
    const hl  = mkMesh(sph(0.02, 6), eyeHL); hl.position.set(ex + 0.025, ey + 0.025, ez + 0.01); group.add(hl)
  })

  ;[[-0.17, 1.15, 0.25], [0.17, 1.15, 0.25]].forEach(([cx, cy, cz]) => {
    const ch = mkMesh(sph(0.065, 8), cheek)
    ch.scale.set(1, 0.65, 0.6); ch.position.set(cx, cy, cz); group.add(ch)
  })

  const smileGeo = new THREE.TorusGeometry(0.07, 0.012, 6, 10, Math.PI)
  const smile = new THREE.Mesh(smileGeo, bm(0xc06050))
  smile.rotation.x = Math.PI; smile.position.set(0, 1.1, 0.28); group.add(smile)

  group.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true } })
  return group
}

/* ── 배지 애니메이션 CSS ─────────────────────────────────────── */
const BADGE_CSS = `
@keyframes bdBounce {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-6px); }
}
@keyframes bdPulse {
  0%, 100% { transform: scale(1);    opacity: 1; }
  50%      { transform: scale(0.88); opacity: 0.78; }
}
@keyframes bdWiggle {
  0%, 100% { transform: rotate(0deg); }
  25%      { transform: rotate(-14deg); }
  75%      { transform: rotate(14deg); }
}
`

/* ══ 메인 컴포넌트 ═══════════════════════════════════════════ */
export default function GameRoom3D({
  farmTomato, farmLettuce, inventory, grill,
  carrying, otherPlayerPos, otherPlayerRole,
  onInteract, onPositionChange,
  theme = 'modern',
}) {
  const role = useGameStore(s => s.role)
  const canvasRef = useRef(null)

  const startPos = { x: 220, y: 340 }
  const [pos,    setPos]    = useState(startPos)
  const [nearby, setNearby] = useState(null)

  const posRef     = useRef(startPos)
  const facingRef  = useRef('right')
  const keysRef    = useRef({})
  const rafRef     = useRef(null)
  const posyncRef  = useRef(0)
  const nearbyRef  = useRef(null)  // change-detection — avoids setNearby every frame

  const sceneRef   = useRef(null)
  const camRef     = useRef(null)
  const rendRef    = useRef(null)
  const charRef    = useRef(null)
  const otherRef   = useRef(null)
  const objMeshRef = useRef([])
  const raycasterRef = useRef(null)
  const bsRef      = useRef({ tomato: null, lettuce: null })  // beanstalk groups
  const grillRef   = useRef(grill)  // grill state for animation
  useEffect(() => { grillRef.current = grill }, [grill])

  function findNearby2D(p) {
    return OBJS.find(o => d2(p, o) < INTERACT_D) ?? null
  }

  /* ── 씬 초기화 ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (rendRef.current) return   // StrictMode double-mount guard

    const t = THEMES[theme] || THEMES.modern
    if (!raycasterRef.current) raycasterRef.current = new THREE.Raycaster()

    let renderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    } catch (e) { return }

    renderer.setSize(CW, CH)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap   // PCFSoftShadowMap deprecated in r183
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    rendRef.current = renderer

    const scene = buildScene(theme)
    sceneRef.current = scene

    if (theme === 'modern') {
      buildHydroponicUnit(scene, t, 'tomato',  v3(140, 140))
      buildHydroponicUnit(scene, t, 'lettuce', v3(140, 285))
    } else {
      buildFarmBed(scene, t, 'tomato',  v3(140, 140))
      buildFarmBed(scene, t, 'lettuce', v3(140, 285))
    }

    // 잭과 콩나물 이벤트 콩나물 (기본 hidden)
    bsRef.current.tomato  = buildBeanstalk(scene, v3(140, 140))
    bsRef.current.lettuce = buildBeanstalk(scene, v3(140, 285))

    const meshes = []
    for (const obj of OBJS) {
      if (obj.id === 'farm_tomato' || obj.id === 'farm_lettuce') {
        const clickMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 1.2, 2.0),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }),
        )
        clickMesh.position.copy(v3(obj.x, obj.y, 0.6))
        clickMesh.userData = { objectId: obj.id, label: obj.label }
        scene.add(clickMesh); meshes.push(clickMesh)
      } else {
        const mesh = buildObject3D(scene, t, obj)
        if (mesh) meshes.push(mesh)
      }
    }
    objMeshRef.current = meshes

    const charType  = role === 'parent' ? 'mom' : 'son'
    const char = buildCharacter(charType, t)
    const sp3 = v3(startPos.x, startPos.y)
    char.position.set(sp3.x, 0, sp3.z)
    scene.add(char); charRef.current = char

    const otherType = role === 'parent' ? 'dad' : 'daughter'
    const other = buildCharacter(otherType, t)
    other.visible = false; scene.add(other); otherRef.current = other

    const aspect = CW / CH, fH = 9.5
    const camera = new THREE.OrthographicCamera(
      -fH * aspect / 2, fH * aspect / 2, fH / 2, -fH / 2, 0.1, 120,
    )
    camera.position.set(18, 10, 18)
    camera.lookAt(new THREE.Vector3(ROOM.W / 2 - 0.5, 0, ROOM.D / 2))
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)   // 행렬 즉시 초기화 (핵심 수정)
    camRef.current = camera

    return () => {
      if (rendRef.current === renderer) rendRef.current = null
      camRef.current = null; charRef.current = null; otherRef.current = null
      objMeshRef.current = []; sceneRef.current = null; raycasterRef.current = null
      bsRef.current = { tomato: null, lettuce: null }
      renderer.dispose()
      scene.traverse(obj => {
        if (!obj.isMesh) return
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose())
        else obj.material.dispose?.()
      })
    }
  }, [theme, role])

  /* ── 농장 상태 → 콩나물 가시성 ── */
  useEffect(() => {
    if (bsRef.current.tomato)  bsRef.current.tomato.visible  = farmTomato?.beanstalk  === true
    if (bsRef.current.lettuce) bsRef.current.lettuce.visible = farmLettuce?.beanstalk === true
  }, [farmTomato, farmLettuce])

  /* ── 키보드 ── */
  useEffect(() => {
    function onDown(e) {
      keysRef.current[e.key] = true
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault()
      if (e.key === 'a' || e.key === 'A') {
        const near = findNearby2D(posRef.current)
        if (near) onInteract?.(near.id)
      }
    }
    function onUp(e) { keysRef.current[e.key] = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp) }
  }, [onInteract])

  /* ── 게임 루프 ── */
  useEffect(() => {
    let frame = 0
    function loop() {
      rafRef.current = requestAnimationFrame(loop)
      frame++

      const k = keysRef.current
      let { x, y } = posRef.current
      let moved = false, dx = 0, dy = 0

      if (k['ArrowUp'])    { dy -= SPEED; facingRef.current = 'up';    moved = true }
      if (k['ArrowDown'])  { dy += SPEED; facingRef.current = 'down';  moved = true }
      if (k['ArrowLeft'])  { dx -= SPEED; facingRef.current = 'left';  moved = true }
      if (k['ArrowRight']) { dx += SPEED; facingRef.current = 'right'; moved = true }

      const nx = clp(x + dx, CHAR_R + 118, CW - CHAR_R)
      const ny = clp(y + dy, CHAR_R, CH - CHAR_R)
      if (!collides(nx, y)) x = nx
      if (!collides(x, ny)) y = ny
      posRef.current = { x, y }

      if (moved) {
        setPos({ x, y })
        const now = Date.now()
        if (now - posyncRef.current > 500) {
          posyncRef.current = now
          onPositionChange?.({ x, y })
        }
      }

      const nearObj = findNearby2D({ x, y })
      const newNearby = nearObj?.id ?? null
      if (newNearby !== nearbyRef.current) {
        nearbyRef.current = newNearby
        setNearby(newNearby)   // change-detected: 불필요 re-render 방지
      }

      const char = charRef.current
      if (char) {
        const tp = v3(x, y)
        char.position.x += (tp.x - char.position.x) * 0.25
        char.position.z += (tp.z - char.position.z) * 0.25
        const f = facingRef.current
        if (f === 'left')  char.rotation.y =  Math.PI * 0.8
        if (f === 'right') char.rotation.y = -Math.PI * 0.2
        if (f === 'up')    char.rotation.y =  Math.PI * 0.5
        if (f === 'down')  char.rotation.y = -Math.PI * 0.5
        char.position.y = moved ? Math.abs(Math.sin(frame * 0.2)) * 0.06 : 0
      }

      const other = otherRef.current
      if (other && otherPlayerPos) {
        other.visible = true
        const op = v3(otherPlayerPos.x, otherPlayerPos.y)
        other.position.x += (op.x - other.position.x) * 0.1
        other.position.z += (op.z - other.position.z) * 0.1
        other.position.y = 0
      } else if (other) { other.visible = false }

      // 오브젝트 하이라이트 (Lambert만 emissive 지원)
      const nearId = newNearby
      objMeshRef.current.forEach(m => {
        const id = m.userData.objectId
        if (!id) return
        const isNear = nearId === id
        m.traverse(child => {
          if (!child.isMesh || !child.material) return
          setEmissive(child.material, isNear ? 0xffcc44 : 0x000000, isNear ? 0.25 : 0)
        })
      })

      // 콩나물 애니메이션 (active 시 살짝 흔들림)
      const bs = bsRef.current
      if (bs.tomato?.visible)  bs.tomato.rotation.y  = Math.sin(frame * 0.015) * 0.06
      if (bs.lettuce?.visible) bs.lettuce.rotation.y = Math.sin(frame * 0.015 + 1) * 0.06

      // 불판 불꽃 emissive 펄싱
      const grillStage = grillRef.current?.stage ?? 'idle'
      if (grillStage === 'grilling' || grillStage === 'done') {
        const grillMesh = objMeshRef.current.find(m => m.userData.objectId === 'grill')
        if (grillMesh) {
          const intensity = grillStage === 'grilling'
            ? 0.18 + Math.sin(frame * 0.14) * 0.12
            : 0.08 + Math.sin(frame * 0.08) * 0.05
          const color = grillStage === 'grilling' ? 0xff5500 : 0x44cc44
          grillMesh.traverse(child => {
            if (!child.isMesh || !child.material) return
            setEmissive(child.material, color, intensity)
          })
        }
      }

      if (rendRef.current && sceneRef.current && camRef.current) {
        rendRef.current.render(sceneRef.current, camRef.current)
      }
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [onPositionChange, otherPlayerPos])

  /* ── 클릭 → Raycaster ── */
  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current; const cam = camRef.current; const rc = raycasterRef.current
    if (!canvas || !cam || !rc) return
    const rect = canvas.getBoundingClientRect()
    const mx = ((e.clientX - rect.left)  / rect.width)  * 2 - 1
    const my = -((e.clientY - rect.top) / rect.height) * 2 + 1
    rc.setFromCamera({ x: mx, y: my }, cam)
    const hits = rc.intersectObjects(objMeshRef.current, true)
    if (hits.length > 0) {
      let obj = hits[0].object
      while (obj && !obj.userData.objectId) obj = obj.parent
      if (obj?.userData.objectId) onInteract?.(obj.userData.objectId)
    }
  }, [onInteract])

  /* ── 배지 (순수 2D 계산 — Three.js 호출 없음) ── */
  function getBadge(id) {
    const farm = id === 'farm_tomato' ? farmTomato : id === 'farm_lettuce' ? farmLettuce : null
    const cropEmoji = id === 'farm_tomato' ? '🍅' : '🥬'
    if (farm) {
      if (farm.beanstalk)                          return { emojis: ['🌿','🌿','🌿'], anim: 'wiggle', bg: 'rgba(21,128,61,0.9)'   }
      if (farm.stage === 'flowering')              return { emojis: ['💧','💧'],       anim: 'bounce', bg: 'rgba(59,130,246,0.9)'  }
      if (farm.stage === 'ready')                  return { emojis: [cropEmoji,'✨'],  anim: 'bounce', bg: 'rgba(22,163,74,0.9)'   }
      if (farm.stage === 'watered')                return { emojis: ['🌿','💧'],       anim: 'pulse',  bg: 'rgba(13,148,136,0.88)' }
      if (['seed','growing'].includes(farm.stage)) return { emojis: ['🌱'],            anim: 'pulse',  bg: 'rgba(101,163,13,0.88)' }
    }
    if (id === 'fridge') {
      const t = inventory?.tomatoes || 0
      const l = inventory?.lettuces || 0
      if (t === 0 && l === 0) return null
      const items = []
      for (let i = 0; i < Math.min(t, 2); i++) items.push('🍅')
      for (let i = 0; i < Math.min(l, 2); i++) items.push('🥬')
      return { emojis: items, anim: null, bg: 'rgba(22,163,74,0.9)' }
    }
    if (id === 'grill') {
      const gs = grill?.stage ?? 'idle'
      if (gs === 'grilling') return { emojis: ['🥩','🥓','🔥'], anim: 'pulse',  bg: 'rgba(234,88,12,0.93)'  }
      if (gs === 'done')     return { emojis: ['🥩','🥓','✅'], anim: 'bounce', bg: 'rgba(22,163,74,0.93)'  }
    }
    if ((id === 'sink' || id === 'fridge') && carrying) return { emojis: ['🧺'], anim: 'bounce', bg: 'rgba(217,119,6,0.9)' }
    return null
  }

  const nearObj = OBJS.find(o => o.id === nearby)

  return (
    <div className="relative select-none" style={{ width: CW, height: CH }}>
      <style>{BADGE_CSS}</style>

      {/* Three.js 캔버스 */}
      <canvas
        ref={canvasRef}
        width={CW} height={CH}
        className="rounded-3xl cursor-pointer"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.22), inset 0 0 0 2px rgba(255,255,255,0.1)' }}
        onClick={handleCanvasClick}
      />

      {/* ── 오브젝트 배지 ─────────────────────────────────────
          핵심 수정: Three.js Vector3.project(cam) 호출 제거.
          OBJS.x, OBJS.y 는 이미 캔버스 픽셀 좌표.
      ───────────────────────────────────────────────────── */}
      {OBJS.map(obj => {
        const badge = getBadge(obj.id)
        if (!badge) return null
        const animProp = badge.anim === 'bounce' ? 'bdBounce 0.9s ease-in-out infinite'
          : badge.anim === 'pulse'  ? 'bdPulse 1.5s ease-in-out infinite'
          : badge.anim === 'wiggle' ? 'bdWiggle 0.75s ease-in-out infinite'
          : undefined
        return (
          <div
            key={`badge-${obj.id}`}
            className="absolute pointer-events-none"
            style={{ left: obj.x, top: obj.y - 58, transform: 'translate(-50%, -100%)', zIndex: 20 }}
          >
            <div
              className="flex items-center gap-0.5 rounded-2xl shadow-lg"
              style={{ animation: animProp, background: badge.bg, padding: '4px 8px', fontSize: 19 }}
            >
              {badge.emojis.map((e, i) => <span key={i}>{e}</span>)}
            </div>
          </div>
        )
      })}

      {/* ── 인터랙션 프롬프트 ── */}
      {nearObj && (
        <div
          className="absolute pointer-events-none font-black text-white whitespace-nowrap rounded-xl shadow-xl px-3 py-1.5"
          style={{
            left: nearObj.x,
            top:  nearObj.y - 58,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(20,10,5,0.88)',
            fontSize: 12, zIndex: 30,
          }}
        >
          {carrying && (nearObj.id === 'fridge' || nearObj.id === 'sink')
            ? '[A] 🧺 보관하기'
            : `[A] ${nearObj.label}`}
        </div>
      )}

      {/* ── 운반 말풍선 ── */}
      {carrying && (
        <div
          className="absolute pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-2xl shadow-xl font-black text-sm"
          style={{
            left: pos.x,
            top:  pos.y - 42,
            transform: 'translate(-50%, -100%)',
            background: 'white', border: '2.5px solid #f59e0b', color: '#92400e', zIndex: 30,
          }}
        >
          <span style={{ fontSize: 20 }}>{carrying.emoji}</span>
          <span>{carrying.qty}개</span>
        </div>
      )}

      {/* ── 모바일 D-패드 ── */}
      <DPad keysRef={keysRef} theme={theme}
        onAction={() => { const n = findNearby2D(posRef.current); if (n) onInteract?.(n.id) }} />
    </div>
  )
}

/* ── D-패드 (frosted glass 원형) ─────────────────────────────── */
function DPad({ keysRef, onAction, theme }) {
  const press = (key, down) => { keysRef.current[key] = down }
  const btnStyle = {
    width: 52, height: 52, borderRadius: '50%',
    background: 'rgba(255,252,248,0.28)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.55), 0 4px 0 rgba(0,0,0,0.14)',
    fontSize: 20, fontWeight: 900,
    color: 'rgba(50,34,20,0.82)',
    border: '1.5px solid rgba(255,255,255,0.45)',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    userSelect: 'none', touchAction: 'none',
    transition: 'transform 0.06s, box-shadow 0.06s',
  }
  const dir = (label, key) => (
    <button key={key} style={btnStyle}
      onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.9)'; press(key, true) }}
      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; press(key, false) }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; press(key, false) }}
      onPointerCancel={(e) => { e.currentTarget.style.transform = 'scale(1)'; press(key, false) }}
    >{label}</button>
  )
  return (
    <div className="absolute bottom-4 left-4 z-30 flex gap-3 items-end" style={{ opacity: 0.96 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 52px)', gap: 4 }}>
        <div />{dir('↑', 'ArrowUp')}<div />
        {dir('←', 'ArrowLeft')}{dir('↓', 'ArrowDown')}{dir('→', 'ArrowRight')}
      </div>
      <button
        style={{
          ...btnStyle,
          width: 60, height: 60,
          background: '#C87B4F',
          color: 'white',
          fontSize: 18,
          fontWeight: 900,
          border: '1.5px solid rgba(255,200,160,0.5)',
          boxShadow: '0 3px 12px rgba(200,123,79,0.45), 0 5px 0 rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,200,160,0.6)',
        }}
        onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.9)'; onAction() }}
        onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
        onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      >A</button>
    </div>
  )
}
