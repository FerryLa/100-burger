/**
 * Firestore 데이터 구조:
 *
 * families/{familyId}
 *   - inviteCode, parentUid, childUid, createdAt
 *
 * families/{familyId}/farm/{cropType}  ('tomato' | 'lettuce')
 *   - stage: 'seed'|'growing'|'flowering'|'watered'|'ready'|'harvested'
 *   - seededAt, floweredAt, wateredAt, readyAt, harvestedAt: timestamp
 *   - date: string (하루 1사이클)
 *
 * families/{familyId}/inventory (단일 문서 'current')
 *   - veggies: number
 *   - veggieHarvestedAt, veggieExpiresAt: timestamp
 *   - bread, patty, bacon, sauce: number
 *
 * families/{familyId}/orders/{orderId}
 *   - items, orderedAt, deliveryAt, delivered
 *
 * families/{familyId}/gameState/{date}
 *   - burgerCount, burgerStartedAt, burgerCompletedAt
 *
 * families/{familyId}/positions/{role}  ('parent' | 'child')
 *   - x, y, updatedAt
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
import { checkNewAchievements } from '../data/achievements'
import { getWeekKey, getChallengeForWeek } from '../data/weeklyChallenges'

const today = () => new Date().toISOString().split('T')[0]
const FARM_DOC      = (fid, type) => doc(db, 'families', fid, 'farm', type)
const INVENTORY_DOC = (fid) => doc(db, 'families', fid, 'inventory', 'current')
const POSITION_DOC  = (fid, role) => doc(db, 'families', fid, 'positions', role)

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

/** 스트릭·업적·totalBurgers 실시간 구독 */
export function watchFamilyMeta(familyId, callback) {
  const ref = doc(db, 'families', familyId)
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return
    const d = snap.data()
    callback({
      totalBurgers:   d.totalBurgers   || 0,
      streak:         d.streak         || 0,
      maxStreak:      d.maxStreak      || 0,
      achievements:   d.achievements   || [],
      beanstalkCount: d.beanstalkCount || 0,
    })
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

// ─── 농장 (cropType: 'tomato' | 'lettuce') ──────────────────────────────────

/** 새싹 심기 (20% 확률로 잭과 콩나물 이벤트 발생) */
export async function seedFarm(familyId, cropType) {
  const now         = Date.now()
  const isBeanstalk = Math.random() < 0.20   // 20% 확률
  // 콩나물 이벤트 시: 30초 후 꽃 핌 (평소 2시간 대신)
  const floweredAt  = isBeanstalk
    ? new Date(now + 30 * 1000)
    : new Date(now + 2 * 60 * 60 * 1000)

  await setDoc(FARM_DOC(familyId, cropType), {
    stage:      'seed',
    date:       today(),
    seededAt:   Timestamp.fromMillis(now),
    floweredAt: Timestamp.fromMillis(floweredAt.getTime()),
    wateredAt:  null,
    readyAt:    null,
    harvestedAt: null,
    beanstalk:  isBeanstalk,   // 잭과 콩나물 이벤트 플래그
  })

  // 잭과 콩나물 카운터 증가 (업적 추적)
  if (isBeanstalk) {
    const famRef  = doc(db, 'families', familyId)
    const famSnap = await getDoc(famRef)
    const famData = famSnap.exists() ? famSnap.data() : {}
    const beanstalkCount = (famData.beanstalkCount || 0) + 1

    // 잭과 콩나물 업적 즉시 체크
    const existing        = famData.achievements || []
    const newAchievements = checkNewAchievements(existing, {
      total:         famData.totalBurgers  || 0,
      streak:        famData.streak        || 0,
      maxStreak:     famData.maxStreak     || 0,
      beanstalkCount,
    })
    await updateDoc(famRef, {
      beanstalkCount,
      achievements: [...existing, ...newAchievements],
    })
    return { isBeanstalk: true, newAchievements }
  }

  return { isBeanstalk: false, newAchievements: [] }
}

/** 농장 실시간 구독 */
export function watchFarm(familyId, cropType, callback) {
  return onSnapshot(FARM_DOC(familyId, cropType), (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

/** 물주기 */
export async function waterFarm(familyId, cropType) {
  const snap  = await getDoc(FARM_DOC(familyId, cropType))
  const farm  = snap.exists() ? snap.data() : null
  if (!farm || (farm.stage !== 'flowering' && farm.stage !== 'growing')) {
    throw new Error('아직 물을 줄 수 없어요.')
  }
  const now   = Date.now()
  const ready = new Date(now + 2 * 60 * 1000) // 2분 후 채소 준비
  await updateDoc(FARM_DOC(familyId, cropType), {
    stage:    'watered',
    wateredAt: Timestamp.fromMillis(now),
    readyAt:   Timestamp.fromMillis(ready.getTime()),
  })
}

/**
 * 채소 수확 → 인벤토리에 직접 추가 (기존 호환용)
 * 새 방식은 harvestFarmToHands 사용
 */
export async function harvestFarm(familyId, cropType) {
  const qty = await harvestFarmToHands(familyId, cropType)

  // 인벤토리에 채소 추가
  const now     = Date.now()
  const expires = new Date(now + 3 * 24 * 60 * 60 * 1000)
  const invSnap = await getDoc(INVENTORY_DOC(familyId))
  const inv     = invSnap.exists() ? invSnap.data() : {}
  await setDoc(INVENTORY_DOC(familyId), {
    ...inv,
    veggies:           (inv.veggies || 0) + qty,
    veggieHarvestedAt: Timestamp.fromMillis(now),
    veggieExpiresAt:   Timestamp.fromMillis(expires.getTime()),
  }, { merge: true })
  return qty
}

/**
 * 채소 수확 → 손에 들고 나오기 (carrying 방식)
 * 인벤토리에는 넣지 않음. qty 반환.
 */
export async function harvestFarmToHands(familyId, cropType) {
  const snap = await getDoc(FARM_DOC(familyId, cropType))
  const farm = snap.exists() ? snap.data() : null
  if (!farm || farm.stage !== 'ready') throw new Error('아직 수확할 수 없어요.')

  await updateDoc(FARM_DOC(familyId, cropType), {
    stage: 'harvested',
    harvestedAt: Timestamp.fromMillis(Date.now()),
  })

  // 주간 챌린지 수확 카운터
  await incrementWeeklyProgress(familyId, 'harvestCount').catch(() => {})

  return 3 // 수확 수량
}

/** 수확한 채소를 냉장고에 보관 */
export async function storeVeggiesInFridge(familyId, qty) {
  const now     = Date.now()
  const expires = new Date(now + 3 * 24 * 60 * 60 * 1000)
  const invSnap = await getDoc(INVENTORY_DOC(familyId))
  const inv     = invSnap.exists() ? invSnap.data() : {}
  await setDoc(INVENTORY_DOC(familyId), {
    ...inv,
    veggies:           (inv.veggies || 0) + qty,
    veggieHarvestedAt: Timestamp.fromMillis(now),
    veggieExpiresAt:   Timestamp.fromMillis(expires.getTime()),
  }, { merge: true })
}

/** 농장 단계 자동 갱신 (꽃 핌 / 수확 가능 감지) */
export async function syncFarmStage(familyId) {
  await Promise.all(['tomato', 'lettuce'].map(type => syncFarmType(familyId, type)))
}

async function syncFarmType(familyId, cropType) {
  const snap = await getDoc(FARM_DOC(familyId, cropType))
  if (!snap.exists()) return null
  const farm = snap.data()
  const now  = Date.now()

  if (farm.stage === 'seed' || farm.stage === 'growing') {
    const flowered = farm.floweredAt?.toMillis?.() ?? 0
    if (now >= flowered) {
      await updateDoc(FARM_DOC(familyId, cropType), { stage: 'flowering' })
    }
  }
  if (farm.stage === 'watered') {
    const ready = farm.readyAt?.toMillis?.() ?? 0
    if (now >= ready) {
      await updateDoc(FARM_DOC(familyId, cropType), { stage: 'ready' })
    }
  }
}

// ─── 인벤토리 ────────────────────────────────────────────────────────────────

export function watchInventory(familyId, callback) {
  return onSnapshot(INVENTORY_DOC(familyId), (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

export async function consumeIngredients(familyId, items) {
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

export async function addIngredients(familyId, items) {
  const snap = await getDoc(INVENTORY_DOC(familyId))
  const inv  = snap.exists() ? snap.data() : {}
  const update = {}
  for (const [key, qty] of Object.entries(items)) {
    update[key] = (inv[key] || 0) + qty
  }
  await setDoc(INVENTORY_DOC(familyId), update, { merge: true })
}

// ─── 발주 ────────────────────────────────────────────────────────────────────

export async function placeOrder(familyId, items) {
  const now      = Date.now()
  const delivery = new Date(now + 24 * 60 * 60 * 1000)
  const ref = await addDoc(collection(db, 'families', familyId, 'orders'), {
    items,
    orderedAt:  Timestamp.fromMillis(now),
    deliveryAt: Timestamp.fromMillis(delivery.getTime()),
    delivered:  false,
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

// ─── 게임 상태 ───────────────────────────────────────────────────────────────

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
  const newDaily = (prev.burgerCount || 0) + 1
  await setDoc(ref, {
    burgerCompletedAt: serverTimestamp(),
    burgerCount: newDaily,
  }, { merge: true })

  // 누적 총 달성 카운터 (쿠폰 발급 기준)
  const famRef  = doc(db, 'families', familyId)
  const famSnap = await getDoc(famRef)
  const famData = famSnap.exists() ? famSnap.data() : {}
  const prevTotal  = famData.totalBurgers || 0
  const newTotal   = prevTotal + 1
  const newCoupons = Math.floor(newTotal / 100)

  // ── 스트릭 계산 ──────────────────────────────────────────────
  const todayStr = today()
  const yd = new Date(); yd.setDate(yd.getDate() - 1)
  const yesterdayStr = yd.toISOString().split('T')[0]

  const lastDate = famData.lastBurgerDate || ''
  let streak    = famData.streak    || 0
  let maxStreak = famData.maxStreak || 0

  if (lastDate === todayStr) {
    // 오늘 이미 처리됨 — 스트릭 유지
  } else if (lastDate === yesterdayStr) {
    streak += 1   // 연속!
  } else {
    streak = 1    // 첫 시작 또는 끊김
  }
  if (streak > maxStreak) maxStreak = streak

  // ── 업적 체크 ────────────────────────────────────────────────
  const existing       = famData.achievements  || []
  const beanstalkCount = famData.beanstalkCount || 0
  const newAchievements = checkNewAchievements(existing, {
    total: newTotal, streak, maxStreak, beanstalkCount,
  })

  await updateDoc(famRef, {
    totalBurgers:   newTotal,
    couponsEarned:  newCoupons,
    lastBurgerDate: todayStr,
    streak,
    maxStreak,
    achievements:   [...existing, ...newAchievements],
  })

  // ── 주간 챌린지 버거 카운터 ──────────────────────────────────
  // (오늘 처음 완성한 경우만 카운트)
  let weeklyBurgerCount = 0
  if (lastDate !== todayStr) {  // 오늘 첫 번째 완성
    weeklyBurgerCount = await incrementWeeklyProgress(familyId, 'burgerCount')
  }

  return {
    daily:             newDaily,
    total:             newTotal,
    newCoupon:         newCoupons > Math.floor(prevTotal / 100),
    streak,
    newAchievements,
    weeklyBurgerCount,
  }
}

/** 테스트용: 대기 중인 모든 발주를 즉시 배송 처리 */
export async function instantDeliverOrders(familyId) {
  const q    = query(collection(db, 'families', familyId, 'orders'), where('delivered', '==', false))
  const snap = await getDocs(q)
  if (snap.empty) throw new Error('대기 중인 발주가 없어요.')

  const invSnap = await getDoc(INVENTORY_DOC(familyId))
  let inv = invSnap.exists() ? invSnap.data() : {}
  let totalItems = {}

  for (const d of snap.docs) {
    const order = d.data()
    for (const [key, qty] of Object.entries(order.items || {})) {
      totalItems[key] = (totalItems[key] || 0) + qty
      inv[key] = (inv[key] || 0) + qty
    }
    await updateDoc(d.ref, { delivered: true, deliveryAt: Timestamp.fromMillis(Date.now()) })
  }

  await setDoc(INVENTORY_DOC(familyId), inv, { merge: true })
  return { count: snap.size, items: totalItems }
}

/** 테스트용: 모든 재료 보충 + 양쪽 농장 수확 가능 + 버거 1개 완성 */
export async function instantCompleteAll(familyId) {
  const now     = Date.now()
  const expires = new Date(now + 3 * 24 * 60 * 60 * 1000)

  // 인벤토리 보충
  await setDoc(INVENTORY_DOC(familyId), {
    veggies:           5,
    bread:             5,
    patty:             5,
    bacon:             5,
    sauce:             5,
    veggieHarvestedAt: Timestamp.fromMillis(now),
    veggieExpiresAt:   Timestamp.fromMillis(expires.getTime()),
  }, { merge: true })

  // 양쪽 농장 수확 가능 상태로
  for (const type of ['tomato', 'lettuce']) {
    await setDoc(FARM_DOC(familyId, type), {
      stage:      'ready',
      date:       today(),
      seededAt:   Timestamp.fromMillis(now),
      floweredAt: Timestamp.fromMillis(now),
      wateredAt:  Timestamp.fromMillis(now),
      readyAt:    Timestamp.fromMillis(now),
      harvestedAt: null,
    }, { merge: true })
  }

  // 버거 1개 완성
  const ref  = doc(db, 'families', familyId, 'gameState', today())
  const snap = await getDoc(ref)
  const prev = snap.exists() ? snap.data() : {}
  const newCount = (prev.burgerCount || 0) + 1
  await setDoc(ref, {
    burgerCompletedAt: serverTimestamp(),
    burgerCount: newCount,
  }, { merge: true })
  return newCount
}

// ─── 위치 동기화 (멀티플레이어 캐릭터 표시) ─────────────────────────────────

export async function syncPosition(familyId, role, x, y) {
  await setDoc(POSITION_DOC(familyId, role), {
    x: Math.round(x),
    y: Math.round(y),
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export function watchOtherPosition(familyId, myRole, callback) {
  const otherRole = myRole === 'parent' ? 'child' : 'parent'
  return onSnapshot(POSITION_DOC(familyId, otherRole), (snap) => {
    callback(snap.exists() ? { ...snap.data(), role: otherRole } : null)
  })
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

// 하위 호환
export async function waterPlant(familyId) {
  return waterFarm(familyId, 'tomato')
}

// ─── 주간 챌린지 ─────────────────────────────────────────────────────────────

const WEEKLY_DOC = (fid, weekKey) =>
  doc(db, 'families', fid, 'weeklyChallenges', weekKey)

/** 주간 챌린지 실시간 구독 */
export function watchWeeklyChallenge(familyId, callback) {
  const weekKey = getWeekKey()
  const challenge = getChallengeForWeek(weekKey)
  return onSnapshot(WEEKLY_DOC(familyId, weekKey), (snap) => {
    const progress = snap.exists() ? snap.data() : {}
    callback({ challenge, progress, weekKey })
  })
}

/**
 * 주간 챌린지 진행도 증가
 * field: 'burgerCount' | 'beanstalkCount' | 'harvestCount'
 */
export async function incrementWeeklyProgress(familyId, field, amount = 1) {
  const weekKey = getWeekKey()
  const ref     = WEEKLY_DOC(familyId, weekKey)
  const snap    = await getDoc(ref)
  const prev    = snap.exists() ? snap.data() : {}
  const newVal  = (prev[field] || 0) + amount
  await setDoc(ref, { ...prev, [field]: newVal }, { merge: true })
  return newVal
}

/** 주간 챌린지 완료 표시 */
export async function markWeeklyChallengeComplete(familyId) {
  const weekKey = getWeekKey()
  await setDoc(WEEKLY_DOC(familyId, weekKey), {
    completed: true,
    completedAt: serverTimestamp(),
  }, { merge: true })
}
