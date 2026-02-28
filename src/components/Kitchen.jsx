/**
 * 주방 미니게임 (4단계, 재료 있으면 ~2분, 없으면 더 어려움)
 *
 * Stage 0: 🥓 베이컨 굽기   – 타이밍(게이지 뒤집기)
 * Stage 1: 🍔 햄버거 세팅   – 빠른 탭(빵+패티)
 * Stage 2: 🥬 재료 쌓기     – 순서대로
 * Stage 3: 🥫 소스 뿌리기   – 꾹 누르기
 *
 * easy=true  (재료 충분) → 쉬움
 * easy=false (재료 부족) → 어려움
 */
import { useState, useEffect, useRef } from 'react'
import { startBurger, completeBurger, sendMessage, consumeIngredients } from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'

const STAGES = [
  { id: 'bacon', label: '베이컨 굽기',   emoji: '🥓' },
  { id: 'setup', label: '햄버거 세팅',   emoji: '🍔' },
  { id: 'stack', label: '재료 쌓기',     emoji: '🥬' },
  { id: 'sauce', label: '소스 뿌리기',   emoji: '🥫' },
]

const STACK_ORDER = ['아래빵', '패티', '베이컨', '양상추', '토마토', '위빵']
const STACK_EMO   = { '아래빵':'🍞','패티':'🥩','베이컨':'🥓','양상추':'🥬','토마토':'🍅','위빵':'🍞' }

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

// ─── Stage 0: 베이컨 굽기 ─────────────────────────────────────────────────────
function BaconGrillStage({ easy, onComplete }) {
  const GAUGE_MS   = easy ? 9000 : 5500
  const ZONE_MIN   = easy ? 38   : 60
  const ZONE_MAX   = easy ? 86   : 73
  const FLIPS_NEED = easy ? 1    : 2

  const [gauge,    setGauge]    = useState(0)
  const [phase,    setPhase]    = useState('rising')
  const [flips,    setFlips]    = useState(0)
  const [feedback, setFeedback] = useState('')
  const [fails,    setFails]    = useState(0)

  const startRef   = useRef(Date.now())
  const sessionRef = useRef(0)

  useEffect(() => {
    if (phase !== 'rising') return
    startRef.current = Date.now()
    const id = setInterval(() => {
      const g = Math.min(((Date.now() - startRef.current) / GAUGE_MS) * 100, 100)
      setGauge(g)
      if (g >= 100) {
        clearInterval(id)
        const s = ++sessionRef.current
        setFails(f => f + 1)
        setPhase('pause')
        setFeedback('🔥 탔어요! 다시...')
        setTimeout(() => {
          if (sessionRef.current !== s) return
          setFeedback(''); setGauge(0); setPhase('rising')
        }, 1400)
      }
    }, 40)
    return () => clearInterval(id)
  }, [phase, GAUGE_MS])

  function handleFlip() {
    if (phase !== 'rising') return
    const s = ++sessionRef.current
    setPhase('pause')
    if (gauge >= ZONE_MIN && gauge <= ZONE_MAX) {
      const nf = flips + 1
      setFlips(nf)
      if (nf >= FLIPS_NEED) {
        setFeedback('🎉 완벽하게 구워졌어요!')
        setTimeout(onComplete, 700)
      } else {
        setFeedback('👍 반대면 구워요!')
        setTimeout(() => {
          if (sessionRef.current !== s) return
          setFeedback(''); setGauge(0); setPhase('rising')
        }, 1100)
      }
    } else if (gauge < ZONE_MIN) {
      setFeedback('⏰ 아직 덜 익었어요!')
      setTimeout(() => { if (sessionRef.current !== s) return; setFeedback(''); setPhase('rising') }, 900)
    } else {
      setFails(f => f + 1)
      setFeedback('🔥 너무 많이 구웠어요!')
      setTimeout(() => {
        if (sessionRef.current !== s) return
        setFeedback(''); setGauge(0); setPhase('rising')
      }, 900)
    }
  }

  const inZone = phase === 'rising' && gauge >= ZONE_MIN && gauge <= ZONE_MAX

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="flex gap-3 items-center">
        <p className="text-sm font-bold text-gray-500">{flips + 1}/{FLIPS_NEED}번 뒤집기</p>
        {fails > 0 && <span className="text-xs bg-red-100 text-red-500 px-2 py-0.5 rounded-full">실패 {fails}회</span>}
      </div>

      <div className="w-full h-12 bg-gray-200 rounded-full relative overflow-hidden">
        <div className="absolute h-full bg-green-200" style={{ left: `${ZONE_MIN}%`, width: `${ZONE_MAX - ZONE_MIN}%` }} />
        <div className={`h-full rounded-full transition-none ${inZone ? 'bg-green-500' : gauge > ZONE_MAX ? 'bg-red-500' : 'bg-orange-400'}`}
          style={{ width: `${gauge}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-white drop-shadow">
          {inZone ? '✅ 지금!' : gauge < ZONE_MIN ? '🔥 굽는 중...' : phase === 'pause' ? '' : '🔥 타기 직전!'}
        </span>
      </div>

      {easy && <p className="text-xs text-green-600">💡 초록 구간에서 뒤집으세요</p>}
      {feedback && <p className="text-xl font-black animate-bounce">{feedback}</p>}

      <button onClick={handleFlip} disabled={phase !== 'rising'}
        className={`btn-elder w-full text-white transition-all duration-100
          ${inZone ? 'bg-green-500 scale-105 shadow-lg shadow-green-200' : 'bg-orange-400 opacity-80'}`}>
        🔄 뒤집기!
      </button>
    </div>
  )
}

// ─── Stage 1: 햄버거 세팅 ─────────────────────────────────────────────────────
function SetupStage({ easy, onComplete }) {
  const STEPS = [
    { emoji: '🍞', label: '아래빵 올리기' },
    { emoji: '🥩', label: '패티 올리기'   },
  ]
  const TAPS = easy ? 10 : 20

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
      <div className="flex gap-3">
        {STEPS.map((s, i) => (
          <div key={i} className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-2xl
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

// ─── Stage 2: 재료 쌓기 ───────────────────────────────────────────────────────
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

// ─── Stage 3: 소스 뿌리기 ─────────────────────────────────────────────────────
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

const COOK_LIMIT_SECS = 3 * 60  // 조리 제한: 3분

// ─── 메인 Kitchen ─────────────────────────────────────────────────────────────
export default function Kitchen({ gameState, inventory, onComplete, onClose }) {
  const { role, familyId, user } = useGameStore(s => s)

  const [phase,      setPhase]      = useState('check')
  const [stageIndex, setStageIndex] = useState(0)
  const [startTime,  setStartTime]  = useState(null)
  const [error,      setError]      = useState('')
  const [remaining,  setRemaining]  = useState(COOK_LIMIT_SECS)  // 남은 조리 시간(초)
  const timerRef = useRef(null)

  const hasVeggies = (inventory?.veggies || 0) >= 1
  const hasBread   = (inventory?.bread   || 0) >= 1
  const hasPatty   = (inventory?.patty   || 0) >= 1
  const hasBacon   = (inventory?.bacon   || 0) >= 1
  const hasSauce   = (inventory?.sauce   || 0) >= 1
  const allReady   = hasVeggies && hasBread && hasPatty && hasBacon && hasSauce
  const easy       = allReady

  // 오늘 이미 완성했으면 done 상태로
  const burgerDone = gameState?.burgerCompletedAt
  useEffect(() => { if (burgerDone) setPhase('done') }, [burgerDone])

  // 조리 중 카운트다운 타이머
  useEffect(() => {
    if (phase !== 'cooking') {
      clearInterval(timerRef.current); return
    }
    timerRef.current = setInterval(() => {
      setRemaining(r => {
        if (r <= 1) {
          clearInterval(timerRef.current)
          setPhase('timeout')
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  async function handleStart() {
    if (!allReady) { setError('재료가 부족해요.'); return }
    if (gameState?.burgerCompletedAt) { setError('오늘은 이미 조리를 완료했어요!'); return }
    setError('')
    try {
      await consumeIngredients(familyId, { veggies: 1, bread: 1, patty: 1, bacon: 1, sauce: 1 })
      await startBurger(familyId)
      await sendMessage(familyId, user.uid, 'child', '아이가 햄버거를 만들기 시작했어요! 🍔', true)
      setStartTime(Date.now())
      setRemaining(COOK_LIMIT_SECS)
      setPhase('cooking')
    } catch (e) { setError(e.message) }
  }

  async function handleStageComplete() {
    if (stageIndex < STAGES.length - 1) {
      setStageIndex(i => i + 1)
    } else {
      clearInterval(timerRef.current)
      setPhase('done')
      const result  = await completeBurger(familyId)
      const elapsed = Math.round((Date.now() - (startTime || Date.now())) / 1000)
      const m = Math.floor(elapsed / 60), s = elapsed % 60
      await sendMessage(familyId, user.uid, 'child',
        `햄버거 완성! 🍔 ${m}분 ${s}초 (누적 ${result.total}개)`, true)
      onComplete?.(result)
    }
  }

  // 타이머 초과 표시
  const timerColor = remaining <= 30 ? '#ef4444' : remaining <= 60 ? '#f97316' : '#22c55e'
  const timerMin   = Math.floor(remaining / 60)
  const timerSec   = remaining % 60

  // 부모 시점
  if (role === 'parent') {
    return (
      <div className="flex flex-col items-center gap-4">
        <h2 className="text-2xl font-black text-orange-700">🍳 주방</h2>
        {phase === 'done'
          ? <div className="text-center"><p className="text-5xl">🍔</p><p className="text-xl font-black text-yellow-800 mt-2">완성! 오늘 {gameState?.burgerCount || 0}개</p></div>
          : phase === 'cooking'
            ? (
              <div className="text-center">
                <p className="font-bold text-orange-700">🍳 아이가 [{STAGES[stageIndex]?.emoji} {STAGES[stageIndex]?.label}] 중!</p>
                <p className="text-sm text-gray-500 mt-1">남은 시간: {timerMin}:{String(timerSec).padStart(2,'0')}</p>
              </div>
            )
            : <p className="text-orange-500">아이가 아직 요리를 시작하지 않았어요</p>}
        <button onClick={onClose} className="text-gray-400 underline text-sm mt-2">닫기</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h2 className="text-2xl font-black text-orange-700">🍳 주방</h2>

      {/* 완성 */}
      {phase === 'done' && (
        <div className="w-full bg-yellow-100 rounded-2xl p-5 text-center shadow">
          <p className="text-5xl mb-2">🍔</p>
          <p className="text-2xl font-black text-yellow-800">오늘의 햄버거 완성!</p>
          <p className="text-sm text-yellow-700 mt-1">하루 1개 제한 — 내일 또 만들어요 🎉</p>
          <button onClick={onClose} className="mt-3 text-gray-500 underline text-sm">닫기</button>
        </div>
      )}

      {/* 시간 초과 */}
      {phase === 'timeout' && (
        <div className="w-full bg-red-50 rounded-2xl p-5 text-center shadow">
          <p className="text-4xl mb-2">⏰</p>
          <p className="text-xl font-black text-red-700">3분이 지났어요!</p>
          <p className="text-sm text-red-500 mt-1">재료는 소비됐어요. 내일 다시 도전!</p>
          <button onClick={onClose} className="mt-3 text-gray-500 underline text-sm">닫기</button>
        </div>
      )}

      {/* 재료 확인 */}
      {phase === 'check' && (
        <>
          {/* 하루 1회 제한 안내 */}
          <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700 text-center font-bold">
            ⏱ 조리 제한: 3분 이내 &nbsp;|&nbsp; 하루 1개만 조리 가능
          </div>
          <div className="w-full bg-white rounded-2xl p-4 shadow-sm text-sm">
            <p className="font-bold text-gray-600 mb-2">필요 재료 확인</p>
            {[['🥬','채소',hasVeggies],['🍞','빵',hasBread],['🥩','패티',hasPatty],
              ['🥓','베이컨',hasBacon],['🥫','소스',hasSauce]].map(([e, n, ok]) => (
              <div key={n} className="flex items-center gap-2 py-1">
                <span className="text-xl">{e}</span>
                <span className="flex-1 text-gray-700">{n}</span>
                <span className={ok ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>{ok ? '✅' : '❌ 없음'}</span>
              </div>
            ))}
          </div>
          {error && <p className="text-red-500 font-bold text-sm text-center">{error}</p>}
          {gameState?.burgerCompletedAt
            ? <div className="w-full bg-green-50 rounded-2xl p-3 text-center text-green-700 text-sm font-bold">✅ 오늘의 햄버거를 이미 완성했어요!</div>
            : allReady
              ? <button onClick={handleStart} className="btn-elder w-full bg-orange-500 text-white">🍔 요리 시작! (3분 제한)</button>
              : <div className="w-full bg-yellow-50 rounded-2xl p-3 text-center text-yellow-700 text-sm">냉장고를 채우거나 발주대에서 주문하세요 📦</div>}
          <button onClick={onClose} className="text-gray-400 underline text-sm">닫기</button>
        </>
      )}

      {/* 조리 중 */}
      {phase === 'cooking' && (
        <>
          {/* 타이머 */}
          <div className="w-full flex items-center justify-between px-2">
            <div className="flex gap-1 flex-1 mr-3">
              {STAGES.map((s, i) => (
                <div key={s.id} className={`flex-1 text-center py-1.5 rounded-full text-xs font-bold
                  ${i < stageIndex ? 'bg-green-400 text-white' : i === stageIndex ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {i < stageIndex ? '✓' : s.emoji}
                </div>
              ))}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-gray-400">남은 시간</p>
              <p className="text-lg font-black" style={{ color: timerColor }}>
                {timerMin}:{String(timerSec).padStart(2, '0')}
              </p>
            </div>
          </div>

          <h3 className="text-xl font-black text-orange-800">{STAGES[stageIndex].emoji} {STAGES[stageIndex].label}</h3>
          {stageIndex === 0 && <BaconGrillStage easy={easy} onComplete={handleStageComplete} />}
          {stageIndex === 1 && <SetupStage      easy={easy} onComplete={handleStageComplete} />}
          {stageIndex === 2 && <StackStage      easy={easy} onComplete={handleStageComplete} />}
          {stageIndex === 3 && <SauceStage      easy={easy} onComplete={handleStageComplete} />}
        </>
      )}
    </div>
  )
}
