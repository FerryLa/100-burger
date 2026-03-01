/**
 * 농장 모달
 * - cropType: 'tomato' | 'lettuce'
 * - 새싹 심기 → 2시간 후 꽃 핌 → 물주기 → 2분 후 수확
 * - 수확 시: 손에 들고 나오기 (onHarvest 콜백)
 */
import { useState, useEffect } from 'react'
import {
  seedFarm, waterFarm, harvestFarmToHands, syncFarmStage,
  sendMessage,
} from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'

const CROP_META = {
  tomato:  { emoji: '🍅', label: '토마토',  readyEmoji: '🍅', seedEmoji: '🌱' },
  lettuce: { emoji: '🥬', label: '양상추',  readyEmoji: '🥬', seedEmoji: '🌿' },
}

const STAGE_INFO = {
  null:      { emoji: '🌑', label: '텅 빈 밭',    desc: '새싹을 심어보세요.' },
  seed:      { emoji: '🌱', label: '새싹',         desc: '잘 자라고 있어요. 2시간 후 꽃이 피어요.' },
  growing:   { emoji: '🌿', label: '자라는 중',    desc: '조금만 더 기다려요...' },
  flowering: { emoji: '🌸', label: '꽃이 피었어요!', desc: '물을 주면 채소가 자라요!' },
  watered:   { emoji: '💧', label: '물을 줬어요',  desc: '2분 후 채소를 수확할 수 있어요.' },
  ready:     { emoji: '✅', label: '수확 가능!',   desc: '채소가 다 자랐어요! 수확해서 들고 가세요.' },
  harvested: { emoji: '✅', label: '수확 완료',    desc: '오늘 수확은 끝났어요.' },
}

function useCountdown(targetMs) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (!targetMs) return
    const tick = () => { setLeft(Math.max(0, targetMs - Date.now())) }
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

export default function Farm({ farm, cropType, onHarvest, onClose }) {
  const { role, familyId, user } = useGameStore(s => s)
  const [busy,  setBusy]  = useState(false)
  const [error, setError] = useState('')

  const meta  = CROP_META[cropType] ?? CROP_META.tomato
  const stage = farm?.stage ?? null
  const info  = STAGE_INFO[stage] ?? STAGE_INFO[null]

  // 하루 1사이클 제한: 오늘 이미 수확 완료면 심기 불가
  const todayStr       = new Date().toISOString().split('T')[0]
  const harvestedToday = stage === 'harvested' && farm?.date === todayStr

  const flowerMs = farm?.floweredAt?.toMillis?.() ?? (farm?.floweredAt?.seconds ?? 0) * 1000
  const readyMs  = farm?.readyAt?.toMillis?.()    ?? (farm?.readyAt?.seconds    ?? 0) * 1000
  const toFlower = useCountdown(stage === 'seed' || stage === 'growing' ? flowerMs : 0)
  const toReady  = useCountdown(stage === 'watered' ? readyMs : 0)

  // 주기적 서버 동기화
  useEffect(() => {
    if (!familyId) return
    if (!['seed', 'growing', 'watered'].includes(stage)) return
    const id = setInterval(() => syncFarmStage(familyId), 15_000)
    return () => clearInterval(id)
  }, [familyId, stage])

  async function handleSeed() {
    setBusy(true); setError('')
    try {
      await seedFarm(familyId, cropType)
      await sendMessage(familyId, user.uid, role,
        `${meta.seedEmoji} ${meta.label} 새싹을 심었어요!`, true)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function handleWater() {
    setBusy(true); setError('')
    try {
      await waterFarm(familyId, cropType)
      await sendMessage(familyId, user.uid, role,
        `💧 ${meta.label} 농장에 물을 줬어요!`, true)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function handleHarvest() {
    setBusy(true); setError('')
    try {
      const qty = await harvestFarmToHands(familyId, cropType)
      await sendMessage(familyId, user.uid, role,
        `${meta.readyEmoji} ${meta.label} ${qty}개를 수확했어요! 냉장고에 넣어주세요.`, true)
      // 손에 들고 나가기
      onHarvest?.(cropType, qty)
      onClose?.()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <h2 className="text-2xl font-black text-green-800">
        {meta.emoji} {meta.label} 농장
      </h2>

      {/* 현재 상태 */}
      <div className="bg-green-50 rounded-3xl p-6 w-full text-center">
        <div className="text-6xl mb-2">
          {stage === 'ready' ? meta.readyEmoji : info.emoji}
        </div>
        <p className="text-xl font-black text-green-800">{info.label}</p>
        <p className="text-sm text-gray-500 mt-1">{info.desc}</p>

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

      {error && <p className="text-red-500 font-bold text-center">{error}</p>}

      {/* 새싹 심기 */}
      {(stage === null || stage === 'harvested') && !harvestedToday && (
        <button onClick={handleSeed} disabled={busy}
          className="btn-elder bg-green-500 text-white w-full">
          {busy ? '심는 중...' : `${meta.seedEmoji} 새싹 심기`}
        </button>
      )}
      {harvestedToday && (
        <div className="w-full bg-green-50 border-2 border-green-200 rounded-2xl p-4 text-center">
          <p className="text-green-700 font-bold">🌙 오늘 수확 완료!</p>
          <p className="text-green-500 text-sm mt-1">내일 다시 심을 수 있어요.</p>
        </div>
      )}

      {/* 물주기 */}
      {stage === 'flowering' && (
        <button onClick={handleWater} disabled={busy}
          className="btn-elder bg-blue-500 text-white w-full">
          {busy ? '물 주는 중...' : '💧 물 주기'}
        </button>
      )}

      {/* 수확 → 손에 들기 */}
      {stage === 'ready' && (
        <button onClick={handleHarvest} disabled={busy}
          className="btn-elder bg-amber-500 text-white w-full">
          {busy ? '수확 중...' : `${meta.readyEmoji} 수확해서 들기`}
        </button>
      )}

      {/* 기다리는 중 */}
      {['seed', 'growing', 'watered'].includes(stage) && (
        <div className="w-full bg-gray-100 rounded-2xl p-4 text-center text-gray-500">
          기다리는 중... ☁️
        </div>
      )}

      {/* 수확 후 안내 */}
      {stage === 'ready' && (
        <p className="text-xs text-amber-700 text-center bg-amber-50 rounded-xl p-2 w-full">
          🧺 수확하면 손에 들고 냉장고까지 직접 운반해야 해요!
        </p>
      )}

      <button onClick={onClose} className="text-gray-400 underline text-sm mt-2">
        닫기
      </button>
    </div>
  )
}
