import { create } from 'zustand'
import { getAuth } from 'firebase/auth'

const INITIAL = {
  user: null, role: null, familyId: null, inviteCode: null, familyConnected: false,
  totalBurgers: 0, streak: 0, maxStreak: 0, achievements: [],
  gameState: null, messages: [],
}

export const useGameStore = create((set) => ({
  // 유저
  user: null,
  role: null,           // 'parent' | 'child'
  familyId: null,
  inviteCode: null,
  familyConnected: false,

  // 누적 달성 (쿠폰 기준)
  totalBurgers: 0,

  // 스트릭 & 업적
  streak:       0,
  maxStreak:    0,
  achievements: [],  // string[]  (달성한 업적 id 배열)

  // 게임 상태 (Firestore 실시간 미러)
  gameState: null,

  // 메시지
  messages: [],

  setUser: (user) => set({ user }),
  setFamily: (data) => set({
    role: data.role,
    familyId: data.familyId,
    inviteCode: data.inviteCode,
    familyConnected: !!(data.parentUid && data.childUid),
    totalBurgers: data.totalBurgers || 0,
    streak:       data.streak       || 0,
    maxStreak:    data.maxStreak    || 0,
    achievements: data.achievements || [],
  }),
  setFamilyMeta: ({ totalBurgers, streak, maxStreak, achievements }) =>
    set({ totalBurgers, streak, maxStreak, achievements }),
  setGameState:  (gameState)  => set({ gameState }),
  setMessages:   (messages)   => set({ messages }),
  setTotalBurgers: (n)        => set({ totalBurgers: n }),
  logout: async () => {
    await getAuth().signOut()
    set(INITIAL)
  },
}))
