/**
 * WeeklyChallenge
 * 이번 주 챌린지 진행도 카드
 */
import { useEffect, useState } from 'react'
import { watchWeeklyChallenge, markWeeklyChallengeComplete } from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'

export default function WeeklyChallenge({ onClose, theme }) {
  const { familyId } = useGameStore(s => s)
  const [data,    setData]    = useState(null)   // { challenge, progress, weekKey }
  const [claimed, setClaimed] = useState(false)

  useEffect(() => {
    if (!familyId) return
    const unsub = watchWeeklyChallenge(familyId, setData)
    return unsub
  }, [familyId])

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-400 text-sm">로딩 중...</p>
      </div>
    )
  }

  const { challenge, progress } = data
  const isDark = theme === 'hanok'

  // 현재 진행도 계산
  const current = getProgress(challenge.type, progress)
  const pct     = Math.min((current / challenge.target) * 100, 100)
  const isDone  = current >= challenge.target
  const alreadyClaimed = progress.completed

  async function handleClaim() {
    if (!isDone || alreadyClaimed || claimed) return
    setClaimed(true)
    await markWeeklyChallengeComplete(familyId)
  }

  return (
    <div className="flex flex-col gap-5" style={{ color: isDark ? '#3b1f0a' : undefined }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black">📅 이번 주 챌린지</h2>
        <button onClick={onClose} className="text-gray-400 text-sm underline">닫기</button>
      </div>

      {/* 주차 표시 */}
      <p className="text-xs text-gray-400 font-bold -mt-3">{data.weekKey}</p>

      {/* 챌린지 카드 */}
      <div
        className="rounded-3xl p-5 flex flex-col gap-4"
        style={{
          background: isDone
            ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)'
            : 'linear-gradient(135deg, #fef3c7, #fde68a)',
          border: `2px solid ${isDone ? '#34d399' : '#f59e0b'}`,
        }}
      >
        {/* 이모지 + 제목 */}
        <div className="flex items-center gap-3">
          <span className="text-5xl">{challenge.emoji}</span>
          <div>
            <p className="text-xl font-black" style={{ color: isDone ? '#065f46' : '#92400e' }}>
              {challenge.title}
            </p>
            <p className="text-sm" style={{ color: isDone ? '#047857' : '#b45309' }}>
              {challenge.desc}
            </p>
          </div>
        </div>

        {/* 진행률 바 */}
        <div>
          <div className="flex justify-between text-xs font-bold mb-1"
            style={{ color: isDone ? '#047857' : '#b45309' }}>
            <span>진행도</span>
            <span>{current} / {challenge.target}</span>
          </div>
          <div className="w-full bg-white/60 rounded-full h-5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: isDone
                  ? 'linear-gradient(90deg, #34d399, #10b981)'
                  : 'linear-gradient(90deg, #f59e0b, #d97706)',
              }}
            />
          </div>
        </div>

        {/* 보상 */}
        <div className="bg-white/60 rounded-2xl px-4 py-2 flex items-center gap-2">
          <span className="text-lg">🎁</span>
          <div>
            <p className="text-xs text-gray-500 font-bold">완료 보상</p>
            <p className="text-sm font-black" style={{ color: isDone ? '#065f46' : '#92400e' }}>
              {challenge.reward}
            </p>
          </div>
        </div>

        {/* 완료 버튼 / 상태 */}
        {alreadyClaimed || claimed ? (
          <div className="text-center py-3 rounded-2xl bg-green-100 border-2 border-green-300">
            <p className="text-2xl">✅</p>
            <p className="font-black text-green-700">이번 주 챌린지 완료!</p>
            <p className="text-xs text-green-600">다음 주 월요일에 새 챌린지가 시작돼요 🎉</p>
          </div>
        ) : isDone ? (
          <button
            onClick={handleClaim}
            className="w-full py-4 rounded-2xl text-white font-black text-lg shadow-lg
                       active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(90deg, #10b981, #059669)' }}
          >
            🎁 보상 받기!
          </button>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm font-bold" style={{ color: '#b45309' }}>
              앞으로 {challenge.target - current}개 더 달성하면 보상!
            </p>
          </div>
        )}
      </div>

      {/* 챌린지 타입 힌트 */}
      <div className="bg-gray-50 rounded-2xl px-4 py-3 text-xs text-gray-500">
        <p className="font-bold mb-1">💡 진행 방법</p>
        <p>{getHint(challenge.type)}</p>
      </div>

      <button onClick={onClose} className="text-gray-400 text-sm underline text-center">
        닫기
      </button>
    </div>
  )
}

function getProgress(type, progress) {
  switch (type) {
    case 'burger_count':  return progress.burgerCount   || 0
    case 'streak':        return progress.streakMax     || 0
    case 'beanstalk':     return progress.beanstalkCount || 0
    case 'farm_harvest':  return progress.harvestCount   || 0
    default:              return 0
  }
}

function getHint(type) {
  switch (type) {
    case 'burger_count':  return '주방에서 매일 햄버거를 완성하면 카운트가 올라가요'
    case 'streak':        return '하루도 빠지지 말고 연속으로 버거를 완성하세요'
    case 'beanstalk':     return '농장에서 씨앗을 심을 때 20% 확률로 콩나물 이벤트 발생!'
    case 'farm_harvest':  return '토마토와 양상추를 수확할 때마다 카운트가 올라가요'
    default:              return ''
  }
}
