/**
 * 씽크대 채소 씻기 미니게임
 * - 좌우 버튼을 번갈아 눌러 헹구기 (6번)
 * - 완료 시 onWashComplete(cropType, qty) 콜백 → 냉장고에 저장
 */
import { useState } from 'react'

const WASH_STEPS = 6  // 좌우 번갈아 6번 = 각 3회

export default function Sink({ carrying, onWashComplete, onClose }) {
  const [count,   setCount]   = useState(0)
  const [nextDir, setNextDir] = useState('left')  // 'left' | 'right'
  const [flash,   setFlash]   = useState(null)    // 'ok' | 'wrong' | null
  const [done,    setDone]    = useState(false)

  const pct = Math.round((count / WASH_STEPS) * 100)

  function handlePress(dir) {
    if (done) return
    if (dir === nextDir) {
      const next = count + 1
      setCount(next)
      setFlash('ok')
      setNextDir(dir === 'left' ? 'right' : 'left')
      setTimeout(() => setFlash(null), 180)
      if (next >= WASH_STEPS) {
        setDone(true)
        setTimeout(() => onWashComplete?.(carrying?.type, carrying?.qty ?? 1), 800)
      }
    } else {
      setFlash('wrong')
      setTimeout(() => setFlash(null), 300)
    }
  }

  const waterDrops = Array.from({ length: count }, (_, i) => i)

  return (
    <div className="flex flex-col items-center gap-5">
      <h2 className="text-2xl font-black text-blue-700">🚿 채소 씻기</h2>

      {/* 채소 + 물방울 애니메이션 */}
      <div className="relative flex items-center justify-center w-32 h-32">
        {/* 물방울 */}
        {waterDrops.map((_, i) => (
          <span
            key={i}
            className="absolute text-blue-400 text-lg pointer-events-none select-none"
            style={{
              top: `${25 + (i % 3) * 18}%`,
              left: `${15 + (i % 2) * 55}%`,
              opacity: 0.7,
              transform: `rotate(${(i * 47) % 360}deg)`,
            }}
          >
            💧
          </span>
        ))}
        <span
          className={`text-7xl transition-all duration-100 z-10
            ${flash === 'ok'    ? 'scale-125 -translate-y-1' :
              flash === 'wrong' ? 'rotate-6 scale-95' : 'scale-100'}`}
        >
          {carrying?.emoji ?? '🥦'}
        </span>
      </div>

      <p className="text-sm font-bold text-gray-500">{carrying?.label} {carrying?.qty}개</p>

      {/* 진행 바 */}
      <div className="w-full bg-blue-100 rounded-full h-5 overflow-hidden">
        <div
          className="bg-blue-500 h-full rounded-full transition-all duration-200 flex items-center justify-end pr-2"
          style={{ width: `${pct}%` }}
        >
          {pct >= 30 && (
            <span className="text-white text-xs font-black">{pct}%</span>
          )}
        </div>
      </div>

      {done ? (
        <div className="text-center">
          <p className="text-5xl mb-1 animate-bounce">✨</p>
          <p className="text-xl font-black text-blue-700">깨끗하게 씻었어요!</p>
          <p className="text-sm text-blue-500 mt-1">냉장고에 넣는 중...</p>
        </div>
      ) : (
        <>
          <p className="text-base font-bold text-gray-600">
            {nextDir === 'left' ? '← 왼쪽으로 헹구기' : '오른쪽으로 헹구기 →'}
          </p>

          {flash === 'wrong' && (
            <p className="text-red-500 font-black text-sm animate-bounce">❌ 반대 방향이에요!</p>
          )}

          <div className="flex gap-3 w-full">
            <button
              onPointerDown={() => handlePress('left')}
              className={`flex-1 py-5 rounded-2xl text-xl font-black shadow-sm
                active:scale-95 transition-all duration-100 select-none touch-none
                ${nextDir === 'left'
                  ? 'bg-blue-500 text-white scale-105 shadow-blue-200 shadow-lg'
                  : 'bg-gray-100 text-gray-400'}`}
            >
              ← 왼쪽
            </button>
            <button
              onPointerDown={() => handlePress('right')}
              className={`flex-1 py-5 rounded-2xl text-xl font-black shadow-sm
                active:scale-95 transition-all duration-100 select-none touch-none
                ${nextDir === 'right'
                  ? 'bg-blue-500 text-white scale-105 shadow-blue-200 shadow-lg'
                  : 'bg-gray-100 text-gray-400'}`}
            >
              오른쪽 →
            </button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            💡 좌우 버튼을 번갈아 눌러 채소를 씻어요
          </p>
        </>
      )}

      {!done && (
        <button onClick={onClose} className="text-gray-400 underline text-sm">
          나중에 씻을게요
        </button>
      )}
    </div>
  )
}
