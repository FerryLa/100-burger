/**
 * 냉장고 모달
 * - 보관 중인 재료 목록
 * - 토마토/양상추 신선도 (수확 후 3일)
 * - 주문 식자재 재고 표시
 */
import { useGameStore } from '../store/useGameStore'

const ITEMS = [
  { key: 'tomatoes',     emoji: '🍅',   label: '토마토 (신선)',  expKey: 'tomatoExpiresAt'  },
  { key: 'lettuces',     emoji: '🥬',   label: '양상추 (신선)',  expKey: 'lettuceExpiresAt' },
  { key: 'bread',        emoji: '🍞',   label: '햄버거 빵',      expKey: null },
  { key: 'grilledPatty', emoji: '🥩🔥', label: '구운 패티',      expKey: null },
  { key: 'grilledBacon', emoji: '🥓🔥', label: '구운 베이컨',    expKey: null },
  { key: 'patty',        emoji: '🥩',   label: '패티 (생)',       expKey: null },
  { key: 'bacon',        emoji: '🥓',   label: '베이컨 (생)',     expKey: null },
  { key: 'sauce',        emoji: '🥫',   label: '소스',            expKey: null },
]

function freshnessDays(expiresAt) {
  if (!expiresAt) return null
  const ms   = (expiresAt?.toMillis?.() ?? expiresAt?.seconds * 1000) - Date.now()
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
  return Math.max(0, days)
}

function freshColor(d) {
  if (d === null) return 'text-gray-400'
  if (d >= 2) return 'text-green-600'
  if (d === 1) return 'text-yellow-600'
  return 'text-red-500'
}

export default function Refrigerator({ inventory, onClose }) {
  const expiredVeggies = ITEMS
    .filter(it => it.expKey)
    .filter(it => {
      const qty  = inventory?.[it.key] || 0
      const days = freshnessDays(inventory?.[it.expKey])
      return qty > 0 && days === 0
    })

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-black text-blue-700 text-center">❄️ 냉장고</h2>

      {/* 재료 목록 */}
      <div className="flex flex-col gap-2">
        {ITEMS.map(({ key, emoji, label, expKey }) => {
          const qty  = inventory?.[key] || 0
          const days = expKey ? freshnessDays(inventory?.[expKey]) : null
          return (
            <div
              key={key}
              className={`flex items-center justify-between rounded-2xl px-4 py-3
                ${qty === 0 ? 'bg-gray-50 opacity-50' : 'bg-white shadow-sm'}`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="flex-1 ml-3 font-bold text-gray-700">{label}</span>
              <span className={`font-black text-xl ${qty === 0 ? 'text-gray-300' : 'text-gray-800'}`}>
                {qty}개
              </span>

              {/* 신선도 */}
              {expKey && qty > 0 && days !== null && (
                <span className={`ml-2 text-xs font-bold ${freshColor(days)}`}>
                  {days === 0 ? '오늘 시들어요!' : `${days}일 남음`}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* 전체 비어있는 경우 안내 */}
      {!inventory || ITEMS.every(({ key }) => !(inventory[key] > 0)) ? (
        <div className="bg-yellow-50 rounded-2xl p-4 text-center text-yellow-700 text-sm">
          📦 재료가 없어요! 발주대에서 주문하세요.
        </div>
      ) : null}

      {/* 채소 만료 경고 */}
      {expiredVeggies.length > 0 && (
        <div className="bg-red-50 rounded-2xl p-3 text-center text-red-600 text-sm font-bold">
          ⚠️ {expiredVeggies.map(it => it.label.split(' ')[0]).join(', ')}가 오늘 시들어요! 빨리 사용하세요.
        </div>
      )}

      <button onClick={onClose} className="text-gray-400 underline text-sm text-center mt-1">
        닫기
      </button>
    </div>
  )
}
