/**
 * 농장 모달
 * - 새싹 심기 → 2시간 후 꽃 핌 → 물주기 → 2분 후 채소 수확
 * - 부모/자녀 모두 물주기 가능
 * - 하루 1사이클
 */
import { useState, useEffect } from 'react'
import {
  seedFarm, waterFarm, harvestFarm, syncFarmStage,
  sendMessage,
} from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'

const STAGE_INFO = {
  null:       { emoji: '🌑', label: '텅 빈 밭',   desc: '새싹을 심어보세요.' },
  seed:       { emoji: '🌱', label: '새싹',        desc: '잘 자라고 있어요. 2시간 후 꽃이 피어요.' },
  growing:    { emoji: '🌿', label: '자라는 중',   desc: '조금만 더 기다려요...' },
  flowering:  { emoji: '🌸', label: '꽃이 피었어요!', desc: '물을 주면 채소가 자라요!' },
  watered:    { emoji: '💧', label: '물을 줬어요', desc: '2분 후 채소를 수확할 수 있어요.' },
  ready:      { emoji: '🥬', label: '수확 가능!',  desc: '채소가 다 자랐어요!' },
  harvested:  { emoji: '✅', label: '수확 완료',   desc: '오늘 수확은 끝났어요.' },
}

function useCountdown(targetMs) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!targetMs) return
    const tick = () => {
      const d = Math.max(0, targetMs - Date.now())
      setLeft(d)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetMs])
  return left
}

function formatMs(ms) {
  if (ms <= 0) return '0:00'
  const tot = Math.ceil(ms / 1000)
  const m   = Math.floor(tot / 60)
  const s   = tot % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function Farm({ farm, onClose }) {
  const { role, familyId, user } = useGameStore(s => s)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')

  const stage = farm?.stage ?? null
  const info  = STAGE_INFO[stage] ?? STAGE_INFO[null]

  // 카운트다운
  const flowerMs  = farm?.floweredAt?.toMillis?.() ?? farm?.floweredAt?.seconds * 1000 ?? 0
  const readyMs   = farm?.readyAt?.toMillis?.()    ?? farm?.readyAt?.seconds * 1000    ?? 0
  const toFlower  = useCountdown(stage === 'seed' || stage === 'growing' ? flowerMs : 0)
  const toReady   = useCountdown(stage === 'watered' ? readyMs : 0)

  // 주기적으로 서버 단계 동기화 (꽃 핌 / 수확 가능 감지)
  useEffect(() => {
    if (!familyId) return
    if (stage !== 'seed' && stage !== 'growing' && stage !== 'watered') return
    const id = setInterval(() => syncFarmStage(familyId), 15_000)
    return () => clearInterval(id)
  }, [familyId, stage])

  async function handleSeed() {
    setBusy(true); setError('')
    try {
      await seedFarm(familyId)
      await sendMessage(familyId, user.uid, role, '🌱 새싹을 심었어요!', true)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function handleWater() {
    setBusy(true); setError('')
    try {
      await waterFarm(familyId)
      await sendMessage(familyId, user.uid, role,
        role === 'parent' ? '오늘 부모님이 농장을 돌봤어요. 🌿' : '아이가 농장에 물을 줬어요. 💧',
        true)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function handleHarvest() {
    setBusy(true); setError('')
    try {
      await harvestFarm(familyId)
      await sendMessage(familyId, user.uid, role, '🥬 채소를 수확했어요!', true)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <h2 className="text-2xl font-black text-green-800">🌾 농장</h2>

      {/* 현재 상태 */}
      <div className="bg-green-50 rounded-3xl p-6 w-full text-center">
        <div className="text-6xl mb-2">{info.emoji}</div>
        <p className="text-xl font-black text-green-800">{info.label}</p>
        <p className="text-sm text-gray-500 mt-1">{info.desc}</p>

        {/* 카운트다운 */}
        {toFlower > 0 && (
          <p className="mt-3 text-base font-bold text-blue-600">
            꽃 피기까지 ⏳ {formatMs(toFlower)}
          </p>
        )}
        {toReady > 0 && (
          <p className="mt-3 text-base font-bold text-teal-600">
            수확까지 ⏳ {formatMs(toReady)}
          </p>
        )}
      </div>

      {/* 액션 버튼 */}
      {error && <p className="text-red-500 font-bold text-center">{error}</p>}

      {/* 새싹 심기 */}
      {(stage === null || stage === 'harvested') && (
        <button
          onClick={handleSeed}
          disabled={busy}
          className="btn-elder bg-green-500 text-white w-full"
        >
          {busy ? '심는 중...' : '🌱 새싹 심기'}
        </button>
      )}

      {/* 물주기 */}
      {(stage === 'flowering') && (
        <button
          onClick={handleWater}
          disabled={busy}
          className="btn-elder bg-blue-500 text-white w-full"
        >
          {busy ? '물 주는 중...' : '💧 물 주기'}
        </button>
      )}

      {/* 수확 */}
      {stage === 'ready' && (
        <button
          onClick={handleHarvest}
          disabled={busy}
          className="btn-elder bg-amber-500 text-white w-full"
        >
          {busy ? '수확 중...' : '🥬 채소 수확하기'}
        </button>
      )}

      {/* 자라는 중 / 물 주고 기다리는 중 */}
      {(stage === 'seed' || stage === 'growing' || stage === 'watered') && (
        <div className="w-full bg-gray-100 rounded-2xl p-4 text-center text-gray-500">
          기다리는 중... ☁️
        </div>
      )}

      <button onClick={onClose} className="text-gray-400 underline text-sm mt-2">
        닫기
      </button>
    </div>
  )
}
