/**
 * 메인 게임 화면
 * - GameRoom: 아이소메트릭 미니룸 (modern / hanok 테마)
 * - 가족 캐릭터 4종 SVG (엄마/아빠/아들/딸)
 * - carrying: 수확물 손에 들고 냉장고까지 직접 운반
 * - 양쪽 캐릭터 동시 표시 (위치 Firebase 동기화)
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  watchGameState, watchFarm, watchInventory, watchOrders,
  deliverPendingOrders, syncFarmStage, sendMessage,
  syncPosition, watchOtherPosition,
  storeVeggiesInFridge, instantCompleteAll, instantDeliverOrders,
  watchFamilyMeta,
} from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'
import GameRoom       from '../components/GameRoom3D'
import Farm           from '../components/Farm'
import Refrigerator   from '../components/Refrigerator'
import OrderDesk      from '../components/OrderDesk'
import Kitchen        from '../components/Kitchen'
import MessagePanel   from '../components/MessagePanel'
import AchievementsPanel from '../components/AchievementsPanel'
import WeeklyChallenge   from '../components/WeeklyChallenge'
import { ACHIEVEMENTS } from '../data/achievements'
import { watchWeeklyChallenge, markWeeklyChallengeComplete } from '../firebase/gameService'
import { getChallengeForWeek, getWeekKey } from '../data/weeklyChallenges'

/* ── 주간 챌린지 진행도 헬퍼 ────────────────────────────────── */
function getProgress(type, progress) {
  switch (type) {
    case 'burger_count':  return progress?.burgerCount    || 0
    case 'streak':        return progress?.streakMax      || 0
    case 'beanstalk':     return progress?.beanstalkCount || 0
    case 'farm_harvest':  return progress?.harvestCount   || 0
    default:              return 0
  }
}

/* ── 테마 설정 ──────────────────────────────────────────────── */
const THEME_CONFIG = {
  modern: {
    pageBg:      'linear-gradient(160deg, #fef9f0 0%, #f5e8d0 100%)',
    headerBg:    'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
    headerText:  '#fff',
    modalBg:     'linear-gradient(160deg, #fffbf5 0%, #fef3e2 100%)',
    carryBanner: '#f59e0b',
    msgBg:       '#fffbf5',
    label:       '모던 🏠',
    burgerCount: '#92400e',
  },
  hanok: {
    pageBg:      'linear-gradient(160deg, #1a0e06 0%, #2d1a0a 100%)',
    headerBg:    'linear-gradient(90deg, #6b3a18 0%, #4a2810 100%)',
    headerText:  '#fef3c7',
    modalBg:     'linear-gradient(160deg, #f5e6c0 0%, #ecd8a0 100%)',
    carryBanner: '#8b4513',
    msgBg:       '#f5e6c0',
    label:       '한옥 🏯',
    burgerCount: '#6b3a18',
  },
}

export default function GamePage() {
  const { familyId, role, gameState, setGameState, setFamilyMeta, logout, user } = useGameStore(s => s)

  const [farmTomato,    setFarmTomato]    = useState(null)
  const [farmLettuce,   setFarmLettuce]   = useState(null)
  const [inventory,     setInventory]     = useState(null)
  const [pendingOrders, setPendingOrders] = useState([])
  const [otherPlayer,   setOtherPlayer]   = useState(null)
  const [carrying,      setCarrying]      = useState(null)

  const [modal,     setModal]     = useState(null)
  const [celebrate, setCelebrate] = useState(null)
  const [showMsg,   setShowMsg]   = useState(false)
  const [testBusy,  setTestBusy]  = useState(false)
  const [testMsg,   setTestMsg]   = useState('')
  const [delivBusy, setDelivBusy] = useState(false)
  const [delivMsg,  setDelivMsg]  = useState('')

  /* ── 업적 팝업 큐 ── */
  const [achPopup,  setAchPopup]  = useState(null)   // { id, emoji, label } | null
  const achQueueRef = useRef([])

  /* ── 주간 챌린지 상태 ── */
  const [weeklyData,    setWeeklyData]    = useState(null)
  const [weeklyDonePop, setWeeklyDonePop] = useState(false)

  /* ── 테마 상태 ── */
  const [theme, setTheme] = useState('modern')
  const tc = THEME_CONFIG[theme]

  /* ── 업적 팝업 순차 표시 ── */
  function enqueueAchievements(ids) {
    if (!ids || ids.length === 0) return
    const defs = ids.map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean)
    achQueueRef.current.push(...defs)
    if (!achPopup) showNextAch()
  }

  function showNextAch() {
    if (achQueueRef.current.length === 0) { setAchPopup(null); return }
    const next = achQueueRef.current.shift()
    setAchPopup(next)
    setTimeout(() => {
      setAchPopup(null)
      setTimeout(showNextAch, 300)
    }, 3500)
  }

  /* ── 실시간 구독 ─────────────────────────────────────────── */
  useEffect(() => {
    if (!familyId) return
    const u1 = watchGameState(familyId, setGameState)
    const u2 = watchFarm(familyId, 'tomato',  setFarmTomato)
    const u3 = watchFarm(familyId, 'lettuce', setFarmLettuce)
    const u4 = watchInventory(familyId, setInventory)
    const u5 = watchOrders(familyId, setPendingOrders)
    const u6 = watchOtherPosition(familyId, role, setOtherPlayer)
    const u7 = watchFamilyMeta(familyId, setFamilyMeta)
    const u8 = watchWeeklyChallenge(familyId, (data) => {
      const prev = weeklyData
      setWeeklyData(data)
      // 이번 주 챌린지가 방금 완료됐는지 감지
      const isDone = getProgress(data.challenge.type, data.progress) >= data.challenge.target
      if (isDone && !data.progress.completed && !prev?.progress?.completed) {
        setWeeklyDonePop(true)
        setTimeout(() => setWeeklyDonePop(false), 4000)
      }
    })
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8() }
  }, [familyId, role])

  useEffect(() => {
    if (!familyId) return
    deliverPendingOrders(familyId)
    syncFarmStage(familyId)
  }, [familyId])

  /* ── 위치 동기화 ── */
  const handlePositionChange = useCallback(({ x, y }) => {
    if (!familyId || !role) return
    syncPosition(familyId, role, x, y).catch(() => {})
  }, [familyId, role])

  /* ── 상호작용 핸들러 ── */
  const handleInteract = useCallback((objectId) => {
    if (carrying) {
      if (objectId === 'fridge' || objectId === 'sink') {
        storeVeggiesInFridge(familyId, carrying.qty)
          .then(() => {
            sendMessage(familyId, user?.uid, role,
              `${carrying.emoji} ${carrying.label} ${carrying.qty}개를 냉장고에 넣었어요! 🧊`, true)
            setCarrying(null)
          })
          .catch(e => console.error(e))
        return
      }
      if (objectId === 'farm_tomato' || objectId === 'farm_lettuce') return
    }
    const map = {
      farm_tomato:  'farm_tomato',
      farm_lettuce: 'farm_lettuce',
      fridge:       'fridge',
      sink:         'fridge',
      kitchen:      'kitchen',
      order:        'order',
    }
    setModal(map[objectId] ?? null)
  }, [carrying, familyId, role, user])

  /* ── 수확 콜백 ── */
  const handleHarvest = useCallback((cropType, qty) => {
    const meta = {
      tomato:  { emoji: '🍅', label: '토마토' },
      lettuce: { emoji: '🥬', label: '양상추' },
    }
    const m = meta[cropType] ?? meta.tomato
    setCarrying({ type: cropType, emoji: m.emoji, label: m.label, qty })
  }, [])

  /* ── 버거 완성 (Kitchen이 { daily, total, newCoupon, streak, newAchievements } 반환) ── */
  function handleBurgerComplete(result) {
    if (!result) return
    const total = typeof result === 'object' ? result.total : result
    const newCoupon = typeof result === 'object' ? result.newCoupon : (total % 100 === 0)
    if (newCoupon && total > 0) setCelebrate(total)
    if (result?.newAchievements?.length) enqueueAchievements(result.newAchievements)
  }

  /* ── (테스트) 바로 발주도착 ── */
  async function handleInstantDeliver() {
    if (!familyId || delivBusy) return
    setDelivBusy(true); setDelivMsg('')
    try {
      const { count, items } = await instantDeliverOrders(familyId)
      const summary = Object.entries(items).map(([k, v]) => {
        const e = { bread:'🍞', patty:'🥩', bacon:'🥓', sauce:'🥫' }[k] ?? '📦'
        return `${e}×${v}`
      }).join(' ')
      setDelivMsg(`📦 ${count}건 도착! ${summary}`)
      setTimeout(() => setDelivMsg(''), 3000)
    } catch (e) {
      setDelivMsg(e.message)
      setTimeout(() => setDelivMsg(''), 2500)
    } finally { setDelivBusy(false) }
  }

  /* ── (테스트) 바로완성 ── */
  async function handleInstantComplete() {
    if (!familyId || testBusy) return
    setTestBusy(true); setTestMsg('')
    try {
      const count = await instantCompleteAll(familyId)
      setTestMsg(`🍔 오늘 ${count}개 완성!`)
      setTimeout(() => setTestMsg(''), 2000)
    } catch (e) { setTestMsg('오류: ' + e.message) }
    finally { setTestBusy(false) }
  }

  /* ── Esc: 내려놓기 ── */
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && carrying) setCarrying(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [carrying])

  const burgerCount  = gameState?.burgerCount  || 0   // 오늘 완성 수
  const totalBurgers = useGameStore(s => s.totalBurgers)  // 누적 (쿠폰 기준)
  const streak       = useGameStore(s => s.streak)
  const roleLabel    = role === 'parent'
    ? (theme === 'hanok' ? '🧑‍🍳 엄마' : '👩 엄마')
    : (theme === 'hanok' ? '🧒 아들'  : '👦 아들')

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: tc.pageBg }}
    >
      {/* ── 헤더 ── */}
      <header
        className="px-4 py-2 flex items-center justify-between flex-shrink-0 shadow-lg"
        style={{ background: tc.headerBg }}
      >
        {/* 왼쪽: 타이틀 + 로그아웃 */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍔</span>
          <div>
            <p className="text-base font-black leading-tight" style={{ color: tc.headerText }}>
              햄버거 만들기
            </p>
            <button
              onClick={() => { if (window.confirm('로그아웃 할까요?')) logout() }}
              className="text-xs opacity-60 hover:opacity-100 leading-tight underline transition-opacity"
              style={{ color: tc.headerText }}
            >
              {roleLabel} · 로그아웃
            </button>
          </div>
        </div>

        {/* 중앙: 버거 카운터 + 주간 챌린지 버튼 */}
        <div className="flex flex-col items-center gap-0.5">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm shadow-inner"
            style={{ background: 'rgba(255,255,255,0.2)', color: tc.headerText }}
          >
            <span className="text-xl">🍔</span>
            <div className="flex flex-col items-center leading-none">
              <span>{totalBurgers}개</span>
              <span className="text-xs opacity-60">/ 100개 쿠폰</span>
            </div>
            {burgerCount > 0 && (
              <span className="text-xs bg-white/20 rounded-full px-1.5 py-0.5">오늘 {burgerCount}</span>
            )}
          </div>
          {/* 주간 챌린지 힌트 */}
          {weeklyData && !weeklyData.progress?.completed && (
            <button
              onClick={() => setModal('weekly')}
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.25)', color: tc.headerText }}
            >
              📅 {getProgress(weeklyData.challenge.type, weeklyData.progress)}/{weeklyData.challenge.target}
            </button>
          )}
          {weeklyData?.progress?.completed && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.25)', color: tc.headerText }}>
              📅 ✅ 주간 달성!
            </span>
          )}
        </div>

        {/* 오른쪽: 스트릭 + 테마 토글 + 업적 */}
        <div className="flex items-center gap-1">
          {/* 스트릭 뱃지 */}
          {streak >= 2 && (
            <div
              className="flex items-center gap-0.5 px-2 py-1 rounded-xl text-xs font-black"
              style={{ background: 'rgba(255,255,255,0.2)', color: tc.headerText }}
              title={`${streak}일 연속 달성 중!`}
            >
              🔥 {streak}
            </div>
          )}

          {/* 업적 버튼 */}
          <button
            onClick={() => setModal('achievements')}
            className="text-xs font-black px-2.5 py-1 rounded-xl transition-all duration-200"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: tc.headerText,
              border: '2px solid transparent',
            }}
            title="업적 컬렉션"
          >
            🏆
          </button>

          {(['modern', 'hanok']).map(t => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className="text-xs font-black px-2.5 py-1 rounded-xl transition-all duration-200"
              style={{
                background: theme === t ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                color: tc.headerText,
                border: theme === t ? '2px solid rgba(255,255,255,0.5)' : '2px solid transparent',
                transform: theme === t ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              {t === 'modern' ? '🏠' : '🏯'}
            </button>
          ))}
        </div>
      </header>

      {/* ── carrying 배너 ── */}
      {carrying && (
        <div
          className="flex-shrink-0 text-white text-sm font-black px-4 py-2
                     flex items-center justify-between shadow-md"
          style={{ background: tc.carryBanner }}
        >
          <span>
            {carrying.emoji} {carrying.label} {carrying.qty}개 손에 들었어요!
            <span className="ml-2 opacity-80 font-normal text-xs">→ 냉장고로 가져가세요</span>
          </span>
          <button
            onClick={() => setCarrying(null)}
            className="ml-2 text-white/70 text-xs underline"
          >
            내려놓기 (Esc)
          </button>
        </div>
      )}

      {/* ── 게임 룸 ── */}
      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
        <GameRoom
          farmTomato={farmTomato}
          farmLettuce={farmLettuce}
          inventory={inventory}
          carrying={carrying}
          otherPlayerPos={otherPlayer}
          otherPlayerRole={otherPlayer?.role}
          onInteract={handleInteract}
          onPositionChange={handlePositionChange}
          theme={theme}
        />
      </div>

      {/* ── 하단 메시지 패널 ── */}
      <div className={`transition-all duration-300 ${showMsg ? 'h-80' : 'h-14'} flex-shrink-0`}>
        {showMsg ? (
          <div className="h-full shadow-2xl rounded-t-3xl flex flex-col"
            style={{ background: tc.msgBg }}>
            <button
              onClick={() => setShowMsg(false)}
              className="py-2 text-gray-400 text-sm font-bold"
            >
              ▼ 닫기
            </button>
            <div className="flex-1 min-h-0"><MessagePanel /></div>
          </div>
        ) : (
          <button
            onClick={() => setShowMsg(true)}
            className="w-full h-14 shadow-2xl rounded-t-3xl
                       flex items-center justify-center gap-2 text-base font-black"
            style={{ background: tc.msgBg, color: tc.burgerCount }}
          >
            💬 메시지
          </button>
        )}
      </div>

      {/* ── 모달 ── */}
      {modal && (
        <div
          className="fixed inset-0 flex items-end justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div
            className="rounded-3xl shadow-2xl w-full max-w-sm p-6 max-h-[85vh] overflow-y-auto"
            style={{ background: tc.modalBg }}
          >
            {modal === 'farm_tomato' && (
              <Farm farm={farmTomato} cropType="tomato" onHarvest={handleHarvest} onClose={() => setModal(null)} />
            )}
            {modal === 'farm_lettuce' && (
              <Farm farm={farmLettuce} cropType="lettuce" onHarvest={handleHarvest} onClose={() => setModal(null)} />
            )}
            {modal === 'fridge' && (
              <Refrigerator inventory={inventory} onClose={() => setModal(null)} />
            )}
            {modal === 'order' && (
              <OrderDesk pendingOrders={pendingOrders} onClose={() => setModal(null)} />
            )}
            {modal === 'kitchen' && (
              <Kitchen
                gameState={gameState}
                inventory={inventory}
                onComplete={handleBurgerComplete}
                onClose={() => setModal(null)}
              />
            )}
            {modal === 'achievements' && (
              <AchievementsPanel theme={theme} onClose={() => setModal(null)} />
            )}
            {modal === 'weekly' && (
              <WeeklyChallenge theme={theme} onClose={() => setModal(null)} />
            )}
          </div>
        </div>
      )}

      {/* ── 주간 챌린지 완료 팝업 ── */}
      {weeklyDonePop && weeklyData && (
        <div
          className="fixed top-20 inset-x-0 flex justify-center z-[60] px-4 pointer-events-none"
        >
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl max-w-xs w-full"
            style={{
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: '2px solid #34d399',
              animation: 'bounceIn 0.5s ease-out',
            }}
          >
            <span className="text-4xl">{weeklyData.challenge.emoji}</span>
            <div>
              <p className="text-xs font-bold text-emerald-600">📅 주간 챌린지 달성!</p>
              <p className="text-base font-black text-emerald-900">{weeklyData.challenge.title}</p>
              <p className="text-xs text-emerald-700">보상: {weeklyData.challenge.reward}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 업적 달성 팝업 ── */}
      {achPopup && (
        <div
          className="fixed top-20 inset-x-0 flex justify-center z-[60] px-4 pointer-events-none"
          style={{ animation: 'slideDown 0.4s ease-out' }}
        >
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl max-w-xs w-full"
            style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
              border: '2px solid #f59e0b',
              animation: 'bounceIn 0.5s ease-out',
            }}
          >
            <span className="text-4xl">{achPopup.emoji}</span>
            <div>
              <p className="text-xs font-bold text-amber-600">🏆 업적 달성!</p>
              <p className="text-base font-black text-amber-900">{achPopup.label}</p>
              <p className="text-xs text-amber-700">{achPopup.desc}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── 100개 달성 쿠폰 축하 ── */}
      {celebrate && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-6"
          style={{ background: 'rgba(0,0,0,0.72)' }}
        >
          <div
            className="rounded-3xl p-8 max-w-sm w-full flex flex-col items-center gap-4 text-center shadow-2xl"
            style={{ background: tc.modalBg }}
          >
            <span className="text-6xl">🎉</span>
            <h3 className="text-3xl font-black" style={{ color: tc.burgerCount }}>
              누적 {celebrate}개 달성!
            </h3>
            {/* 쿠폰 카드 */}
            <div className="w-full rounded-2xl p-4 border-4 border-dashed"
              style={{ borderColor: tc.carryBanner, background: 'rgba(255,255,255,0.7)' }}>
              <p className="text-4xl mb-1">🍔</p>
              <p className="text-xl font-black" style={{ color: tc.burgerCount }}>
                10,000원 햄버거 쿠폰
              </p>
              <p className="text-sm text-gray-500 mt-1">가족 햄버거 파티를 즐기세요!</p>
            </div>
            <button
              onClick={() => setCelebrate(null)}
              className="text-white font-black text-xl px-8 py-4 rounded-2xl w-full shadow-lg"
              style={{ background: tc.carryBanner }}
            >
              쿠폰 받기! 😊
            </button>
          </div>
        </div>
      )}

      {/* ── (테스트) 버튼 그룹 ── */}
      <div className="fixed bottom-20 right-3 z-40 flex flex-col items-end gap-2">
        {(testMsg || delivMsg) && (
          <div className="bg-black/70 text-white text-xs font-bold px-3 py-1 rounded-xl max-w-[180px] text-right">
            {testMsg || delivMsg}
          </div>
        )}
        <button
          onClick={handleInstantDeliver}
          disabled={delivBusy}
          className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs
                     font-black px-3 py-2 rounded-xl shadow-lg opacity-80 hover:opacity-100
                     transition-all disabled:opacity-40 border-2 border-blue-400"
        >
          {delivBusy ? '처리 중...' : '(테스트) 바로발주도착 📦'}
        </button>
        <button
          onClick={handleInstantComplete}
          disabled={testBusy}
          className="bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs
                     font-black px-3 py-2 rounded-xl shadow-lg opacity-80 hover:opacity-100
                     transition-all disabled:opacity-40 border-2 border-purple-400"
        >
          {testBusy ? '처리 중...' : '(테스트) 바로완성 🍔'}
        </button>
      </div>
    </div>
  )
}
