/**
 * 불판 미니게임
 * - 냉장고의 패티+베이컨을 올리기 → 60~90초 실시간 조리
 * - 완료 후 걷어내기 → inventory에 grilledPatty + grilledBacon 추가
 */
import { useState, useEffect } from 'react'
import { startGrilling, collectGrill, syncGrillStage, sendMessage } from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'

function useCountdown(targetMs) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!targetMs) return
    const tick = () => setLeft(Math.max(0, targetMs - Date.now()))
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [targetMs])
  return left
}

function formatMs(ms) {
  if (ms <= 0) return '0:00'
  const tot = Math.ceil(ms / 1000)
  const m   = Math.floor(tot / 60)
  const s   = tot % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Grill({ grill, inventory, onClose }) {
  const { role, familyId, user } = useGameStore(s => s)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')

  const stage   = grill?.stage ?? 'idle'
  const doneMs  = grill?.doneAt?.toMillis?.()    ?? (grill?.doneAt?.seconds    ?? 0) * 1000
  const startMs = grill?.startedAt?.toMillis?.() ?? (grill?.startedAt?.seconds ?? 0) * 1000
  const timeLeft = useCountdown(stage === 'grilling' ? doneMs : 0)

  const totalMs   = doneMs - startMs
  const elapsed   = totalMs > 0 ? Math.max(0, totalMs - timeLeft) : 0
  const progress  = stage === 'done' ? 100
    : totalMs > 0 ? Math.round((elapsed / totalMs) * 100) : 0

  const hasPatty = (inventory?.patty || 0) >= 1
  const hasBacon = (inventory?.bacon || 0) >= 1

  // 타이머 만료 → Firestore 자동 업데이트 (grilling → done)
  useEffect(() => {
    if (stage !== 'grilling' || timeLeft > 0) return
    syncGrillStage(familyId).catch(() => {})
  }, [stage, timeLeft, familyId])

  async function handleStart() {
    if (!hasPatty || !hasBacon) { setError('패티와 베이컨이 필요해요!'); return }
    setBusy(true); setError('')
    try {
      await startGrilling(familyId)
      await sendMessage(familyId, user?.uid, role, '🔥 불판에 패티와 베이컨을 올렸어요!', true)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function handleCollect() {
    setBusy(true); setError('')
    try {
      await collectGrill(familyId)
      await sendMessage(familyId, user?.uid, role, '🥩🥓 패티·베이컨이 구워졌어요! 조리대에서 햄버거를 만들어요.', true)
      onClose?.()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <h2 className="text-2xl font-black text-orange-800">🔥 불판</h2>

      {error && <p className="text-red-500 font-bold text-sm text-center">{error}</p>}

      {/* ── 대기 중 ── */}
      {stage === 'idle' && (
        <>
          <div className="bg-orange-50 border-2 border-orange-200 rounded-3xl p-6 w-full text-center">
            <p className="text-5xl mb-2">🍳</p>
            <p className="text-lg font-black text-orange-800">불판 준비 완료</p>
            <p className="text-sm text-gray-500 mt-1">패티와 베이컨을 올려 구워요 (60~90초)</p>
          </div>

          {/* 재료 상태 */}
          <div className="flex gap-3 w-full">
            {[['🥩', '패티', hasPatty], ['🥓', '베이컨', hasBacon]].map(([e, n, ok]) => (
              <div key={n} className={`flex-1 flex flex-col items-center py-3 rounded-2xl border-2 transition-all
                ${ok ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-dashed border-gray-200 opacity-60'}`}>
                <span className="text-3xl">{e}</span>
                <span className="text-xs font-bold text-gray-600 mt-1">{n}</span>
                <span className="text-xs mt-0.5">{ok ? '✅' : '❌'}</span>
              </div>
            ))}
          </div>

          {(!hasPatty || !hasBacon) && (
            <p className="text-xs text-amber-600 text-center bg-amber-50 rounded-xl p-2 w-full">
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
          <div className="bg-orange-50 rounded-3xl p-5 w-full text-center border-2 border-orange-300">
            <div className="flex justify-center gap-3 mb-2">
              <span className={`text-5xl ${progress > 60 ? 'animate-bounce' : ''}`}>🥩</span>
              <span className={`text-5xl ${progress > 60 ? 'animate-bounce' : ''}`}>🥓</span>
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
              className={`h-full rounded-full transition-all duration-500
                ${timeLeft <= 0 ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{ width: `${progress}%` }}
            >
              {progress >= 30 && (
                <span className="flex items-center justify-end h-full pr-2 text-white text-xs font-black">
                  {progress}%
                </span>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            💡 모달을 닫아도 계속 구워져요! 나중에 돌아오면 OK
          </p>
        </>
      )}

      {/* ── 완성 ── */}
      {stage === 'done' && (
        <>
          <div className="bg-green-50 border-2 border-green-300 rounded-3xl p-6 w-full text-center">
            <p className="text-5xl mb-2 animate-bounce">✅</p>
            <p className="text-xl font-black text-green-800">패티·베이컨 완성!</p>
            <p className="text-sm text-gray-500 mt-1">걷어내면 냉장고에 자동 보관돼요</p>
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

      <button onClick={onClose} className="text-gray-400 underline text-sm">닫기</button>
    </div>
  )
}
