/**
 * Firestore 데이터 구조:
 *
 * families/{familyId}
 *   - inviteCode, parentUid, childUid, createdAt
 *
 * families/{familyId}/farm (단일 문서 'current')
 *   - stage: 'seed'|'growing'|'flowering'|'watered'|'ready'|'harvested'
 *   - seededAt: timestamp          새싹 심은 시각
 *   - floweredAt: timestamp        꽃 핀 시각 (seededAt + 2h)
 *   - wateredAt: timestamp         물 준 시각
 *   - readyAt: timestamp           채소 준비 완료 (wateredAt + 2min)
 *   - harvestedAt: timestamp       수확 시각
 *   - date: string                 오늘 날짜 (하루 1사이클)
 *
 * families/{familyId}/inventory (단일 문서 'current')
 *   - veggies: number              신선한 채소 수
 *   - veggieHarvestedAt: timestamp 수확 시각
 *   - veggieExpiresAt: timestamp   veggieHarvestedAt + 3일
 *   - bread: number
 *   - patty: number
 *   - bacon: number
 *   - sauce: number
 *
 * families/{familyId}/orders/{orderId}
 *   - items: { bread, patty, bacon, sauce }
 *   - orderedAt: timestamp
 *   - deliveryAt: timestamp        orderedAt + 24h
 *   - delivered: boolean
 *
 * families/{familyId}/gameState/{date}
 *   - burgerCount: number          누적 햄버거 수
 *   - burgerStartedAt, burgerCompletedAt
 *   - beanstalkAppeared, beanstalkChosen
 *
 * families/{familyId}/messages
 *   - senderId, senderRole, text, isAuto, createdAt
 */

import {
  doc, setDoc, getDoc, updateDoc,
  collection, addDoc, onSnapshot,
  query, orderBy, limit, serverTimestamp,
  where, getDocs, Timestamp,
} from 'firebase/firestore'
import { db } from './config'

const today = () => new Date().toISOString().split('T')[0]
const FARM_DOC      = (fid) => doc(db, 'families', fid, 'farm', 'current')
const INVENTORY_DOC = (fid) => doc(db, 'families', fid, 'inventory', 'current')

// ─── 가족 ────────────────────────────────────────────────────────────────────

export async function createFamily(parentUid) {
  const code      = Math.random().toString(36).substring(2, 8).toUpperCase()
  const familyRef = doc(collection(db, 'families'))
  await setDoc(familyRef, {
    inviteCode: code, parentUid, childUid: null,
    createdAt: serverTimestamp(),
  })
  return { familyId: familyRef.id, inviteCode: code }
}

export async function joinFamilyByCode(code, childUid) {
  const q    = query(collection(db, 'families'), where('inviteCode', '==', code.toUpperCase()))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('코드를 찾을 수 없습니다.')
  const familyDoc = snap.docs[0]
  if (familyDoc.data().childUid) throw new Error('이미 연결된 가족입니다.')
  await updateDoc(familyDoc.ref, { childUid })
  return familyDoc.id
}

export function watchFamily(familyId, callback) {
  const ref = doc(db, 'families', familyId)
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) callback({ ...snap.data(), familyId: snap.id })
  })
}

export async function getFamilyByUid(uid) {
  let q    = query(collection(db, 'families'), where('parentUid', '==', uid))
  let snap = await getDocs(q)
  if (!snap.empty) return { ...snap.docs[0].data(), familyId: snap.docs[0].id, role: 'parent' }
  q    = query(collection(db, 'families'), where('childUid', '==', uid))
  snap = await getDocs(q)
  if (!snap.empty) return { ...snap.docs[0].data(), familyId: snap.docs[0].id, role: 'child' }
  return null
}

// ─── 농장 ────────────────────────────────────────────────────────────────────

/** 새싹 심기 */
export async function seedFarm(familyId) {
  const now      = Date.now()
  const flowered = new Date(now + 2 * 60 * 60 * 1000) // 2시간 후 꽃 핌
  await setDoc(FARM_DOC(familyId), {
    stage: 'seed',
    date: today(),
    seededAt:   Timestamp.fromMillis(now),
    floweredAt: Timestamp.fromMillis(flowered.getTime()),
    wateredAt:  null,
    readyAt:    null,
    harvestedAt: null,
  })
}

/** 농장 실시간 구독 */
export function watchFarm(familyId, callback) {
  return onSnapshot(FARM_DOC(familyId), (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

/** 물주기 (부모 또는 자녀) */
export async function waterFarm(familyId) {
  const snap  = await getDoc(FARM_DOC(familyId))
  const farm  = snap.exists() ? snap.data() : null
  if (!farm || (farm.stage !== 'flowering' && farm.stage !== 'growing')) {
    throw new Error('아직 물을 줄 수 없어요.')
  }
  const now   = Date.now()
  const ready = new Date(now + 2 * 60 * 1000) // 2분 후 채소 준비
  await updateDoc(FARM_DOC(familyId), {
    stage:    'watered',
    wateredAt: Timestamp.fromMillis(now),
    readyAt:   Timestamp.fromMillis(ready.getTime()),
  })
}

/** 채소 수확 */
export async function harvestFarm(familyId) {
  const snap = await getDoc(FARM_DOC(familyId))
  const farm = snap.exists() ? snap.data() : null
  if (!farm || farm.stage !== 'ready') throw new Error('아직 수확할 수 없어요.')

  const now     = Date.now()
  const expires = new Date(now + 3 * 24 * 60 * 60 * 1000) // 3일 후 시듦

  await updateDoc(FARM_DOC(familyId), {
    stage: 'harvested',
    harvestedAt: Timestamp.fromMillis(now),
  })

  // 인벤토리에 채소 추가
  const invSnap = await getDoc(INVENTORY_DOC(familyId))
  const inv     = invSnap.exists() ? invSnap.data() : {}
  await setDoc(INVENTORY_DOC(familyId), {
    ...inv,
    veggies:            (inv.veggies || 0) + 3, // 수확 시 3개
    veggieHarvestedAt:  Timestamp.fromMillis(now),
    veggieExpiresAt:    Timestamp.fromMillis(expires.getTime()),
  }, { merge: true })
}

/** 농장 단계 자동 갱신 (flowering 확인) */
export async function syncFarmStage(familyId) {
  const snap = await getDoc(FARM_DOC(familyId))
  if (!snap.exists()) return null
  const farm = snap.data()
  const now  = Date.now()

  if (farm.stage === 'seed' || farm.stage === 'growing') {
    const flowered = farm.floweredAt?.toMillis?.() ?? 0
    if (now >= flowered) {
      await updateDoc(FARM_DOC(familyId), { stage: 'flowering' })
      return { ...farm, stage: 'flowering' }
    }
  }
  if (farm.stage === 'watered') {
    const ready = farm.readyAt?.toMillis?.() ?? 0
    if (now >= ready) {
      await updateDoc(FARM_DOC(familyId), { stage: 'ready' })
      return { ...farm, stage: 'ready' }
    }
  }
  return farm
}

// ─── 인벤토리 ────────────────────────────────────────────────────────────────

export function watchInventory(familyId, callback) {
  return onSnapshot(INVENTORY_DOC(familyId), (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

export async function consumeIngredients(familyId, items) {
  // items: { veggies: 1, bacon: 1, bread: 1, patty: 1, sauce: 1 }
  const snap = await getDoc(INVENTORY_DOC(familyId))
  const inv  = snap.exists() ? snap.data() : {}
  const update = {}
  for (const [key, qty] of Object.entries(items)) {
    const cur = inv[key] || 0
    if (cur < qty) throw new Error(`${key} 재고가 부족합니다.`)
    update[key] = cur - qty
  }
  await updateDoc(INVENTORY_DOC(familyId), update)
}

// ─── 발주 ────────────────────────────────────────────────────────────────────

export async function placeOrder(familyId, items) {
  // items: { bread: n, patty: n, bacon: n, sauce: n }
  const now      = Date.now()
  const delivery = new Date(now + 24 * 60 * 60 * 1000) // 24시간 후 배송
  const ref = await addDoc(collection(db, 'families', familyId, 'orders'), {
    items,
    orderedAt:   Timestamp.fromMillis(now),
    deliveryAt:  Timestamp.fromMillis(delivery.getTime()),
    delivered:   false,
  })
  return ref.id
}

export function watchOrders(familyId, callback) {
  const q = query(
    collection(db, 'families', familyId, 'orders'),
    where('delivered', '==', false),
    orderBy('deliveryAt', 'asc'),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })))
  })
}

/** 배송 완료 처리 (배송 시각이 지난 주문 자동 처리) */
export async function deliverPendingOrders(familyId) {
  const q    = query(collection(db, 'families', familyId, 'orders'), where('delivered', '==', false))
  const snap = await getDocs(q)
  const now  = Date.now()
  const invSnap = await getDoc(INVENTORY_DOC(familyId))
  let inv = invSnap.exists() ? invSnap.data() : {}
  let updated = false

  for (const d of snap.docs) {
    const order = d.data()
    const delAt = order.deliveryAt?.toMillis?.() ?? 0
    if (now >= delAt) {
      for (const [key, qty] of Object.entries(order.items || {})) {
        inv[key] = (inv[key] || 0) + qty
      }
      await updateDoc(d.ref, { delivered: true })
      updated = true
    }
  }
  if (updated) await setDoc(INVENTORY_DOC(familyId), inv, { merge: true })
}

// ─── 게임 상태 (버거 카운트 등) ──────────────────────────────────────────────

export function watchGameState(familyId, callback) {
  const ref = doc(db, 'families', familyId, 'gameState', today())
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

export async function startBurger(familyId) {
  const ref = doc(db, 'families', familyId, 'gameState', today())
  await setDoc(ref, { burgerStartedAt: serverTimestamp() }, { merge: true })
}

export async function completeBurger(familyId) {
  const ref  = doc(db, 'families', familyId, 'gameState', today())
  const snap = await getDoc(ref)
  const prev = snap.exists() ? snap.data() : {}
  const newCount = (prev.burgerCount || 0) + 1
  await updateDoc(ref, {
    burgerCompletedAt: serverTimestamp(),
    burgerCount: newCount,
  })
  return newCount
}

export async function waterPlant(familyId) {
  // 하위 호환 – waterFarm으로 위임
  return waterFarm(familyId)
}

// ─── 메시지 ──────────────────────────────────────────────────────────────────

export async function sendMessage(familyId, senderId, senderRole, text, isAuto = false) {
  await addDoc(collection(db, 'families', familyId, 'messages'), {
    senderId, senderRole, text, isAuto,
    createdAt: serverTimestamp(),
  })
}

export function watchMessages(familyId, callback) {
  const q = query(
    collection(db, 'families', familyId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(30),
  )
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse())
  })
}
