/**
 * 불판 미니게임
 * - 패티+베이컨 → 60~90초 실시간 조리
 * - 50% 시점에 뒤집기 타이밍 미니게임
 * - 완료 후 10초 초과 → 타버림 (burnGrill 호출, 인벤 손실)
 * - 완료 상태에서 걷어내기 → grilledPatty/grilledBacon 인벤 추가
 */
import { useState, useEffect, useRef } from 'react'
import { startGrilling, collectGrill, syncGrillStage, burnGrill, sendMessage } from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'

const BURN_AFTER_SECS = 10   // 완료 후 이 시간 초과 → 타버림
const FLIP_FROM_PCT   = 47   // 뒤집기 창 시작 진행률
const FLIP_TO_PCT     = 58   // 뒤집기 창 종료 진행률
const FLIP_WINDOW_SEC = 6    // 뒤집기 버튼 노출 시간 (초)

/* ─── hooks ───────────────────────────────────────────────── */
function useNow(intervalMs = 500) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function formatMs(ms) {
  if (ms <= 0) return '0:00'
  const tot = Math.ceil(ms / 1000)
  const m   = Math.floor(tot / 60)
  const s   = tot % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/* ─── Flame particle CSS ────────────────────────────────────── */
const flameStyle = `
@keyframes flameRise {
  0%   { transform: translateY(0)   scaleX(1)   opacity: 0.9; }
  50%  { transform: translateY(-18px) scaleX(1.2) opacity: 0.7; }
  100% { transform: translateY(-34px) scaleX(0.6) opacity: 0; }
}
@keyframes smokeDrift {
  0%   { transform: translate(0,0)       opacity: 0.45; }
  100% { transform: translate(12px,-32px) opacity: 0;   }
}
@keyframes burnPulse {
  0%,100% { opacity: 1; }
  50%      { opacity: 0.55; }
}
.flame { position:absolute; bottom:0; border-radius:50% 50% 30% 30%;
  animation: flameRise 0.8s ease-in infinite; transform-origin: bottom center; }
.smoke { position:absolute; border-radius:50%;
  animation: smokeDrift 1.4s ease-out infinite; }
.burn-pulse { animation: burnPulse 0.6s ease-in-out infinite; }
`

function FlameEmitter({ count = 5, burnt = false }) {
  const colors = burnt
    ? ['#374151','#6b7280','#4b5563']
    : ['#f97316','#fb923c','#fbbf24','#ef4444','#f59e0b']
  return (
    <div className="relative flex gap-2 justify-center h-12 mt-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative" style={{ width: 10 }}>
          <div className="flame" style={{
            width: 8 + (i % 3) * 4,
            height: 18 + (i % 2) * 10,
            background: colors[i % colors.length],
            animationDelay: `${i * 0.13}s`,
            animationDuration: `${0.6 + i * 0.1}s`,
            left: 0,
          }}/>
        </div>
      ))}
      {/* smoke puffs */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={`s${i}`} className="smoke" style={{
          width: 10, height: 10,
          background: burnt ? '#9ca3af' : '#d1d5db',
          bottom: 26, left: 20 + i * 22,
          animationDelay: `${i * 0.4}s`,
          animationDuration: `${1.2 + i * 0.2}s`,
        }}/>
      ))}
    </div>
  )
}

/* ─── Main component ────────────────────────────────────────── */
export default function Grill({ grill, inventory, onClose }) {
  const { role, familyId, user } = useGameStore(s => s)
  const [busy,     setBusy]     = useState(false)
  const [error,    setError]    = useState('')
  const [flipped,  setFlipped]  = useState(false)  // 이번 세션에서 뒤집었는지
  const flippedRef = useRef(false)
  const now = useNow(300)

  const stage   = grill?.stage ?? 'idle'
  const doneMs  = grill?.doneAt?.toMillis?.()    ?? (grill?.doneAt?.seconds    ?? 0) * 1000
  const startMs = grill?.startedAt?.toMillis?.() ?? (grill?.startedAt?.seconds ?? 0) * 1000

  const totalMs  = doneMs > 0 && startMs > 0 ? doneMs - startMs : 0
  const timeLeft = stage === 'grilling' ? Math.max(0, doneMs - now) : 0
  const elapsed  = totalMs > 0 ? Math.max(0, totalMs - timeLeft) : 0
  const progress = stage === 'done' ? 100
    : totalMs > 0 ? Math.min(99, Math.round((elapsed / totalMs) * 100)) : 0

  // 완료 후 경과 초
  const burnElapsed = stage === 'done' && doneMs > 0 ? Math.floor((now - doneMs) / 1000) : 0
  const isBurned    = burnElapsed >= BURN_AFTER_SECS
  const burnSecsLeft = Math.max(0, BURN_AFTER_SECS - burnElapsed)

  // 뒤집기 윈도우 (진행률 47~58% 구간)
  const inFlipWindow = stage === 'grilling'
    && progress >= FLIP_FROM_PCT
    && progress <= FLIP_TO_PCT
    && !flippedRef.current

  const hasPatty = (inventory?.patty || 0) >= 1
  const hasBacon = (inventory?.bacon || 0) >= 1

  // grilling → done 자동 전환
  useEffect(() => {
    if (stage !== 'grilling' || timeLeft > 0) return
    syncGrillStage(familyId).catch(() => {})
  }, [stage, timeLeft, familyId])

  async function handleStart() {
    if (!hasPatty || !hasBacon) { setError('패티와 베이컨이 필요해요!'); return }
    setBusy(true); setError('')
    flippedRef.current = false; setFlipped(false)
    try {
      await startGrilling(familyId)
      await sendMessage(familyId, user?.uid, role, '🔥 불판에 패티와 베이컨을 올렸어요!', true)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  function handleFlip() {
    flippedRef.current = true
    setFlipped(true)
  }

  async function handleCollect() {
    if (isBurned) return
    setBusy(true); setError('')
    try {
      await collectGrill(familyId)
      await sendMessage(familyId, user?.uid, role, '🥩🥓 패티·베이컨이 구워졌어요! 조리대에서 햄버거를 만들어요.', true)
      onClose?.()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function handleBurn() {
    setBusy(true); setError('')
    try {
      await burnGrill(familyId)
      await sendMessage(familyId, user?.uid, role, '💀 패티·베이컨이 타버렸어요... 다시 시작해요.', true)
      onClose?.()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  /* ─── progress bar color ──────────────────────────────────── */
  const barColor = progress < 40 ? '#f97316'
    : progress < 70 ? '#eab308'
    : '#22c55e'

  return (
    <>
      <style>{flameStyle}</style>
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-black text-orange-800">🔥 불판</h2>

        {error && <p className="text-red-500 font-bold text-sm text-center">{error}</p>}

        {/* ── 대기 중 ── */}
        {stage === 'idle' && (
          <>
            <div className="bg-orange-50 border-2 border-orange-200 rounded-3xl p-5 w-full text-center">
              <p className="text-5xl mb-1">🍳</p>
              <p className="text-lg font-black text-orange-800">불판 준비 완료</p>
              <p className="text-sm text-gray-500 mt-1">패티와 베이컨을 올려 구워요 (60~90초)</p>
            </div>

            <div className="flex gap-3 w-full">
              {[['🥩', '패티 (생)', hasPatty], ['🥓', '베이컨 (생)', hasBacon]].map(([e, n, ok]) => (
                <div key={n} className={`flex-1 flex flex-col items-center py-3 rounded-2xl border-2 transition-all
                  ${ok ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-dashed border-gray-200 opacity-60'}`}>
                  <span className="text-3xl">{e}</span>
                  <span className="text-xs font-bold text-gray-600 mt-1">{n}</span>
                  <span className="text-xs mt-0.5">{ok ? '✅' : '❌ 없음'}</span>
                </div>
              ))}
            </div>

            {(!hasPatty || !hasBacon) && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-xl p-2 w-full text-center">
                📦 발주대에서 패티·베이컨을 주문하면 내일 도착해요
              </p>
            )}

            <button
              onClick={handleStart}
              disabled={busy || !hasPatty || !hasBacon}
              className="btn-elder w-full text-white font-black shadow-lg disabled:opacity-40"
              style={{ background: 'linear-gradient(90deg, #f97316, #ea580c)' }}
            >
              {busy ? '올리는 중...' : '🔥 불판에 올리기!'}
            </button>
          </>
        )}

        {/* ── 굽는 중 ── */}
        {stage === 'grilling' && (
          <>
            {/* 불꽃 */}
            <FlameEmitter count={6} />

            <div className="bg-orange-50 rounded-3xl p-4 w-full text-center border-2 border-orange-300">
              <div className="flex justify-center gap-4 mb-2">
                <span className={`text-5xl transition-transform duration-300 ${flipped ? 'scale-x-[-1]' : ''}`}>🥩</span>
                <span className={`text-5xl transition-transform duration-300 ${flipped ? 'scale-x-[-1]' : ''}`}>🥓</span>
              </div>
              <p className="text-lg font-black text-orange-800">
                {timeLeft <= 0 ? '다 구워졌어요! 🎉' : '🔥 굽는 중...'}
              </p>
              {timeLeft > 0 && (
                <p className="text-4xl font-black text-orange-600 mt-1">{formatMs(timeLeft)}</p>
              )}
            </div>

            {/* 진행 바 */}
            <div className="w-full bg-orange-100 rounded-full h-5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: barColor }}
              >
                {progress >= 20 && (
                  <span className="flex items-center justify-end h-full pr-2 text-white text-xs font-black">
                    {progress}%
                  </span>
                )}
              </div>
            </div>

            {/* 🔄 뒤집기 미니게임 */}
            {inFlipWindow && (
              <div className="bg-yellow-50 border-2 border-yellow-400 rounded-2xl p-3 w-full text-center animate-pulse">
                <p className="text-sm font-black text-yellow-800 mb-2">
                  ⏰ 지금이에요! 뒤집어야 골고루 익어요!
                </p>
                <button
                  onClick={handleFlip}
                  className="btn-elder text-white font-black px-6 py-2 rounded-2xl shadow-md"
                  style={{ background: 'linear-gradient(90deg, #eab308, #ca8a04)' }}
                >
                  🔄 뒤집기!
                </button>
              </div>
            )}
            {flipped && progress >= FLIP_FROM_PCT && (
              <p className="text-xs text-green-600 font-bold bg-green-50 rounded-xl px-3 py-1.5 w-full text-center">
                ✅ 잘 뒤집었어요! 균일하게 익는 중...
              </p>
            )}

            <p className="text-xs text-gray-400 text-center">
              💡 모달을 닫아도 계속 구워져요! 나중에 돌아오면 OK
            </p>
          </>
        )}

        {/* ── 완성 (타기 전) ── */}
        {stage === 'done' && !isBurned && (
          <>
            <FlameEmitter count={3} />

            <div className="bg-green-50 border-2 border-green-400 rounded-3xl p-5 w-full text-center">
              <p className="text-5xl mb-2 animate-bounce">✅</p>
              <p className="text-xl font-black text-green-800">패티·베이컨 완성!</p>
              <p className="text-sm text-gray-500 mt-1">조리대에서 사용할 수 있어요</p>
            </div>

            {/* 번아웃 카운트다운 */}
            <div className={`w-full rounded-2xl p-3 text-center border-2 transition-all
              ${burnSecsLeft <= 5 ? 'bg-red-50 border-red-400' : 'bg-amber-50 border-amber-300'}`}>
              <p className={`text-sm font-black ${burnSecsLeft <= 5 ? 'text-red-700 burn-pulse' : 'text-amber-700'}`}>
                ⚠️ {burnSecsLeft}초 내에 걷어내지 않으면 타버려요!
              </p>
              {/* 번아웃 바 */}
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${(burnSecsLeft / BURN_AFTER_SECS) * 100}%`,
                    background: burnSecsLeft <= 5 ? '#ef4444' : '#f59e0b',
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleCollect}
              disabled={busy}
              className="btn-elder w-full text-white font-black shadow-lg"
              style={{ background: 'linear-gradient(90deg, #22c55e, #16a34a)' }}
            >
              {busy ? '걷어내는 중...' : '🥩🥓 걷어내기!'}
            </button>
          </>
        )}

        {/* ── 타버림 ── */}
        {stage === 'done' && isBurned && (
          <>
            <FlameEmitter count={4} burnt />

            <div className="bg-gray-900 border-2 border-gray-600 rounded-3xl p-5 w-full text-center">
              <p className="text-5xl mb-2 burn-pulse">💀</p>
              <p className="text-xl font-black text-gray-100">타버렸어요!</p>
              <p className="text-sm text-gray-400 mt-1">패티와 베이컨이 검게 탔어요... 버려야 해요</p>
            </div>

            <div className="bg-gray-100 rounded-2xl p-3 w-full text-center">
              <p className="text-xs text-gray-500">
                🗑️ 타버린 재료는 다시 사용할 수 없어요.<br/>
                발주대에서 새로 주문하세요.
              </p>
            </div>

            <button
              onClick={handleBurn}
              disabled={busy}
              className="btn-elder w-full text-white font-black shadow-lg"
              style={{ background: 'linear-gradient(90deg, #374151, #111827)' }}
            >
              {busy ? '버리는 중...' : '🗑️ 휴지통에 버리기'}
            </button>
          </>
        )}

        <button onClick={onClose} className="text-gray-400 underline text-sm">닫기</button>
      </div>
    </>
  )
}
