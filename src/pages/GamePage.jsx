/**
 * 메인 게임 화면
 * - GameRoom: 2D 방 + 캐릭터 이동
 * - 오브젝트 클릭/A키 → 해당 모달 표시
 * - 실시간 구독: farm, inventory, orders, gameState, messages
 */
import { useState, useEffect, useCallback } from 'react'
import {
  watchGameState, watchFarm, watchInventory, watchOrders,
  deliverPendingOrders, syncFarmStage, sendMessage,
} from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'
import GameRoom    from '../components/GameRoom'
import Farm        from '../components/Farm'
import Refrigerator from '../components/Refrigerator'
import OrderDesk   from '../components/OrderDesk'
import Kitchen     from '../components/Kitchen'
import MessagePanel from '../components/MessagePanel'

export default function GamePage() {
  const { familyId, role, gameState, setGameState } = useGameStore(s => s)

  const [farm,         setFarm]         = useState(null)
  const [inventory,    setInventory]    = useState(null)
  const [pendingOrders, setPendingOrders] = useState([])

  const [modal,        setModal]        = useState(null)  // null | 'farm'|'fridge'|'kitchen'|'order'|'sink'|'stove'|'msg'
  const [celebrate,    setCelebrate]    = useState(null)
  const [showMsg,      setShowMsg]      = useState(false)

  // ── 실시간 구독 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!familyId) return
    const u1 = watchGameState(familyId, setGameState)
    const u2 = watchFarm(familyId, setFarm)
    const u3 = watchInventory(familyId, setInventory)
    const u4 = watchOrders(familyId, setPendingOrders)
    return () => { u1(); u2(); u3(); u4() }
  }, [familyId])

  // 앱 열릴 때: 배송 처리 + 농장 단계 동기화
  useEffect(() => {
    if (!familyId) return
    deliverPendingOrders(familyId)
    syncFarmStage(familyId)
  }, [familyId])

  // ── 상호작용 핸들러 ───────────────────────────────────────────────────────────
  const handleInteract = useCallback((objectId) => {
    const map = {
      farm:    'farm',
      fridge:  'fridge',
      kitchen: 'kitchen',
      stove:   'kitchen',
      sink:    'fridge',   // 씽크대 → 냉장고 모달 (재료 확인)
      order:   'order',
    }
    setModal(map[objectId] ?? null)
  }, [])

  function handleBurgerComplete(count) {
    if (count > 0 && count % 100 === 0) setCelebrate(count)
  }

  const farmStage = farm?.stage ?? null

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-amber-600 text-white px-4 py-2 flex items-center justify-between shadow-md flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🍔</span>
          <span className="text-lg font-black">햄버거 만들기</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="bg-amber-700 rounded-full px-2 py-0.5 font-bold">
            {role === 'parent' ? '👩 부모' : '👦 자녀'}
          </span>
          <span className="opacity-80">🍔 {gameState?.burgerCount || 0}개</span>
        </div>
      </header>

      {/* 게임 룸 */}
      <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
        <GameRoom
          farmStage={farmStage}
          inventory={inventory}
          onInteract={handleInteract}
        />
      </div>

      {/* 하단: 메시지 */}
      <div className={`transition-all duration-300 ${showMsg ? 'h-80' : 'h-14'} flex-shrink-0`}>
        {showMsg ? (
          <div className="h-full bg-white shadow-2xl rounded-t-3xl flex flex-col">
            <button onClick={() => setShowMsg(false)} className="py-2 text-gray-400 text-sm font-bold">▼ 닫기</button>
            <div className="flex-1 min-h-0"><MessagePanel /></div>
          </div>
        ) : (
          <button
            onClick={() => setShowMsg(true)}
            className="w-full h-14 bg-white shadow-2xl rounded-t-3xl
                       flex items-center justify-center gap-2 text-lg font-bold text-amber-700"
          >
            💬 메시지
          </button>
        )}
      </div>

      {/* ── 모달 ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 max-h-[85vh] overflow-y-auto">
            {modal === 'farm' && (
              <Farm farm={farm} onClose={() => setModal(null)} />
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
          </div>
        </div>
      )}

      {/* 100개 달성 축하 */}
      {celebrate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full flex flex-col items-center gap-4 text-center">
            <span className="text-6xl">🎉</span>
            <h3 className="text-3xl font-black text-amber-700">{celebrate}개 달성!</h3>
            <p className="text-gray-600">햄버거 쿠폰이 발급됩니다! 🍔</p>
            <button onClick={() => setCelebrate(null)}
              className="bg-amber-500 text-white font-bold text-xl px-8 py-4 rounded-2xl w-full">
              감사합니다! 😊
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
