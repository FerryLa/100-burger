/**
 * 발주대 모달
 * - 마우스로 식자재 주문 (+/- 버튼)
 * - 발주 → 다음날(24시간) 배송
 * - 대기 중인 주문 목록
 */
import { useState } from 'react'
import { placeOrder, sendMessage } from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'

const CATALOG = [
  { key: 'bread', emoji: '🍞', label: '햄버거 빵',  unit: '개' },
  { key: 'patty', emoji: '🥩', label: '패티',        unit: '개' },
  { key: 'bacon', emoji: '🥓', label: '베이컨',      unit: '개' },
  { key: 'sauce', emoji: '🥫', label: '소스',        unit: '병' },
]

function formatDelivery(ts) {
  const ms = ts?.toMillis?.() ?? ts?.seconds * 1000 ?? 0
  const d  = new Date(ms)
  const h  = d.getHours().toString().padStart(2, '0')
  const m  = d.getMinutes().toString().padStart(2, '0')
  const today = new Date()
  const isTomorrow = d.getDate() !== today.getDate()
  return `${isTomorrow ? '내일 ' : '오늘 '}${h}:${m}`
}

export default function OrderDesk({ pendingOrders, onClose }) {
  const { familyId, user, role } = useGameStore(s => s)

  const [cart,  setCart]   = useState({ bread: 0, patty: 0, bacon: 0, sauce: 0 })
  const [busy,  setBusy]   = useState(false)
  const [done,  setDone]   = useState(false)

  function adj(key, delta) {
    setCart(c => ({ ...c, [key]: Math.max(0, Math.min(1, (c[key] || 0) + delta)) }))
  }

  const hasItems = Object.values(cart).some(v => v > 0)

  async function handleOrder() {
    if (!hasItems) return
    setBusy(true)
    try {
      await placeOrder(familyId, cart)
      await sendMessage(familyId, user.uid, role, '📦 식자재를 발주했어요!', true)
      setDone(true)
    } finally {
      setBusy(false)
    }
  }

  // 이미 대기 중인 발주가 있으면 새 발주 불가
  if (pendingOrders?.length >= 1 && !done) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-black text-amber-800 text-center">📦 발주대</h2>

        {/* 대기 중인 주문 */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl px-4 py-3">
          <p className="text-sm font-bold text-yellow-700 mb-2">⏳ 대기 중인 발주가 있어요</p>
          {pendingOrders.map(order => (
            <div key={order.id} className="flex justify-between items-center py-1">
              <span className="text-gray-600 text-sm">
                {Object.entries(order.items)
                  .filter(([, q]) => q > 0)
                  .map(([k, q]) => {
                    const item = CATALOG.find(c => c.key === k)
                    return `${item?.emoji}×${q}`
                  })
                  .join(' ')}
              </span>
              <span className="text-amber-600 font-bold text-xs">
                {formatDelivery(order.deliveryAt)} 도착
              </span>
            </div>
          ))}
        </div>

        <p className="text-sm text-gray-400 text-center">
          배송이 완료되면 새 발주가 가능해요.
        </p>
        <button onClick={onClose} className="text-gray-400 underline text-sm text-center">
          닫기
        </button>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-4">
        <div className="text-5xl">✅</div>
        <p className="text-xl font-black text-green-700">발주 완료!</p>
        <p className="text-gray-500 text-sm text-center">
          24시간 후 배송됩니다.<br />내일 냉장고를 확인하세요.
        </p>
        <button onClick={onClose} className="btn-elder bg-green-500 text-white w-full">
          확인
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-black text-amber-800 text-center">📦 발주대</h2>
      <p className="text-sm text-gray-400 text-center">품목당 1개씩 주문 가능해요. 24시간 후 배송.</p>

      {/* 주문 목록 */}
      <div className="flex flex-col gap-2">
        {CATALOG.map(({ key, emoji, label, unit }) => (
          <div key={key} className="flex items-center bg-white rounded-2xl px-4 py-3 shadow-sm gap-3">
            <span className="text-2xl">{emoji}</span>
            <span className="flex-1 font-bold text-gray-700">{label}</span>
            {/* 수량 조절 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => adj(key, -1)}
                className="w-9 h-9 rounded-full bg-gray-100 font-black text-xl
                           hover:bg-red-100 active:scale-90 transition-all"
              >
                −
              </button>
              <span className="w-8 text-center font-black text-lg">{cart[key]}</span>
              <button
                onClick={() => adj(key, 1)}
                className="w-9 h-9 rounded-full bg-gray-100 font-black text-xl
                           hover:bg-green-100 active:scale-90 transition-all"
              >
                +
              </button>
              <span className="text-xs text-gray-400 w-4">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 주문 버튼 */}
      <button
        onClick={handleOrder}
        disabled={!hasItems || busy}
        className="btn-elder bg-amber-500 text-white w-full disabled:opacity-40"
      >
        {busy ? '발주 중...' : '📦 발주하기'}
      </button>

      {/* 대기 중인 주문 */}
      {pendingOrders?.length > 0 && (
        <div className="mt-2">
          <p className="text-sm font-bold text-gray-500 mb-2">📋 대기 중인 주문</p>
          {pendingOrders.map(order => (
            <div key={order.id} className="bg-yellow-50 rounded-xl px-3 py-2 text-sm mb-1 flex justify-between">
              <span className="text-gray-600">
                {Object.entries(order.items)
                  .filter(([, q]) => q > 0)
                  .map(([k, q]) => {
                    const item = CATALOG.find(c => c.key === k)
                    return `${item?.emoji}×${q}`
                  })
                  .join(' ')}
              </span>
              <span className="text-amber-600 font-bold text-xs">
                {formatDelivery(order.deliveryAt)} 도착
              </span>
            </div>
          ))}
        </div>
      )}

      <button onClick={onClose} className="text-gray-400 underline text-sm text-center">
        닫기
      </button>
    </div>
  )
}
