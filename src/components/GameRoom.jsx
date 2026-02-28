/**
 * GameRoom – 아이소메트릭 미니룸 (싸이월드 스타일)
 * 테마: modern | hanok
 * 캐릭터: 엄마(mom) / 아빠(dad) / 아들(son) / 딸(daughter)
 */
import { useState, useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'

/* ── 상수 ─────────────────────────────────────────────────────── */
const ROOM_W     = 620
const ROOM_H     = 460
const CHAR_R     = 20
const SPEED      = 3
const INTERACT_D = 68

const OBJECTS = [
  { id: 'farm_tomato',  label: '토마토밭', x: 75,  y: 105, color: '#bbf7d0', darkColor: '#4ade80' },
  { id: 'farm_lettuce', label: '상추밭',   x: 75,  y: 255, color: '#a7f3d0', darkColor: '#34d399' },
  { id: 'fridge',       label: '냉장고',   x: 318, y: 95,  color: '#e0f2fe', darkColor: '#7dd3fc' },
  { id: 'sink',         label: '씽크대',   x: 408, y: 95,  color: '#f0fdf4', darkColor: '#86efac' },
  { id: 'kitchen',      label: '주방',     x: 498, y: 95,  color: '#fef3c7', darkColor: '#fcd34d' },
  { id: 'stove',        label: '화로',     x: 498, y: 200, color: '#fee2e2', darkColor: '#f87171' },
  { id: 'order',        label: '발주대',   x: 550, y: 378, color: '#ede9fe', darkColor: '#a78bfa' },
]

const WALLS = OBJECTS.map(o => ({ x: o.x - 35, y: o.y - 35, w: 70, h: 70 }))

/* ── 유틸 ─────────────────────────────────────────────────────── */
function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2) }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function collidesWall(x, y) {
  for (const w of WALLS)
    if (x > w.x - CHAR_R && x < w.x + w.w + CHAR_R && y > w.y - CHAR_R && y < w.y + w.h + CHAR_R)
      return true
  return false
}

/* ── 테마 ─────────────────────────────────────────────────────── */
const THEMES = {
  modern: {
    outerBg:    '#f5ece0',
    wallBack:   '#fdf8f0',
    wallLeft:   '#f0e8d8',
    wallRight:  '#ece4d4',
    floor:      '#e8d4a8',
    floorLine:  'rgba(190,150,90,0.22)',
    trim:       '#c8a060',
    doorFrame:  '#d4b07a',
    windowFill: 'rgba(186,230,255,0.5)',
    windowLine: '#c0b090',
    lampOn:     '#fef9c3',
    baseBoard:  '#d4b07a',
    roomBorder: '#c0a070',
  },
  hanok: {
    outerBg:    '#1a0e06',
    wallBack:   '#f2e4c0',
    wallLeft:   '#e8d4a0',
    wallRight:  '#e0cc98',
    floor:      '#c8a060',
    floorLine:  'rgba(120,75,25,0.28)',
    trim:       '#6b3a18',
    doorFrame:  '#4a2810',
    windowFill: 'rgba(255,240,190,0.55)',
    windowLine: '#6b3a18',
    lampOn:     '#fef3c7',
    baseBoard:  '#8b5a2a',
    roomBorder: '#8b5a2a',
  },
}

/* ── 방 배경 SVG ──────────────────────────────────────────────── */
function RoomBackground({ theme = 'modern' }) {
  const t = THEMES[theme]
  const W = ROOM_W
  const H = ROOM_H
  const wallH = 155   // 바닥에서 벽까지 높이 경계 (y좌표)
  const leftW = 118   // 왼쪽 벽 너비

  return (
    <svg
      width={W} height={H}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {/* ── 뒷벽 ── */}
      <rect x={leftW} y={0} width={W - leftW} height={wallH} fill={t.wallBack} />

      {/* ── 왼쪽 벽 ── */}
      <rect x={0} y={0} width={leftW} height={H} fill={t.wallLeft} />

      {/* ── 바닥 ── */}
      <rect x={leftW} y={wallH} width={W - leftW} height={H - wallH} fill={t.floor} />

      {/* ── 바닥 격자선 ── */}
      {theme === 'modern' && Array.from({ length: 12 }).map((_, i) => (
        <line
          key={`fh-${i}`}
          x1={leftW} y1={wallH + (i + 1) * ((H - wallH) / 12)}
          x2={W}     y2={wallH + (i + 1) * ((H - wallH) / 12)}
          stroke={t.floorLine} strokeWidth="1"
        />
      ))}
      {theme === 'modern' && Array.from({ length: 14 }).map((_, i) => (
        <line
          key={`fv-${i}`}
          x1={leftW + (i + 1) * ((W - leftW) / 14)} y1={wallH}
          x2={leftW + (i + 1) * ((W - leftW) / 14)} y2={H}
          stroke={t.floorLine} strokeWidth="1"
        />
      ))}

      {/* ── 한옥 다다미 격자 ── */}
      {theme === 'hanok' && Array.from({ length: 6 }).map((_, i) => (
        <line
          key={`tm-${i}`}
          x1={leftW} y1={wallH + (i + 1) * ((H - wallH) / 6)}
          x2={W}     y2={wallH + (i + 1) * ((H - wallH) / 6)}
          stroke={t.floorLine} strokeWidth="1.5"
        />
      ))}
      {theme === 'hanok' && Array.from({ length: 7 }).map((_, i) => (
        <line
          key={`tv-${i}`}
          x1={leftW + (i + 1) * ((W - leftW) / 7)} y1={wallH}
          x2={leftW + (i + 1) * ((W - leftW) / 7)} y2={H}
          stroke={t.floorLine} strokeWidth="1.5"
        />
      ))}

      {/* ── 벽/바닥 경계선 (몰딩) ── */}
      <line x1={leftW} y1={wallH} x2={W} y2={wallH} stroke={t.trim} strokeWidth="3" />
      <line x1={leftW} y1={0}     x2={leftW} y2={H} stroke={t.trim} strokeWidth="3" />

      {/* ── 왼쪽 벽 세로줄 (한옥 기둥) ── */}
      {theme === 'hanok' && (
        <>
          <rect x={10} y={0} width={8} height={H} fill={t.trim} rx={2} opacity={0.5} />
          <rect x={100} y={0} width={8} height={H} fill={t.trim} rx={2} opacity={0.5} />
          <line x1={0} y1={wallH} x2={leftW} y2={wallH} stroke={t.trim} strokeWidth="3" />
        </>
      )}

      {/* ── 뒷벽 창문 (모던: 큰 유리창) ── */}
      {theme === 'modern' && (
        <>
          <rect x={230} y={10} width={200} height={120} rx={8}
            fill={t.windowFill} stroke={t.windowLine} strokeWidth="2" />
          {/* 창문 프레임 */}
          <line x1={330} y1={10} x2={330} y2={130} stroke={t.windowLine} strokeWidth="2" />
          <line x1={230} y1={70} x2={430} y2={70} stroke={t.windowLine} strokeWidth="2" />
          {/* 바깥 건물 실루엣 */}
          <rect x={250} y={20} width={30} height={50} fill="rgba(200,180,150,0.3)" rx={2} />
          <rect x={290} y={35} width={25} height={35} fill="rgba(200,180,150,0.25)" rx={2} />
          <rect x={360} y={15} width={35} height={55} fill="rgba(200,180,150,0.3)" rx={2} />
          <rect x={400} y={30} width={20} height={40} fill="rgba(200,180,150,0.25)" rx={2} />
        </>
      )}

      {/* ── 한옥 창호지 창문 ── */}
      {theme === 'hanok' && (
        <>
          {/* 오른쪽 창 */}
          <rect x={350} y={8} width={220} height={130} rx={4}
            fill={t.windowFill} stroke={t.windowLine} strokeWidth="3" />
          {/* 격자 패턴 */}
          {Array.from({ length: 4 }).map((_, i) => (
            <line key={`wh-${i}`}
              x1={350} y1={8 + (i + 1) * 130 / 5}
              x2={570} y2={8 + (i + 1) * 130 / 5}
              stroke={t.windowLine} strokeWidth="1.5" />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`wv-${i}`}
              x1={350 + (i + 1) * 220 / 6} y1={8}
              x2={350 + (i + 1) * 220 / 6} y2={138}
              stroke={t.windowLine} strokeWidth="1.5" />
          ))}
          {/* 왼쪽 작은 창 */}
          <rect x={155} y={15} width={140} height={120} rx={4}
            fill={t.windowFill} stroke={t.windowLine} strokeWidth="3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <line key={`wh2-${i}`}
              x1={155} y1={15 + (i + 1) * 120 / 4}
              x2={295} y2={15 + (i + 1) * 120 / 4}
              stroke={t.windowLine} strokeWidth="1.5" />
          ))}
          {Array.from({ length: 3 }).map((_, i) => (
            <line key={`wv2-${i}`}
              x1={155 + (i + 1) * 140 / 4} y1={15}
              x2={155 + (i + 1) * 140 / 4} y2={135}
              stroke={t.windowLine} strokeWidth="1.5" />
          ))}
        </>
      )}

      {/* ── 왼쪽 벽 창 (모던) ── */}
      {theme === 'modern' && (
        <rect x={15} y={20} width={90} height={100} rx={6}
          fill={t.windowFill} stroke={t.windowLine} strokeWidth="1.5" />
      )}

      {/* ── 한옥 왼쪽 벽 장식 ── */}
      {theme === 'hanok' && (
        <>
          <rect x={15} y={25} width={90} height={75} rx={3}
            fill="rgba(180,130,60,0.15)" stroke={t.trim} strokeWidth="2" />
          {/* 족자 그림 */}
          <rect x={18} y={28} width={84} height={69} rx={2}
            fill="rgba(255,245,220,0.6)" />
          <circle cx={60} cy={55} r={20} fill="none" stroke={t.trim} strokeWidth="1.5" opacity={0.5} />
          <path d="M45 55 Q60 40 75 55 Q60 70 45 55Z"
            fill={t.trim} opacity={0.3} />
        </>
      )}

      {/* ── 모던: 스탠드 조명 ── */}
      {theme === 'modern' && (
        <>
          <rect x={138} y={100} width={6} height={50} fill="#c8a070" rx={3} />
          <ellipse cx={141} cy={100} rx={22} ry={15}
            fill="#fef9c3" stroke="#e8d060" strokeWidth="1.5" opacity={0.9} />
        </>
      )}

      {/* ── 한옥: 항아리 장식 ── */}
      {theme === 'hanok' && (
        <>
          <ellipse cx={148} cy={148} rx={16} ry={10} fill={t.trim} opacity={0.5} />
          <path d="M132 148 Q132 118 148 115 Q164 118 164 148"
            fill={t.trim} opacity={0.7} />
          <ellipse cx={148} cy={116} rx={12} ry={5} fill={t.trim} opacity={0.5} />
        </>
      )}

      {/* ── 한옥: 바닥 조명 ── */}
      {theme === 'hanok' && (
        <g transform={`translate(570, 400)`}>
          <rect x={-18} y={-35} width={36} height={35} rx={4}
            fill={t.lampOn} stroke={t.trim} strokeWidth="2" opacity={0.85} />
          {Array.from({ length: 3 }).map((_, i) => (
            <line key={`l-${i}`}
              x1={-18 + (i + 1) * 36 / 4} y1={-35}
              x2={-18 + (i + 1) * 36 / 4} y2={0}
              stroke={t.trim} strokeWidth="1" />
          ))}
          <rect x={-22} y={-2} width={44} height={6} rx={2}
            fill={t.trim} />
        </g>
      )}

      {/* ── 농장 구역 표시 (왼쪽 벽에 붙은 화분 영역) ── */}
      <rect x={leftW + 5} y={wallH + 5} width={165} height={270} rx={10}
        fill={THEMES[theme].floorLine ? 'rgba(134,239,172,0.08)' : 'transparent'}
        stroke="rgba(134,239,172,0.3)" strokeWidth="1.5" strokeDasharray="6,4" />

      {/* ── 주방 구역 표시 ── */}
      <rect x={270} y={wallH + 5} width={340} height={165} rx={10}
        fill="rgba(251,191,36,0.06)"
        stroke="rgba(251,191,36,0.25)" strokeWidth="1.5" strokeDasharray="6,4" />

      {/* ── 하단 발판선 ── */}
      <rect x={leftW} y={H - 6} width={W - leftW} height={6} fill={t.trim} opacity={0.4} />

      {/* ── 모던: 화분 장식 ── */}
      {theme === 'modern' && (
        <>
          <ellipse cx={170} cy={157} rx={14} ry={5} fill="#86efac" opacity={0.7} />
          <rect x={160} y={150} width={20} height={8} rx={3} fill="#c8a070" />
        </>
      )}

      {/* ── 방 외곽 그림자 ── */}
      <rect x={0} y={0} width={leftW} height={H} fill="rgba(0,0,0,0.04)" />
    </svg>
  )
}

/* ── 캐릭터 SVG ───────────────────────────────────────────────── */

// 엄마 – 분홍 리본, 노란 드레스
function MomSVG({ size = 48 }) {
  return (
    <svg width={size} height={Math.round(size * 1.3)} viewBox="0 0 40 52" overflow="visible">
      <ellipse cx="20" cy="50" rx="10" ry="3" fill="rgba(0,0,0,0.13)" />
      {/* 드레스 하단 */}
      <path d="M11 30 Q9 48 20 48 Q31 48 29 30 Z" fill="#f9a8d4" />
      {/* 몸통 */}
      <rect x="13" y="26" width="14" height="15" rx="5" fill="#fbbf24" />
      {/* 팔 */}
      <ellipse cx="9"  cy="30" rx="4" ry="2.2" fill="#fcd9b6" transform="rotate(-20 9 30)" />
      <ellipse cx="31" cy="30" rx="4" ry="2.2" fill="#fcd9b6" transform="rotate(20 31 30)" />
      {/* 머리 */}
      <circle cx="20" cy="17" r="13" fill="#fcd9b6" />
      {/* 머리카락 */}
      <path d="M8 17 Q7 6 20 5 Q33 6 32 17 Q28 9 20 9 Q12 9 8 17Z" fill="#92400e" />
      {/* 리본 */}
      <path d="M12 8 Q15 4 17 8 Q15 11 12 8Z" fill="#f472b6" />
      <path d="M23 8 Q25 4 28 8 Q25 11 23 8Z" fill="#f472b6" />
      <circle cx="20" cy="8" r="2.5" fill="#ec4899" />
      {/* 눈 */}
      <ellipse cx="16.5" cy="17" rx="2.5" ry="3.2" fill="#1a1a2e" />
      <ellipse cx="23.5" cy="17" rx="2.5" ry="3.2" fill="#1a1a2e" />
      <circle cx="17.3" cy="16" r="1.3" fill="white" />
      <circle cx="24.3" cy="16" r="1.3" fill="white" />
      {/* 볼 */}
      <ellipse cx="12.5" cy="20" rx="3" ry="2" fill="#fca5a5" opacity="0.65" />
      <ellipse cx="27.5" cy="20" rx="3" ry="2" fill="#fca5a5" opacity="0.65" />
      {/* 입 */}
      <path d="M17.5 22.5 Q20 25.5 22.5 22.5" stroke="#c06050" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// 아빠 – 파란 줄무늬 셔츠, 짧은 갈색 머리
function DadSVG({ size = 52 }) {
  return (
    <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 44 53" overflow="visible">
      <ellipse cx="22" cy="51" rx="12" ry="3.5" fill="rgba(0,0,0,0.13)" />
      {/* 바지 */}
      <rect x="13" y="40" width="7" height="11" rx="3" fill="#1d4ed8" />
      <rect x="24" y="40" width="7" height="11" rx="3" fill="#1d4ed8" />
      {/* 셔츠 */}
      <rect x="12" y="27" width="20" height="17" rx="5" fill="#93c5fd" />
      <line x1="12" y1="31" x2="32" y2="31" stroke="#3b82f6" strokeWidth="1.8" />
      <line x1="12" y1="35" x2="32" y2="35" stroke="#3b82f6" strokeWidth="1.8" />
      <line x1="12" y1="39" x2="32" y2="39" stroke="#3b82f6" strokeWidth="1.8" />
      {/* 팔 */}
      <rect x="4"  y="28" width="9" height="5" rx="2.5" fill="#fcd9b6" />
      <rect x="31" y="28" width="9" height="5" rx="2.5" fill="#fcd9b6" />
      {/* 머리 */}
      <circle cx="22" cy="18" r="15" fill="#fcd9b6" />
      {/* 머리카락 */}
      <path d="M8 17 Q7 5 22 4 Q37 5 36 17 Q32 8 22 8 Q12 8 8 17Z" fill="#78350f" />
      {/* 눈 */}
      <ellipse cx="17.5" cy="18" rx="3"   ry="3.5" fill="#1a1a2e" />
      <ellipse cx="26.5" cy="18" rx="3"   ry="3.5" fill="#1a1a2e" />
      <circle  cx="18.5" cy="17" r="1.5"  fill="white" />
      <circle  cx="27.5" cy="17" r="1.5"  fill="white" />
      {/* 볼 */}
      <ellipse cx="13" cy="22" rx="3.5" ry="2.2" fill="#fca5a5" opacity="0.55" />
      <ellipse cx="31" cy="22" rx="3.5" ry="2.2" fill="#fca5a5" opacity="0.55" />
      {/* 입 */}
      <path d="M19 25 Q22 28 25 25" stroke="#c06050" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// 아들 – 노란 모자, 초록 셔츠, 파란 반바지
function SonSVG({ size = 44 }) {
  return (
    <svg width={size} height={Math.round(size * 1.25)} viewBox="0 0 38 47" overflow="visible">
      <ellipse cx="19" cy="45" rx="9" ry="3" fill="rgba(0,0,0,0.13)" />
      {/* 신발 */}
      <ellipse cx="14" cy="44" rx="4.5" ry="2.8" fill="#fbbf24" />
      <ellipse cx="24" cy="44" rx="4.5" ry="2.8" fill="#fbbf24" />
      {/* 바지 */}
      <rect x="12" y="35" width="5.5" height="9" rx="2.5" fill="#60a5fa" />
      <rect x="20" y="35" width="5.5" height="9" rx="2.5" fill="#60a5fa" />
      {/* 셔츠 */}
      <rect x="10" y="24" width="18" height="14" rx="4" fill="#4ade80" />
      {/* 팔 */}
      <ellipse cx="6"  cy="28" rx="4" ry="2.2" fill="#fcd9b6" transform="rotate(-15 6 28)" />
      <ellipse cx="32" cy="28" rx="4" ry="2.2" fill="#fcd9b6" transform="rotate(15 32 28)" />
      {/* 머리 */}
      <circle cx="19" cy="16" r="12" fill="#fcd9b6" />
      {/* 모자 챙 */}
      <rect x="5" y="14" width="14" height="4.5" rx="2" fill="#fbbf24" />
      {/* 모자 몸통 */}
      <path d="M7 14 Q8 5 19 4 Q30 5 31 14 Z" fill="#fbbf24" />
      {/* 모자 버튼 */}
      <circle cx="19" cy="5" r="2" fill="#f59e0b" />
      {/* 눈 */}
      <ellipse cx="15.5" cy="16" rx="2.5" ry="3"   fill="#1a1a2e" />
      <ellipse cx="22.5" cy="16" rx="2.5" ry="3"   fill="#1a1a2e" />
      <circle  cx="16.3" cy="15" r="1.2" fill="white" />
      <circle  cx="23.3" cy="15" r="1.2" fill="white" />
      {/* 볼 */}
      <ellipse cx="12" cy="19" rx="2.8" ry="1.8" fill="#fca5a5" opacity="0.65" />
      <ellipse cx="26" cy="19" rx="2.8" ry="1.8" fill="#fca5a5" opacity="0.65" />
      {/* 입 */}
      <path d="M16 21.5 Q19 24.5 22 21.5" stroke="#c06050" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// 딸 – 분홍 드레스, 양 갈래 머리
function DaughterSVG({ size = 40 }) {
  return (
    <svg width={size} height={Math.round(size * 1.3)} viewBox="0 0 36 47" overflow="visible">
      <ellipse cx="18" cy="45" rx="8.5" ry="2.8" fill="rgba(0,0,0,0.13)" />
      {/* 드레스 하단 */}
      <path d="M7 26 Q5 43 18 44 Q31 43 29 26 Z" fill="#fda4af" />
      {/* 몸통 */}
      <rect x="10" y="22" width="16" height="13" rx="4" fill="#fb7185" />
      {/* 팔 */}
      <ellipse cx="6"  cy="26" rx="3.5" ry="2" fill="#fcd9b6" transform="rotate(-15 6 26)" />
      <ellipse cx="30" cy="26" rx="3.5" ry="2" fill="#fcd9b6" transform="rotate(15 30 26)" />
      {/* 머리 */}
      <circle cx="18" cy="14" r="12" fill="#fcd9b6" />
      {/* 머리카락 */}
      <path d="M7 14 Q6 4 18 3 Q30 4 31 14 Q28 6 18 6 Q8 6 7 14Z" fill="#92400e" />
      {/* 양 갈래 */}
      <ellipse cx="7"  cy="10" rx="5" ry="7" fill="#92400e" />
      <ellipse cx="29" cy="10" rx="5" ry="7" fill="#92400e" />
      {/* 리본 */}
      <path d="M3 6 Q6 2 8 6 Q6 8 3 6Z" fill="#f472b6" />
      <circle cx="5.5" cy="6" r="2" fill="#ec4899" />
      <path d="M28 6 Q30 2 33 6 Q30 8 28 6Z" fill="#f472b6" />
      <circle cx="30.5" cy="6" r="2" fill="#ec4899" />
      {/* 눈 */}
      <ellipse cx="14.5" cy="14" rx="2.5" ry="3"   fill="#1a1a2e" />
      <ellipse cx="21.5" cy="14" rx="2.5" ry="3"   fill="#1a1a2e" />
      <circle  cx="15.3" cy="13" r="1.2" fill="white" />
      <circle  cx="22.3" cy="13" r="1.2" fill="white" />
      {/* 볼 */}
      <ellipse cx="11" cy="17" rx="2.8" ry="1.8" fill="#fca5a5" opacity="0.65" />
      <ellipse cx="25" cy="17" rx="2.8" ry="1.8" fill="#fca5a5" opacity="0.65" />
      {/* 입 */}
      <path d="M15 19.5 Q18 22.5 21 19.5" stroke="#c06050" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

// 역할에 따라 캐릭터 선택
function CharacterAvatar({ role, isOther = false, size }) {
  if (role === 'parent') return isOther ? <DadSVG size={size} /> : <MomSVG size={size} />
  return isOther ? <DaughterSVG size={size} /> : <SonSVG size={size} />
}

/* ── 오브젝트 아이콘 ─────────────────────────────────────────── */
const OBJECT_ICONS = {
  farm_tomato:  '🍅',
  farm_lettuce: '🥬',
  fridge:       '❄️',
  sink:         '🚿',
  kitchen:      '🍳',
  stove:        '🔥',
  order:        '📦',
}

/* ── 메인 컴포넌트 ────────────────────────────────────────────── */
export default function GameRoom({
  farmTomato, farmLettuce, inventory,
  carrying,
  otherPlayerPos, otherPlayerRole,
  onInteract, onPositionChange,
  theme = 'modern',
}) {
  const role = useGameStore(s => s.role)

  const START = { x: 220, y: 340 }
  const [pos,    setPos]    = useState(START)
  const [facing, setFacing] = useState('down')
  const [nearby, setNearby] = useState(null)

  const posRef    = useRef(START)
  const keysRef   = useRef({})
  const rafRef    = useRef(null)
  const posyncRef = useRef(0)

  /* ── 키보드 ── */
  useEffect(() => {
    function onDown(e) {
      keysRef.current[e.key] = true
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))
        e.preventDefault()
      if (e.key === 'a' || e.key === 'A') {
        const near = findNearby(posRef.current)
        if (near) onInteract?.(near.id, 'A')
      }
    }
    function onUp(e) { keysRef.current[e.key] = false }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [onInteract])

  /* ── 게임 루프 ── */
  useEffect(() => {
    function loop() {
      const k = keysRef.current
      let { x, y } = posRef.current
      let dir = facing
      let moved = false

      let dx = 0, dy = 0
      if (k['ArrowUp'])    { dy -= SPEED; dir = 'up';    moved = true }
      if (k['ArrowDown'])  { dy += SPEED; dir = 'down';  moved = true }
      if (k['ArrowLeft'])  { dx -= SPEED; dir = 'left';  moved = true }
      if (k['ArrowRight']) { dx += SPEED; dir = 'right'; moved = true }

      const nx = clamp(x + dx, CHAR_R + 118, ROOM_W - CHAR_R)
      const ny = clamp(y + dy, CHAR_R, ROOM_H - CHAR_R)
      if (!collidesWall(nx, y)) x = nx
      if (!collidesWall(x, ny)) y = ny

      posRef.current = { x, y }

      if (moved) {
        setFacing(dir)
        setPos({ x, y })
        const now = Date.now()
        if (now - posyncRef.current > 500) {
          posyncRef.current = now
          onPositionChange?.({ x, y })
        }
      }

      setNearby(findNearby({ x, y })?.id ?? null)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  function findNearby(p) {
    return OBJECTS.find(o => dist(p, o) < INTERACT_D) ?? null
  }

  /* ── 오브젝트 상태 배지 ── */
  function getObjectBadge(obj) {
    const { id } = obj
    const farm = id === 'farm_tomato' ? farmTomato : id === 'farm_lettuce' ? farmLettuce : null
    if (farm) {
      if (farm.stage === 'flowering') return { text: '💧 물 줘요!', color: '#3b82f6' }
      if (farm.stage === 'ready')     return { text: '✅ 수확!',    color: '#16a34a' }
      if (farm.stage === 'watered')   return { text: '🌿 자라는 중', color: '#0d9488' }
      if (['seed','growing'].includes(farm.stage))
        return { text: '🌱 싹 트는 중', color: '#65a30d' }
    }
    if (id === 'fridge') {
      const v = inventory?.veggies || 0
      if (v === 0) return { text: '비었어요', color: '#9ca3af' }
      return { text: `채소 ${v}개`, color: '#16a34a' }
    }
    if ((id === 'sink' || id === 'fridge') && carrying)
      return { text: '🧺 여기 놓기!', color: '#d97706' }
    return null
  }

  const flipX = facing === 'left'
  const charSize = role === 'parent' ? 50 : 46

  return (
    <div
      className="relative select-none overflow-hidden rounded-3xl"
      style={{
        width: ROOM_W,
        height: ROOM_H,
        background: THEMES[theme].outerBg,
        boxShadow: '0 8px 40px rgba(0,0,0,0.18), inset 0 0 0 2px ' + THEMES[theme].roomBorder,
      }}
    >
      {/* 방 배경 */}
      <RoomBackground theme={theme} />

      {/* 구역 레이블 */}
      <span className="absolute text-xs font-black opacity-50 pointer-events-none"
        style={{ left: 130, top: 165, color: '#16a34a', zIndex: 1 }}>
        🌿 농장
      </span>
      <span className="absolute text-xs font-black opacity-50 pointer-events-none"
        style={{ left: 275, top: 165, color: '#d97706', zIndex: 1 }}>
        🍳 주방 구역
      </span>

      {/* ── 오브젝트 ── */}
      {OBJECTS.map(obj => {
        const isNear = nearby === obj.id
        const badge  = getObjectBadge(obj)
        const isCarryTarget = carrying && (obj.id === 'fridge' || obj.id === 'sink')

        return (
          <div
            key={obj.id}
            className="absolute flex flex-col items-center cursor-pointer"
            style={{ left: obj.x - 36, top: obj.y - 36, width: 72, zIndex: 10 }}
            onClick={() => onInteract?.(obj.id, 'A')}
          >
            {/* 배지 */}
            {badge && (
              <div
                className="text-white text-xs font-black px-2 py-0.5 rounded-full mb-1 whitespace-nowrap shadow-sm"
                style={{ background: badge.color, fontSize: '10px' }}
              >
                {badge.text}
              </div>
            )}

            {/* 오브젝트 박스 (3D 느낌) */}
            <div
              className="flex items-center justify-center transition-all duration-150"
              style={{
                width: 58, height: 58,
                borderRadius: 14,
                background: isNear
                  ? '#fef9c3'
                  : isCarryTarget
                    ? '#fef3c7'
                    : obj.color,
                boxShadow: isNear
                  ? `0 0 0 2.5px #fbbf24, 0 6px 0 0 ${obj.darkColor}, 0 8px 16px rgba(0,0,0,0.18)`
                  : isCarryTarget
                    ? `0 0 0 2px #f59e0b, 0 5px 0 0 ${obj.darkColor}, 0 6px 12px rgba(0,0,0,0.15)`
                    : `0 5px 0 0 ${obj.darkColor}, 0 6px 12px rgba(0,0,0,0.12)`,
                transform: isNear ? 'translateY(-3px) scale(1.08)' : 'translateY(0) scale(1)',
                animation: isCarryTarget ? 'pulse 1.5s infinite' : 'none',
                fontSize: 28,
              }}
            >
              {OBJECT_ICONS[obj.id]}
            </div>

            <span
              className="text-xs font-bold mt-1 whitespace-nowrap"
              style={{ color: theme === 'hanok' ? '#92400e' : '#78350f', opacity: 0.85 }}
            >
              {obj.label}
            </span>

            {/* 상호작용 프롬프트 */}
            {isNear && (
              <div
                className="absolute -top-10 text-white text-xs font-black px-2.5 py-1 rounded-xl
                           whitespace-nowrap z-20 shadow-lg"
                style={{ background: 'rgba(30,20,10,0.82)', animation: 'bounce 0.8s infinite' }}
              >
                {carrying && (obj.id === 'fridge' || obj.id === 'sink')
                  ? '[A] 🧺 보관'
                  : `[A] ${obj.label}`}
              </div>
            )}
          </div>
        )
      })}

      {/* ── 상대방 캐릭터 ── */}
      {otherPlayerPos && (
        <div
          className="absolute pointer-events-none z-20 flex flex-col items-center"
          style={{
            left: otherPlayerPos.x - 26,
            top:  otherPlayerPos.y - 60,
            transition: 'left 0.5s ease, top 0.5s ease',
          }}
        >
          {/* 이름표 */}
          <div
            className="text-xs font-black px-2 py-0.5 rounded-full mb-1 whitespace-nowrap shadow"
            style={{ background: '#3b82f6', color: 'white', fontSize: '10px' }}
          >
            {otherPlayerRole === 'parent' ? '🧑‍🍳 아빠' : '🧒 딸'}
          </div>
          <div style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.2))' }}>
            <CharacterAvatar role={otherPlayerRole} isOther size={46} />
          </div>
        </div>
      )}

      {/* ── 운반 말풍선 ── */}
      {carrying && (
        <div
          className="absolute pointer-events-none z-30 flex flex-col items-center"
          style={{ left: pos.x - 30, top: pos.y - 80, transition: 'none' }}
        >
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-2xl shadow-xl font-black text-sm"
            style={{
              background: 'white',
              border: '2.5px solid #f59e0b',
              color: '#92400e',
            }}
          >
            <span style={{ fontSize: 22 }}>{carrying.emoji}</span>
            <span>{carrying.qty}개</span>
          </div>
          <div style={{ width: 2, height: 8, background: '#f59e0b' }} />
        </div>
      )}

      {/* ── 내 캐릭터 ── */}
      <div
        className="absolute pointer-events-none z-20 flex flex-col items-center"
        style={{
          left: pos.x - charSize / 2,
          top:  pos.y - charSize * 1.2,
          transform: flipX ? 'scaleX(-1)' : 'none',
          transition: 'none',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
        }}
      >
        <CharacterAvatar role={role} isOther={false} size={charSize} />
        {nearby && (
          <div
            className="text-xs font-black px-2 py-0.5 rounded-full mt-0.5 shadow"
            style={{ background: '#f59e0b', color: 'white', fontSize: '10px' }}
          >
            A
          </div>
        )}
      </div>

      {/* ── 모바일 D-패드 ── */}
      <MobileDpad keysRef={keysRef} onAction={() => {
        const near = findNearby(posRef.current)
        if (near) onInteract?.(near.id, 'A')
      }} theme={theme} />
    </div>
  )
}

/* ── 모바일 D-패드 ────────────────────────────────────────────── */
function MobileDpad({ keysRef, onAction, theme = 'modern' }) {
  function press(key, down) { keysRef.current[key] = down }

  const btnStyle = {
    width: 44, height: 44,
    borderRadius: 12,
    background: theme === 'hanok' ? 'rgba(245,220,170,0.85)' : 'rgba(255,255,255,0.88)',
    boxShadow: '0 3px 0 rgba(0,0,0,0.15)',
    fontSize: 20,
    fontWeight: 900,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', userSelect: 'none', touchAction: 'none',
    border: 'none',
    color: theme === 'hanok' ? '#6b3a18' : '#78350f',
  }

  const dirBtn = (label, key) => (
    <button
      key={key}
      style={btnStyle}
      onPointerDown={() => press(key, true)}
      onPointerUp={() => press(key, false)}
      onPointerLeave={() => press(key, false)}
      onPointerCancel={() => press(key, false)}
    >
      {label}
    </button>
  )

  return (
    <div className="absolute bottom-3 left-3 z-30 flex gap-2 items-end opacity-85">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gap: 4 }}>
        <div />{dirBtn('↑', 'ArrowUp')}<div />
        {dirBtn('←', 'ArrowLeft')}
        {dirBtn('↓', 'ArrowDown')}
        {dirBtn('→', 'ArrowRight')}
      </div>
      {/* A 버튼 */}
      <button
        style={{
          ...btnStyle,
          width: 50, height: 50,
          borderRadius: '50%',
          background: theme === 'hanok' ? '#92400e' : '#f59e0b',
          color: 'white',
          fontSize: 18,
          boxShadow: '0 4px 0 rgba(0,0,0,0.25)',
        }}
        onPointerDown={onAction}
      >
        A
      </button>
    </div>
  )
}
