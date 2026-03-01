/**
 * AchievementsPanel
 * - 달성/미달성 업적 전체 목록
 * - 스트릭 현황 요약
 */
import { ACHIEVEMENTS, RARITY_COLOR } from '../data/achievements'
import { useGameStore } from '../store/useGameStore'

const RARITY_LABEL = { common: '일반', uncommon: '희귀', rare: '레어', legendary: '전설' }

export default function AchievementsPanel({ onClose, theme }) {
  const achievements = useGameStore(s => s.achievements)
  const streak       = useGameStore(s => s.streak)
  const maxStreak    = useGameStore(s => s.maxStreak)
  const totalBurgers = useGameStore(s => s.totalBurgers)

  const earned  = new Set(achievements)
  const earnedCount = achievements.length
  const totalCount  = ACHIEVEMENTS.length

  // 희귀도 순서
  const ORDER = ['legendary', 'rare', 'uncommon', 'common']
  const sorted = [...ACHIEVEMENTS].sort(
    (a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity)
  )

  const isDark = theme === 'hanok'

  return (
    <div className="flex flex-col gap-4" style={{ color: isDark ? '#3b1f0a' : undefined }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">🏆 업적 컬렉션</h2>
        <button onClick={onClose} className="text-gray-400 text-sm underline">닫기</button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard emoji="🍔" label="누적 버거" value={totalBurgers} />
        <StatCard emoji="🔥" label="현재 연속" value={`${streak}일`} />
        <StatCard emoji="🏅" label="최대 연속" value={`${maxStreak}일`} />
      </div>

      {/* 진행률 */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1 font-bold">
          <span>달성 업적</span>
          <span>{earnedCount} / {totalCount}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(earnedCount / totalCount) * 100}%`,
              background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
            }}
          />
        </div>
      </div>

      {/* 업적 목록 */}
      <div className="flex flex-col gap-2">
        {sorted.map(a => {
          const isEarned = earned.has(a.id)
          const rc       = RARITY_COLOR[a.rarity]
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-all"
              style={{
                background: isEarned ? rc.bg : '#f9fafb',
                border:     `2px solid ${isEarned ? rc.border : '#e5e7eb'}`,
                opacity:    isEarned ? 1 : 0.55,
              }}
            >
              {/* 이모지 */}
              <span
                className="text-3xl flex-shrink-0"
                style={{ filter: isEarned ? 'none' : 'grayscale(1)' }}
              >
                {a.emoji}
              </span>

              {/* 텍스트 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p
                    className="font-black text-sm"
                    style={{ color: isEarned ? rc.text : '#9ca3af' }}
                  >
                    {a.label}
                  </p>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={{
                      background: isEarned ? rc.border : '#e5e7eb',
                      color:      isEarned ? rc.text   : '#9ca3af',
                    }}
                  >
                    {RARITY_LABEL[a.rarity]}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{a.desc}</p>
              </div>

              {/* 체크 */}
              {isEarned && (
                <span className="text-xl flex-shrink-0">✅</span>
              )}
            </div>
          )
        })}
      </div>

      <button onClick={onClose} className="text-gray-400 text-sm underline text-center mt-1">
        닫기
      </button>
    </div>
  )
}

function StatCard({ emoji, label, value }) {
  return (
    <div className="bg-white rounded-2xl p-3 text-center shadow-sm border border-gray-100">
      <p className="text-2xl">{emoji}</p>
      <p className="text-xs text-gray-400 font-bold mt-0.5">{label}</p>
      <p className="text-lg font-black text-gray-800">{value}</p>
    </div>
  )
}
