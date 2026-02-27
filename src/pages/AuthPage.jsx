import { useState } from 'react'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { createFamily, joinFamilyByCode } from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'

export default function AuthPage() {
  const [step, setStep] = useState('role')     // 'role' | 'parent-code' | 'child-join'
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const setUser = useGameStore((s) => s.setUser)
  const setFamily = useGameStore((s) => s.setFamily)

  async function handleParent() {
    setLoading(true)
    setError('')
    try {
      const auth = getAuth()
      const { user } = await signInAnonymously(auth)
      setUser(user)
      const { familyId, inviteCode } = await createFamily(user.uid)
      setFamily({ role: 'parent', familyId, inviteCode, parentUid: user.uid, childUid: null })
    } catch (e) {
      setError('오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  async function handleChildJoin() {
    if (code.length < 6) return
    setLoading(true)
    setError('')
    try {
      const auth = getAuth()
      const { user } = await signInAnonymously(auth)
      setUser(user)
      const familyId = await joinFamilyByCode(code, user.uid)
      setFamily({ role: 'child', familyId, inviteCode: null, parentUid: null, childUid: user.uid })
    } catch (e) {
      setError(e.message || '코드를 확인해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center justify-center p-6">
      <h1 className="text-5xl font-black text-amber-800 mb-2">🍔</h1>
      <h1 className="text-4xl font-black text-amber-800 mb-1">햄버거 만들기</h1>
      <p className="text-lg text-amber-600 mb-12">가족이 함께 만드는 행복</p>

      {step === 'role' && (
        <div className="flex flex-col gap-5 w-full max-w-sm">
          <button
            onClick={handleParent}
            disabled={loading}
            className="btn-elder bg-green-500 text-white hover:bg-green-600"
          >
            👨‍👩‍👧 부모로 시작하기
          </button>
          <button
            onClick={() => setStep('child-join')}
            className="btn-elder bg-blue-500 text-white hover:bg-blue-600"
          >
            👦 자녀로 참여하기
          </button>
        </div>
      )}

      {step === 'child-join' && (
        <div className="flex flex-col gap-5 w-full max-w-sm">
          <p className="text-xl text-center text-gray-600">
            부모님이 알려주신 <br />
            <strong>초대 코드</strong>를 입력해주세요
          </p>
          <input
            type="text"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="예: AB12CD"
            className="text-center text-4xl font-black tracking-widest border-4 border-amber-400
                       rounded-2xl py-4 bg-white focus:outline-none focus:border-amber-600 uppercase"
          />
          {error && <p className="text-red-500 text-center text-lg">{error}</p>}
          <button
            onClick={handleChildJoin}
            disabled={loading || code.length < 6}
            className="btn-elder bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
          >
            {loading ? '연결 중...' : '참여하기'}
          </button>
          <button onClick={() => setStep('role')} className="text-gray-400 text-lg underline">
            뒤로
          </button>
        </div>
      )}

      {loading && step === 'role' && (
        <p className="mt-4 text-amber-600 text-lg">잠시만 기다려주세요...</p>
      )}
    </div>
  )
}
