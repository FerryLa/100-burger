/**
 * 주간 챌린지 정의
 *
 * type: 'burger_count' | 'streak' | 'beanstalk' | 'farm_harvest'
 *   - burger_count: 이번 주 버거 N개 완성
 *   - streak:       이번 주 N일 연속 달성
 *   - beanstalk:    잭과 콩나물 N회 경험
 *   - farm_harvest: 농장 수확 N회
 *
 * 매주 월요일 기준으로 weekKey (YYYY-Www) 로 회전됨
 */
export const CHALLENGE_POOL = [
  {
    id: 'weekly_burger_3',
    emoji: '🍔',
    title: '이번 주 버거 3개!',
    desc: '이번 주에 햄버거를 3개 완성하세요',
    type: 'burger_count',
    target: 3,
    reward: '가족 칭찬 도장 🌟',
  },
  {
    id: 'weekly_burger_5',
    emoji: '🍔🍔',
    title: '이번 주 버거 5개!',
    desc: '이번 주에 햄버거를 5개 완성하세요',
    type: 'burger_count',
    target: 5,
    reward: '슈퍼 가족 칭찬 🌟🌟',
  },
  {
    id: 'weekly_streak_5',
    emoji: '🔥',
    title: '5일 연속 달성!',
    desc: '5일 연속으로 버거를 완성하세요',
    type: 'streak',
    target: 5,
    reward: '불꽃 가족 뱃지 🏅',
  },
  {
    id: 'weekly_beanstalk_2',
    emoji: '🌱',
    title: '콩나물 2번 경험!',
    desc: '잭과 콩나물 이벤트를 2번 경험하세요',
    type: 'beanstalk',
    target: 2,
    reward: '행운의 씨앗 ✨',
  },
  {
    id: 'weekly_farm_4',
    emoji: '🥬',
    title: '농장 4번 수확!',
    desc: '이번 주에 농장에서 4번 수확하세요',
    type: 'farm_harvest',
    target: 4,
    reward: '농부 가족 칭찬 🌿',
  },
  {
    id: 'weekly_burger_7',
    emoji: '🏆',
    title: '매일 버거 도전!',
    desc: '이번 주 7일 모두 버거를 완성하세요',
    type: 'burger_count',
    target: 7,
    reward: '이번 주 최강 가족! 🥇',
  },
]

/** ISO 주차 키 반환 (YYYY-Www) — 매주 월요일 기준 */
export function getWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/** 주차 키로 이번 주 챌린지 결정 (풀에서 순환) */
export function getChallengeForWeek(weekKey = getWeekKey()) {
  // 주차 번호를 숫자로 추출해서 풀 순환
  const weekNum = parseInt(weekKey.split('-W')[1], 10)
  return CHALLENGE_POOL[weekNum % CHALLENGE_POOL.length]
}
