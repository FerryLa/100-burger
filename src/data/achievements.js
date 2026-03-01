/**
 * 업적(뱃지) 정의
 * check({ total, streak, maxStreak, beanstalkCount }) => boolean
 */
export const ACHIEVEMENTS = [
  {
    id:    'first_burger',
    emoji: '🍔',
    label: '첫 번째 버거!',
    desc:  '드디어 첫 햄버거를 완성했어요',
    rarity: 'common',
    check: ({ total }) => total >= 1,
  },
  {
    id:    'burger_5',
    emoji: '⭐',
    label: '5개 달성',
    desc:  '햄버거 5개 완성',
    rarity: 'common',
    check: ({ total }) => total >= 5,
  },
  {
    id:    'burger_10',
    emoji: '🌟',
    label: '10개 달성',
    desc:  '햄버거 10개 완성',
    rarity: 'uncommon',
    check: ({ total }) => total >= 10,
  },
  {
    id:    'burger_25',
    emoji: '💫',
    label: '25개 달성',
    desc:  '햄버거 25개 완성 — 단골손님!',
    rarity: 'uncommon',
    check: ({ total }) => total >= 25,
  },
  {
    id:    'burger_50',
    emoji: '🏅',
    label: '반백 달성',
    desc:  '햄버거 50개 완성 — 헌신적인 가족!',
    rarity: 'rare',
    check: ({ total }) => total >= 50,
  },
  {
    id:    'burger_100',
    emoji: '🏆',
    label: '100개 전설!',
    desc:  '햄버거 100개 완성 — 쿠폰 GET!',
    rarity: 'legendary',
    check: ({ total }) => total >= 100,
  },
  {
    id:    'streak_3',
    emoji: '🔥',
    label: '3일 연속!',
    desc:  '3일 연속으로 버거를 완성했어요',
    rarity: 'uncommon',
    check: ({ streak }) => streak >= 3,
  },
  {
    id:    'streak_7',
    emoji: '🔥🔥',
    label: '7일 연속!',
    desc:  '일주일 연속 버거 완성 — 열정 가득!',
    rarity: 'rare',
    check: ({ streak }) => streak >= 7,
  },
  {
    id:    'streak_14',
    emoji: '🔥🔥🔥',
    label: '2주 연속!',
    desc:  '2주 연속 버거 완성 — 가족 식당 개업?',
    rarity: 'rare',
    check: ({ streak }) => streak >= 14,
  },
  {
    id:    'streak_30',
    emoji: '🌙',
    label: '한 달 연속!',
    desc:  '30일 연속 버거 완성 — 전설의 가족',
    rarity: 'legendary',
    check: ({ streak }) => streak >= 30,
  },
  {
    id:    'beanstalk_1',
    emoji: '🌱',
    label: '잭과 콩나물',
    desc:  '잭과 콩나물 이벤트를 처음 경험했어요!',
    rarity: 'uncommon',
    check: ({ beanstalkCount }) => beanstalkCount >= 1,
  },
  {
    id:    'beanstalk_5',
    emoji: '🌳',
    label: '콩나물 농부',
    desc:  '잭과 콩나물 5회 달성 — 행운의 씨앗!',
    rarity: 'rare',
    check: ({ beanstalkCount }) => beanstalkCount >= 5,
  },
]

export const RARITY_COLOR = {
  common:    { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
  uncommon:  { bg: '#ecfdf5', text: '#059669', border: '#6ee7b7' },
  rare:      { bg: '#eff6ff', text: '#2563eb', border: '#93c5fd' },
  legendary: { bg: '#fefce8', text: '#d97706', border: '#fbbf24' },
}

/** 아직 없는 업적 중 조건을 만족하는 것만 반환 */
export function checkNewAchievements(existingIds, stats) {
  const has = new Set(existingIds)
  return ACHIEVEMENTS
    .filter(a => !has.has(a.id) && a.check(stats))
    .map(a => a.id)
}
