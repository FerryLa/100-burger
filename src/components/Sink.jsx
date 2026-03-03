/**
 * 씽크대 채소 씻기 미니게임
 * - 좌우 버튼을 번갈아 눌러 헹구기 (6번)
 * - 완료 시 onWashComplete(cropType, qty) 콜백 → 냉장고에 저장
 */
import { useState, useEffect, useRef } from 'react'

const WASH_STEPS = 6

const waterCSS = `
@keyframes dropFall {
  0%   { transform: translateY(-8px) scaleY(0.7); opacity: 0.9; }
  80%  { opacity: 0.8; }
  100% { transform: translateY(56px) scaleY(1.3); opacity: 0; }
}
@keyframes splashOut {
  0%   { transform: scale(0) rotate(0deg);   opacity: 1; }
  60%  { opacity: 0.7; }
  100% { transform: scale(1.8) rotate(30deg); opacity: 0; }
}
@keyframes streamFlow {
  0%,100% { scaleX: 1;   opacity: 0.7; }
  50%      { scaleX: 1.1; opacity: 0.9; }
}
@keyframes ripple {
  0%   { transform: scale(0.3); opacity: 0.8; }
  100% { transform: scale(2.5); opacity: 0; }
}
@keyframes bubbleRise {
  0%   { transform: translateY(0)   scale(1);   opacity: 0.8; }
  100% { transform: translateY(-40px) scale(1.4); opacity: 0; }
}
@keyframes vegShake {
  0%,100% { transform: translateX(0)   rotate(0deg); }
  25%      { transform: translateX(-5px) rotate(-4deg); }
  75%      { transform: translateX(5px)  rotate(4deg); }
}
.drop-anim  { animation: dropFall   0.55s ease-in infinite; }
.splash-anim{ animation: splashOut  0.4s ease-out forwards; }
.ripple-anim{ animation: ripple     0.5s ease-out forwards; }
.bubble-anim{ animation: bubbleRise 0.9s ease-out infinite; }
.veg-shake  { animation: vegShake   0.15s ease-in-out 2; }
`

/* 개별 물방울 컴포넌트 */
function WaterDrop({ style }) {
  return (
    <div
      className="absolute drop-anim rounded-full"
      style={{
        width: 6, height: 14,
        background: 'linear-gradient(180deg, #93c5fd, #3b82f6)',
        borderRadius: '50% 50% 60% 60%',
        ...style,
      }}
    />
  )
}

/* 스플래시 파티클 */
function SplashParticles({ active }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * 360
        const dist  = 28 + (i % 3) * 12
        const rad   = (angle * Math.PI) / 180
        return (
          <div
            key={i}
            className="absolute splash-anim"
            style={{
              width: 6, height: 6,
              borderRadius: '50%',
              background: '#60a5fa',
              top:  '50%',
              left: '50%',
              transformOrigin: '50% 50%',
              marginLeft: Math.cos(rad) * dist,
              marginTop:  Math.sin(rad) * dist,
              animationDelay: `${i * 0.03}s`,
            }}
          />
        )
      })}
    </div>
  )
}

/* 거품 버블 */
function Bubbles({ count }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute bubble-anim rounded-full border border-blue-300"
          style={{
            width:  8 + (i % 3) * 5,
            height: 8 + (i % 3) * 5,
            bottom: 10 + (i % 4) * 8,
            left:   `${20 + (i * 23) % 60}%`,
            background: 'rgba(147,197,253,0.4)',
            animationDelay: `${i * 0.2}s`,
            animationDuration: `${0.8 + i * 0.1}s`,
          }}
        />
      ))}
    </>
  )
}

export default function Sink({ carrying, onWashComplete, onClose }) {
  const [count,   setCount]   = useState(0)
  const [nextDir, setNextDir] = useState('left')
  const [flash,   setFlash]   = useState(null)   // 'ok' | 'wrong' | null
  const [done,    setDone]    = useState(false)
  const [splash,  setSplash]  = useState(false)
  const [shake,   setShake]   = useState(false)
  const dropTimerRef = useRef(null)

  const pct = Math.round((count / WASH_STEPS) * 100)

  // 물방울 위치 배열 (진행도에 따라 개수 증가)
  const dropCount = Math.min(count * 2 + 1, 12)

  function handlePress(dir) {
    if (done) return
    if (dir === nextDir) {
      const next = count + 1
      setCount(next)
      setNextDir(dir === 'left' ? 'right' : 'left')
      setSplash(true)
      setShake(true)
      setTimeout(() => setSplash(false), 420)
      setTimeout(() => setShake(false),  350)
      if (next >= WASH_STEPS) {
        setDone(true)
        setTimeout(() => onWashComplete?.(carrying?.type, carrying?.qty ?? 1), 900)
      }
    } else {
      setFlash('wrong')
      setTimeout(() => setFlash(null), 300)
    }
  }

  return (
    <>
      <style>{waterCSS}</style>
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-black text-blue-700">🚿 채소 씻기</h2>

        {/* 씽크대 씬 */}
        <div className="relative w-full flex justify-center">
          {/* 싱크 볼 */}
          <div
            className="relative rounded-b-3xl overflow-hidden"
            style={{
              width: 160, height: 90,
              background: 'linear-gradient(180deg, #e2e8f0, #cbd5e1)',
              border: '3px solid #94a3b8',
              borderTop: 'none',
            }}
          >
            {/* 물 고임 */}
            <div
              className="absolute bottom-0 left-0 right-0 transition-all duration-300"
              style={{
                height: `${15 + pct * 0.35}%`,
                background: `rgba(59,130,246,${0.25 + pct * 0.003})`,
                borderTop: '2px solid rgba(147,197,253,0.6)',
              }}
            />
            {/* 버블 */}
            {count > 0 && <Bubbles count={Math.min(count, 5)} />}
            {/* 배수구 */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-5 h-1.5 bg-gray-400 rounded-full opacity-50" />
          </div>

          {/* 수도꼭지 */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <div className="w-3 h-7 rounded-t-full" style={{ background: '#94a3b8' }} />
            <div className="w-8 h-2 rounded-full" style={{ background: '#94a3b8' }} />
            {/* 물 줄기 */}
            <div
              className="transition-all duration-200"
              style={{
                width: count > 0 ? 5 : 2,
                height: 32,
                background: `linear-gradient(180deg, rgba(147,197,253,${0.4 + pct*0.005}), rgba(59,130,246,0.3))`,
                borderRadius: 3,
                opacity: done ? 0 : 1,
              }}
            />
          </div>

          {/* 낙하 물방울들 */}
          {!done && Array.from({ length: dropCount }).map((_, i) => (
            <WaterDrop
              key={i}
              style={{
                top: 20,
                left: `${42 + (i % 5) * 5}%`,
                animationDelay: `${(i * 0.11) % 0.55}s`,
                animationDuration: `${0.45 + (i % 3) * 0.08}s`,
                opacity: 0.8,
              }}
            />
          ))}

          {/* 채소 */}
          <div
            className="absolute flex items-center justify-center"
            style={{ top: 18, left: '50%', transform: 'translateX(-50%)' }}
          >
            <div className="relative">
              <span
                className={`text-5xl z-10 relative select-none transition-transform duration-100
                  ${shake ? 'veg-shake' : ''}
                  ${flash === 'wrong' ? 'rotate-6' : ''}`}
              >
                {carrying?.emoji ?? '🥦'}
              </span>
              <SplashParticles active={splash} />
              {/* 링 잔물결 */}
              {splash && (
                <div
                  className="absolute ripple-anim rounded-full border-2 border-blue-400"
                  style={{ inset: -10 }}
                />
              )}
            </div>
          </div>
        </div>

        <p className="text-sm font-bold text-gray-500">{carrying?.label} {carrying?.qty}개</p>

        {/* 진행 바 */}
        <div className="w-full bg-blue-100 rounded-full h-5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300 flex items-center justify-end pr-2"
            style={{
              width: `${pct}%`,
              background: pct >= 100
                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                : 'linear-gradient(90deg, #60a5fa, #3b82f6)',
            }}
          >
            {pct >= 25 && (
              <span className="text-white text-xs font-black">{pct}%</span>
            )}
          </div>
        </div>

        {done ? (
          <div className="text-center py-2">
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
              {(['left', 'right'] ).map(dir => (
                <button
                  key={dir}
                  onPointerDown={() => handlePress(dir)}
                  className={`flex-1 py-5 rounded-2xl text-xl font-black shadow-sm
                    active:scale-95 transition-all duration-100 select-none touch-none
                    ${nextDir === dir
                      ? 'bg-blue-500 text-white scale-105 shadow-blue-200 shadow-lg'
                      : 'bg-gray-100 text-gray-400'}`}
                >
                  {dir === 'left' ? '← 왼쪽' : '오른쪽 →'}
                </button>
              ))}
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
    </>
  )
}
