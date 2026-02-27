/**
 * 부모가 생성했지만 자녀가 아직 참여 안 한 상태 (inviteCode 공유 화면)
 */
import { useGameStore } from '../store/useGameStore'

export default function WaitingPage() {
  const inviteCode = useGameStore((s) => s.inviteCode)

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center p-6">
      <h2 className="text-3xl font-black text-amber-800 mb-6">🍔 초대 코드</h2>

      <div className="bg-white rounded-3xl shadow-xl p-10 flex flex-col items-center gap-6 w-full max-w-sm">
        <p className="text-xl text-gray-600 text-center">
          이 코드를 자녀에게<br />알려주세요
        </p>

        <div className="text-6xl font-black tracking-widest text-amber-700 select-all">
          {inviteCode}
        </div>

        <p className="text-base text-gray-400 text-center">
          자녀가 코드를 입력하면<br />함께 게임을 시작할 수 있어요
        </p>
      </div>

      <p className="mt-8 text-gray-400 text-base animate-pulse">
        자녀 참여를 기다리는 중...
      </p>
    </div>
  )
}
