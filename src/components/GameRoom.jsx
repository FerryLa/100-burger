/**
 * GameRoom – 2D 탑다운 방
 * 방향키: 이동 / A: 상호작용 / S,D: 보조 액션
 * 모바일: 화면 하단 D-패드 버튼
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/useGameStore'

const ROOM_W = 600
const ROOM_H = 420
const CHAR_R = 22   // 캐릭터 반지름
const SPEED  = 3    // 픽셀/프레임
const INTERACT_D = 68 // 상호작용 거리

// ─── 오브젝트 위치 정의 ───────────────────────────────────────────────────────
const OBJECTS = [
  { id: 'farm',   emoji: '🌱', label: '농장',    x: 90,  y: 80  },
  { id: 'fridge', emoji: '❄️', label: '냉장고',  x: 480, y: 80  },
  { id: 'sink',   emoji: '🚰', label: '씽크대',  x: 90,  y: 290 },
  { id: 'stove',  emoji: '🔥', label: '화로',    x: 300, y: 340 },
  { id: 'order',  emoji: '📦', label: '발주대',  x: 480, y: 290 },
  { id: 'kitchen',emoji: '🍳', label: '주방',    x: 300, y: 160 },
]

// ─── 벽/가구 충돌 영역 (AABB) ─────────────────────────────────────────────────
const WALLS = [
  { x: 60,  y: 50,  w: 70, h: 70 },  // 농장 테이블
  { x: 450, y: 50,  w: 70, h: 70 },  // 냉장고
  { x: 60,  y: 260, w: 70, h: 70 },  // 씽크대
  { x: 270, y: 310, w: 70, h: 70 },  // 화로
  { x: 450, y: 260, w: 70, h: 70 },  // 발주대
  { x: 270, y: 130, w: 70, h: 70 },  // 주방 카운터
]

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

function collidesWall(x, y) {
  for (const w of WALLS) {
    if (x > w.x - CHAR_R && x < w.x + w.w + CHAR_R &&
        y > w.y - CHAR_R && y < w.y + w.h + CHAR_R) {
      return true
    }
  }
  return false
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function GameRoom({ farmStage, inventory, onInteract }) {
  const role = useGameStore(s => s.role)

  const [pos,    setPos]    = useState({ x: 300, y: 220 })
  const [facing, setFacing] = useState('down')
  const [nearby, setNearby] = useState(null)

  const posRef  = useRef({ x: 300, y: 220 })
  const keysRef = useRef({})
  const rafRef  = useRef(null)

  // 키보드 핸들러
  useEffect(() => {
    function onDown(e) {
      keysRef.current[e.key] = true
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault()
      }
      // A 키: 상호작용
      if (e.key === 'a' || e.key === 'A') {
        const near = findNearby(posRef.current)
        if (near) onInteract?.(near.id, 'A')
      }
      // S 키: 보조
      if (e.key === 's' || e.key === 'S') {
        const near = findNearby(posRef.current)
        if (near) onInteract?.(near.id, 'S')
      }
      // D 키: 3차
      if (e.key === 'd' || e.key === 'D') {
        const near = findNearby(posRef.current)
        if (near) onInteract?.(near.id, 'D')
      }
    }
    function onUp(e) { keysRef.current[e.key] = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup',   onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup',   onUp)
    }
  }, [onInteract])

  // 게임 루프
  useEffect(() => {
    function loop() {
      const k = keysRef.current
      let { x, y } = posRef.current
      let dir = facing
      let moved = false

      let dx = 0, dy = 0
      if (k['ArrowUp']   ) { dy -= SPEED; dir = 'up';    moved = true }
      if (k['ArrowDown'] ) { dy += SPEED; dir = 'down';  moved = true }
      if (k['ArrowLeft'] ) { dx -= SPEED; dir = 'left';  moved = true }
      if (k['ArrowRight']) { dx += SPEED; dir = 'right'; moved = true }

      // 충돌 처리: X, Y 축 분리
      const nx = clamp(x + dx, CHAR_R, ROOM_W - CHAR_R)
      const ny = clamp(y + dy, CHAR_R, ROOM_H - CHAR_R)
      if (!collidesWall(nx, y))  x = nx
      if (!collidesWall(x,  ny)) y = ny

      posRef.current = { x, y }

      if (moved) {
        setFacing(dir)
        setPos({ x, y })
      }

      // 근접 오브젝트 감지
      const near = findNearby({ x, y })
      setNearby(near?.id ?? null)

      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  function findNearby(p) {
    return OBJECTS.find(o => dist(p, o) < INTERACT_D) ?? null
  }

  // 오브젝트 상태 배지
  function getObjectBadge(id) {
    if (id === 'farm') {
      if (farmStage === 'flowering') return { text: '물 줘요!', color: 'bg-blue-500' }
      if (farmStage === 'ready')     return { text: '수확!',    color: 'bg-green-500' }
      if (farmStage === 'watered')   return { text: '자라는 중', color: 'bg-teal-400' }
    }
    if (id === 'fridge') {
      const v = inventory?.veggies || 0
      if (v === 0) return { text: '비었어요', color: 'bg-gray-400' }
      return { text: `채소 ${v}개`, color: 'bg-green-500' }
    }
    return null
  }

  // 캐릭터 이모지 (방향 반영)
  const charBase = role === 'parent' ? '👩' : '👦'
  const flipX    = facing === 'left'

  return (
    <div className="relative select-none" style={{ width: ROOM_W, height: ROOM_H }}>

      {/* 바닥 */}
      <div
        className="absolute inset-0 rounded-3xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg,#fef3e2 0%,#fde8c8 100%)' }}
      >
        {/* 격자 패턴 */}
        <svg width="100%" height="100%" style={{ opacity: 0.12 }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#a0522d" strokeWidth="0.8"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* 오브젝트 */}
      {OBJECTS.map(obj => {
        const isNear  = nearby === obj.id
        const badge   = getObjectBadge(obj.id)
        return (
          <div
            key={obj.id}
            className="absolute flex flex-col items-center"
            style={{ left: obj.x - 35, top: obj.y - 35, width: 70, zIndex: 10 }}
            onClick={() => onInteract?.(obj.id, 'A')}
          >
            {/* 상태 배지 */}
            {badge && (
              <div className={`${badge.color} text-white text-xs font-bold px-2 py-0.5 rounded-full mb-1 whitespace-nowrap`}>
                {badge.text}
              </div>
            )}

            {/* 오브젝트 아이콘 */}
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl
                shadow-md transition-all duration-150 cursor-pointer
                ${isNear ? 'bg-yellow-200 ring-2 ring-yellow-400 scale-110 shadow-yellow-300 shadow-lg' : 'bg-white'}`}
            >
              {obj.emoji}
            </div>
            <span className="text-xs text-gray-500 font-bold mt-0.5">{obj.label}</span>

            {/* 상호작용 프롬프트 */}
            {isNear && (
              <div className="absolute -top-10 bg-black/75 text-white text-xs px-2 py-1 rounded-lg
                             whitespace-nowrap animate-bounce z-20">
                [A] {obj.label}
              </div>
            )}
          </div>
        )
      })}

      {/* 캐릭터 */}
      <div
        className="absolute pointer-events-none z-20"
        style={{
          left: pos.x - 20,
          top:  pos.y - 28,
          transform: flipX ? 'scaleX(-1)' : 'none',
          transition: 'none',
        }}
      >
        <div className="text-4xl leading-none text-center">{charBase}</div>
        {nearby && (
          <div className="bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5
                          rounded-full text-center mt-0.5 whitespace-nowrap">
            A
          </div>
        )}
      </div>

      {/* 모바일 D-패드 */}
      <MobileDpad keysRef={keysRef} />
    </div>
  )
}

// ─── 모바일 D-패드 ────────────────────────────────────────────────────────────

function MobileDpad({ keysRef }) {
  function press(key, down) {
    keysRef.current[key] = down
  }
  const btn = (label, key) => (
    <button
      key={key}
      className="w-12 h-12 bg-white/80 rounded-xl font-bold text-xl shadow
                 active:bg-amber-200 select-none touch-none flex items-center justify-center"
      onPointerDown={() => press(key, true)}
      onPointerUp={() => press(key, false)}
      onPointerLeave={() => press(key, false)}
      onPointerCancel={() => press(key, false)}
    >
      {label}
    </button>
  )

  return (
    <div className="absolute bottom-3 left-3 opacity-75 z-30">
      <div className="grid grid-cols-3 gap-1">
        <div />{btn('↑', 'ArrowUp')}<div />
        {btn('←', 'ArrowLeft')}{btn('↓', 'ArrowDown')}{btn('→', 'ArrowRight')}
      </div>
    </div>
  )
}
