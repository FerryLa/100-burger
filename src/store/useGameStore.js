import { create } from 'zustand'

export const useGameStore = create((set) => ({
  // 유저
  user: null,
  role: null,           // 'parent' | 'child'
  familyId: null,
  inviteCode: null,
  familyConnected: false,

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
  }),
  setGameState: (gameState) => set({ gameState }),
  setMessages: (messages) => set({ messages }),
}))
