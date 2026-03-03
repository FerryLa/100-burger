/**
 * 주방 미니게임 (3단계)
 *
 * Stage 0: 🍔 햄버거 세팅   – 빠른 탭 (빵+구운패티+구운베이컨)
 * Stage 1: 🥬 재료 쌓기     – 순서대로 (채소 게이트 포함)
 * Stage 2: 🥫 소스 뿌리기   – 꾹 누르기
 *
 * 조리 시작 조건: 빵 + 구운패티 + 구운베이컨 + 소스 (채소는 조리 중 Stage 0 완료 후 추가)
 */
import { useState, useEffect, useRef } from 'react'
import { startBurger, completeBurger, sendMessage, consumeIngredients, updateCookingStage } from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'

const STAGES = [
  { id: 'setup', label: '햄버거 세팅',   emoji: '🍔' },
  { id: 'stack', label: '재료 쌓기',     emoji: '🥬' },
  { id: 'sauce', label: '소스 뿌리기',   emoji: '🥫' },
]

const STACK_ORDER = ['아래빵', '패티', '베이컨', '양상추', '토마토', '위빵']
const STACK_EMO   = { '아래빵':'🍞','패티':'🥩','베이컨':'🥓','양상추':'🥬','토마토':'🍅','위빵':'🍞' }

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

// ─── Stage 0: 햄버거 세팅 ─────────────────────────────────────────────────────
function SetupStage({ easy, onComplete }) {
  const STEPS = [
    { emoji: '🍞', label: '아래빵 올리기' },
    { emoji: '🥩', label: '구운패티 올리기'   },
    { emoji: '🥓', label: '구운베이컨 올리기' },
  ]
  const TAPS = easy ? 8 : 16

  const [step, setStep] = useState(0)
  const [taps, setTaps] = useState(0)

  function handleTap() {
    const next = taps + 1
    if (next >= TAPS) {
      if (step + 1 >= STEPS.length) { setTimeout(onComplete, 400) }
      else { setStep(s => s + 1); setTaps(0) }
    } else { setTaps(next) }
  }

  const cur = STEPS[step]
  const pct = (taps / TAPS) * 100

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-xl
            ${i < step ? 'bg-green-200 border-green-400' : i === step ? 'bg-amber-100 border-amber-400 scale-110' : 'bg-gray-100 border-gray-200 opacity-40'}`}>
            {i < step ? '✅' : s.emoji}
          </div>
        ))}
      </div>
      <p className="text-xl font-black text-gray-700">{cur.emoji} {cur.label}</p>
      <div className="w-full bg-amber-100 rounded-full h-6 overflow-hidden">
        <div className="bg-amber-500 h-full rounded-full transition-all duration-75" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-gray-400">{taps} / {TAPS}</p>
      <button onPointerDown={handleTap} className="btn-elder bg-amber-500 text-white w-full select-none touch-none">
        {cur.emoji} 올리기!
      </button>
    </div>
  )
}

// ─── Stage 1: 재료 쌓기 ───────────────────────────────────────────────────────
function StackStage({ easy, onComplete }) {
  const [step,     setStep]     = useState(0)
  const [shuffled]              = useState(() => shuffle(STACK_ORDER))
  const [wrong,    setWrong]    = useState(null)
  const [stacked,  setStacked]  = useState([])
  const [mistakes, setMistakes] = useState(0)

  function handleTap(item) {
    if (item === STACK_ORDER[step]) {
      const ns = [...stacked, item]
      setStacked(ns)
      if (step + 1 >= STACK_ORDER.length) setTimeout(onComplete, 500)
      else setStep(s => s + 1)
    } else {
      setMistakes(m => m + 1); setWrong(item)
      setTimeout(() => setWrong(null), 500)
    }
  }

  const placed = new Set(stacked)
  const next   = STACK_ORDER[step]

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {mistakes > 0 && <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full self-end">❌ 실수 {mistakes}회</span>}

      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl px-4 py-2 min-h-[48px]
                      flex gap-1 w-full justify-center items-center flex-wrap">
        {stacked.length === 0
          ? <span className="text-gray-300 text-sm">재료를 올려보세요...</span>
          : stacked.map((it, i) => <span key={i} className="text-2xl">{STACK_EMO[it]}</span>)}
      </div>

      <div className="bg-white rounded-xl px-4 py-2 w-full text-center border border-gray-100 shadow-sm">
        <p className="text-xs text-gray-400">지금 올릴 재료</p>
        {easy
          ? <p className="text-2xl font-black">{STACK_EMO[next]} {next}</p>
          : <p className="text-3xl">❓</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 w-full">
        {shuffled.map(item => {
          const isPlaced = placed.has(item)
          return (
            <button key={item} onClick={() => !isPlaced && handleTap(item)}
              className={`py-3 rounded-2xl text-base font-bold shadow-sm active:scale-95
                ${wrong === item  ? 'bg-red-200 text-red-700'
                : isPlaced        ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                :                   'bg-white text-gray-800 hover:bg-amber-50'}`}>
              {STACK_EMO[item]} {item}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Stage 2: 소스 뿌리기 ─────────────────────────────────────────────────────
function SauceStage({ easy, onComplete }) {
  const HOLD_MS = easy ? 2500 : 5000

  const [progress,  setProgress]  = useState(0)
  const [holding,   setHolding]   = useState(false)
  const [completed, setCompleted] = useState(false)
  const [failed,    setFailed]    = useState(false)
  const [failCount, setFailCount] = useState(0)

  const intRef   = useRef(null)
  const startRef = useRef(null)

  function startHold() {
    if (completed) return
    setHolding(true); setFailed(false)
    startRef.current = Date.now()
    intRef.current = setInterval(() => {
      const p = Math.min(((Date.now() - startRef.current) / HOLD_MS) * 100, 100)
      setProgress(p)
      if (p >= 100) {
        clearInterval(intRef.current)
        setCompleted(true); setHolding(false)
        setTimeout(onComplete, 500)
      }
    }, 40)
  }

  function stopHold() {
    if (completed) return
    clearInterval(intRef.current)
    if (holding && progress < 100) { setFailed(true); setFailCount(c => c + 1); setProgress(0) }
    setHolding(false)
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className="text-center">
        <p className="text-lg font-bold text-gray-700">소스 병을 꾹 누르세요!</p>
        <p className="text-sm text-gray-400">{easy ? '2.5초' : '5초'} — 놓으면 처음부터!</p>
      </div>
      {failCount > 0 && <span className="text-xs bg-red-100 text-red-500 px-3 py-1 rounded-full">❌ 실패 {failCount}회</span>}
      <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
        <div className={`h-full rounded-full transition-none ${completed ? 'bg-green-500' : 'bg-red-500'}`}
          style={{ width: `${completed ? 100 : progress}%` }} />
      </div>
      {failed && <p className="text-red-500 font-black animate-bounce">❌ 놓쳤어요! 다시!</p>}
      <button onPointerDown={startHold} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold}
        className={`btn-elder w-full select-none touch-none text-white
          ${completed ? 'bg-green-500' : holding ? 'bg-red-600 scale-95' : 'bg-red-500'}`}>
        {completed ? '🎉 완성!' : holding ? '뿌리는 중... 🥫' : '🥫 소스 뿌리기!'}
      </button>
    </div>
  )
}

// Firestore sentinel: stage 0 완료 후 채소 대기 중
const STAGE_VEGGIE_WAIT = 15

// ─── 메인 Kitchen ─────────────────────────────────────────────────────────────
export default function Kitchen({ gameState, inventory, onComplete, onClose, initialStage = 0, onStageAdvance }) {
  const { role, familyId, user } = useGameStore(s => s)

  // 채소 대기 sentinel 여부
  const isVeggieWait = initialStage === STAGE_VEGGIE_WAIT

  const [phase,         setPhase]         = useState(() => {
    if (gameState?.burgerCompletedAt) return 'done'
    if (gameState?.burgerStartedAt)   return 'cooking'
    return 'check'
  })
  // 재진입: 새 STAGES에서 유효 범위로 클램프
  const [stageIndex,     setStageIndex]     = useState(
    isVeggieWait ? 0 : Math.min(initialStage, STAGES.length - 1)
  )
  const [waitingVeggies, setWaitingVeggies] = useState(isVeggieWait)
  const [error,          setError]          = useState('')

  const hasTomato       = (inventory?.tomatoes     || 0) >= 1
  const hasLettuce      = (inventory?.lettuces     || 0) >= 1
  const hasBread        = (inventory?.bread        || 0) >= 1
  const hasGrilledPatty = (inventory?.grilledPatty || 0) >= 1
  const hasGrilledBacon = (inventory?.grilledBacon || 0) >= 1
  const hasSauce        = (inventory?.sauce        || 0) >= 1

  // 조리 시작 조건: 구운 패티·베이컨 필요 (채소는 조리 중 Stage 0 완료 후)
  const allReady = hasBread && hasGrilledPatty && hasGrilledBacon && hasSauce
  const easy     = allReady

  // 오늘 이미 완성했으면 done 상태로
  const burgerDone = gameState?.burgerCompletedAt
  useEffect(() => { if (burgerDone) setPhase('done') }, [burgerDone])

  async function handleStart() {
    if (!allReady) { setError('재료가 부족해요.'); return }
    if (gameState?.burgerCompletedAt) { setError('오늘은 이미 조리를 완료했어요!'); return }
    setError('')
    try {
      // 채소는 조리 중 stage 0 완료 시 별도 소비
      await consumeIngredients(familyId, { bread: 1, grilledPatty: 1, grilledBacon: 1, sauce: 1 })
      await startBurger(familyId)
      await sendMessage(familyId, user.uid, role, '아이가 햄버거를 만들기 시작했어요! 🍔', true)
      setPhase('cooking')
    } catch (e) { setError(e.message) }
  }

  /** 채소(토마토+양상추) 소비 후 stage 1(재료 쌓기)로 진입 */
  async function handleAddVeggies() {
    try {
      await consumeIngredients(familyId, { tomatoes: 1, lettuces: 1 })
      const next = 1   // 재료 쌓기 (새 인덱스)
      setStageIndex(next)
      setWaitingVeggies(false)
      updateCookingStage(familyId, next).catch(() => {})
      onStageAdvance?.(next)
    } catch (e) { setError(e.message) }
  }

  async function handleStageComplete() {
    // Stage 0(햄버거 세팅) 완료 → 채소 확인 게이트
    if (stageIndex === 0) {
      if (hasTomato && hasLettuce) {
        await handleAddVeggies()      // 채소 있으면 바로 얹기
      } else {
        setWaitingVeggies(true)       // 채소 대기 화면으로
        updateCookingStage(familyId, STAGE_VEGGIE_WAIT).catch(() => {})
        onStageAdvance?.(STAGE_VEGGIE_WAIT)
      }
      return
    }
    // 마지막 스테이지(소스) 완료 → 햄버거 완성
    if (stageIndex >= STAGES.length - 1) {
      setPhase('done')
      const result  = await completeBurger(familyId)
      const startMs = gameState?.burgerStartedAt?.toMillis?.()
        ?? (gameState?.burgerStartedAt?.seconds ?? 0) * 1000
      const elapsed = Math.round((Date.now() - startMs) / 1000)
      const m = Math.floor(elapsed / 60), s = elapsed % 60
      await sendMessage(familyId, user.uid, role,
        `햄버거 완성! 🍔 ${m}분 ${s}초 (누적 ${result.total}개)`, true)
      onComplete?.(result)
      return
    }
    // 일반: 다음 단계로
    const next = stageIndex + 1
    setStageIndex(next)
    updateCookingStage(familyId, next).catch(() => {})
    onStageAdvance?.(next)
  }

  // 부모 시점
  if (role === 'parent') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <h2 className="text-2xl font-black text-amber-800">🍔 버거 조리대</h2>
          <p className="text-xs text-amber-500 font-bold tracking-wide">Burger Prep Station</p>
        </div>
        {phase === 'done'
          ? (
            <div className="w-full bg-gradient-to-br from-yellow-50 to-amber-50 rounded-2xl p-5 text-center border-2 border-amber-200">
              <p className="text-5xl mb-1">🍔</p>
              <p className="text-xl font-black text-amber-800">오늘의 버거 완성!</p>
              <p className="text-sm text-amber-600 mt-1">오늘 {gameState?.burgerCount || 0}개 달성 🎉</p>
            </div>
          )
          : phase === 'cooking'
            ? (
              <div className="w-full bg-orange-50 rounded-2xl p-4 text-center border-2 border-orange-200">
                <p className="text-3xl mb-1">{STAGES[stageIndex]?.emoji}</p>
                <p className="font-black text-orange-700">{STAGES[stageIndex]?.label} 진행 중!</p>
                <div className="flex gap-1 justify-center mt-2">
                  {STAGES.map((s, i) => (
                    <div key={s.id} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
                      ${i < stageIndex ? 'bg-green-400 text-white' : i === stageIndex ? 'bg-orange-500 text-white animate-bounce' : 'bg-gray-100 text-gray-400'}`}>
                      {i < stageIndex ? '✓' : s.emoji}
                    </div>
                  ))}
                </div>
              </div>
            )
            : (
              <div className="w-full bg-gray-50 rounded-2xl p-4 text-center border border-gray-200">
                <p className="text-3xl mb-1">😴</p>
                <p className="text-gray-500 font-bold">아이가 아직 조리를 시작하지 않았어요</p>
              </div>
            )}
        <button onClick={onClose} className="text-gray-400 underline text-sm mt-2">닫기</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-center">
        <h2 className="text-2xl font-black text-amber-800">🍔 버거 조리대</h2>
        <p className="text-xs text-amber-500 font-bold tracking-wide">Burger Prep Station</p>
      </div>

      {/* 완성 */}
      {phase === 'done' && (
        <div className="w-full rounded-2xl p-5 text-center shadow"
          style={{ background: 'linear-gradient(135deg, #fef9c3, #fde68a)', border: '2px solid #f59e0b' }}>
          <p className="text-6xl mb-2" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.18))' }}>🍔</p>
          <p className="text-2xl font-black text-amber-900">오늘의 버거 완성!</p>
          <p className="text-sm text-amber-700 mt-1">하루 1개 제한 — 내일 또 도전해요 🎉</p>
          <button onClick={onClose} className="mt-3 text-amber-600 underline text-sm font-bold">닫기</button>
        </div>
      )}

      {/* 재료 확인 */}
      {phase === 'check' && (
        <>
          <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700 text-center font-bold">
            🍔 하루 1개 조리 가능
          </div>

          {/* 재료 카드 그리드 */}
          <div className="w-full flex flex-col gap-2">
            {/* 시작 필수 재료 */}
            <p className="text-xs font-black text-gray-500 text-center tracking-widest uppercase">조리 시작 재료</p>
            <div className="grid grid-cols-4 gap-1.5 w-full">
              {[
                ['🍞',    '빵',       hasBread],
                ['🥩🔥',  '구운패티', hasGrilledPatty],
                ['🥓🔥',  '구운베이컨', hasGrilledBacon],
                ['🥫',   '소스',     hasSauce],
              ].map(([e, n, ok]) => (
                <div key={n} className={`flex flex-col items-center py-2 px-1 rounded-2xl border-2 text-center transition-all
                  ${ok ? 'bg-green-50 border-green-300 shadow-sm' : 'bg-gray-50 border-dashed border-gray-200 opacity-55'}`}>
                  <span className="text-2xl leading-none">{e}</span>
                  <span className="text-xs font-bold text-gray-600 mt-1 leading-tight">{n}</span>
                  <span className="text-xs mt-0.5">{ok ? '✅' : '❌'}</span>
                </div>
              ))}
            </div>
            {(!hasGrilledPatty || !hasGrilledBacon) && (
              <p className="text-xs text-orange-500 text-center bg-orange-50 rounded-xl p-2">
                🔥 불판에서 패티·베이컨을 먼저 구워오세요!
              </p>
            )}

            {/* 채소: 나중에 추가 */}
            <div className="w-full bg-blue-50 border border-blue-200 rounded-2xl px-3 py-2">
              <p className="text-xs font-black text-blue-600 mb-1.5 text-center">🌱 채소는 조리 중에 추가</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[['🍅','토마토',hasTomato],['🥬','양상추',hasLettuce]].map(([e, n, ok]) => (
                  <div key={n} className={`flex items-center gap-2 py-1.5 px-3 rounded-xl border transition-all
                    ${ok ? 'bg-green-50 border-green-300' : 'bg-white border-blue-200'}`}>
                    <span className="text-xl">{e}</span>
                    <span className="text-xs font-bold text-gray-700 flex-1">{n}</span>
                    <span className="text-xs">{ok ? '✅' : '🌱'}</span>
                  </div>
                ))}
              </div>
              {!hasTomato || !hasLettuce ? (
                <p className="text-xs text-blue-500 text-center mt-1">없어도 조리 시작 가능 — 나중에 얹어요</p>
              ) : (
                <p className="text-xs text-green-600 font-bold text-center mt-1">채소 준비 완료! 🎉</p>
              )}
            </div>
          </div>

          {error && <p className="text-red-500 font-bold text-sm text-center">{error}</p>}
          {gameState?.burgerCompletedAt
            ? <div className="w-full bg-green-50 rounded-2xl p-3 text-center text-green-700 text-sm font-bold border border-green-200">✅ 오늘의 버거를 이미 완성했어요!</div>
            : allReady
              ? (
                <button onClick={handleStart}
                  className="btn-elder w-full text-white font-black shadow-lg active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(90deg, #f97316, #ea580c)' }}>
                  🍔 조리 시작!
                </button>
              )
              : <div className="w-full bg-yellow-50 rounded-2xl p-3 text-center text-yellow-700 text-sm border border-yellow-200">냉장고를 채우거나 불판에서 재료를 구워오세요 🔥</div>}
          <button onClick={onClose} className="text-gray-400 underline text-sm">닫기</button>
        </>
      )}

      {/* 조리 중 */}
      {phase === 'cooking' && (
        <>
          {/* 스테이지 진행 바 */}
          <div className="flex gap-1 w-full">
            {STAGES.map((s, i) => (
              <div key={s.id} className={`flex-1 text-center py-1.5 rounded-full text-xs font-bold
                ${i < stageIndex ? 'bg-green-400 text-white' : i === stageIndex ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {i < stageIndex ? '✓' : s.emoji}
              </div>
            ))}
          </div>

          <h3 className="text-xl font-black text-orange-800">{STAGES[stageIndex].emoji} {STAGES[stageIndex].label}</h3>

          {/* 채소 대기 화면 (stage 0 완료, 채소 없을 때) */}
          {waitingVeggies && (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="text-center">
                <p className="text-5xl mb-1">🍅🥬</p>
                <p className="text-xl font-black text-orange-700">채소를 얹을 차례예요!</p>
                <p className="text-sm text-gray-500 mt-1">빵·패티·베이컨 위에 토마토·양상추를 얹어요</p>
              </div>
              <div className="flex gap-3 w-full">
                {[['🍅','토마토',hasTomato],['🥬','양상추',hasLettuce]].map(([e,n,ok]) => (
                  <div key={n} className={`flex-1 flex flex-col items-center py-3 rounded-2xl border-2 transition-all
                    ${ok ? 'bg-green-50 border-green-400' : 'bg-orange-50 border-orange-200'}`}>
                    <span className="text-3xl">{e}</span>
                    <span className="text-xs font-bold text-gray-600 mt-1">{n}</span>
                    <span className="text-sm mt-0.5">{ok ? '✅ 냉장고에 있어요' : '❌ 없어요'}</span>
                  </div>
                ))}
              </div>
              {error && <p className="text-red-500 font-bold text-sm">{error}</p>}
              {hasTomato && hasLettuce ? (
                <button onClick={handleAddVeggies}
                  className="btn-elder w-full text-white font-black shadow-lg"
                  style={{ background: 'linear-gradient(90deg, #22c55e, #16a34a)' }}>
                  🍅🥬 지금 바로 얹기!
                </button>
              ) : (
                <button onClick={onClose}
                  className="btn-elder w-full bg-orange-400 text-white font-black">
                  🌱 채소 가져올게요 →
                </button>
              )}
              <p className="text-xs text-gray-400 text-center">
                ↩ 농장에서 수확 → 씻기 → 냉장고 → 돌아와서 얹기
              </p>
            </div>
          )}

          {/* 스테이지별 미니게임 */}
          {!waitingVeggies && stageIndex === 0 && <SetupStage easy={easy} onComplete={handleStageComplete} />}
          {!waitingVeggies && stageIndex === 1 && <StackStage easy={easy} onComplete={handleStageComplete} />}
          {!waitingVeggies && stageIndex === 2 && <SauceStage easy={easy} onComplete={handleStageComplete} />}
        </>
      )}
    </div>
  )
}
