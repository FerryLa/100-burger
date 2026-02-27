/**
 * 메시지 패널
 * - 빠른 버튼형 메시지 (직접 입력 최소화)
 * - 자동 메시지 구분 표시
 */
import { useState, useEffect, useRef } from 'react'
import { sendMessage, watchMessages } from '../firebase/gameService'
import { useGameStore } from '../store/useGameStore'

const QUICK_MESSAGES = {
  parent: [
    '오늘도 물 줬어요. 💧',
    '잘 자고 있어? 😊',
    '밥은 먹었어?',
    '보고 싶어 ❤️',
  ],
  child: [
    '햄버거 거의 다 됐어요! 🍔',
    '오늘도 힘내세요! 💪',
    '조금 느려요 ㅎㅎ',
    '부모님 덕분에 빨리 됐어요 😄',
    '오늘은 콩나무가 나왔어요 🌱',
  ],
}

export default function MessagePanel() {
  const { role, familyId, user, messages, setMessages } = useGameStore((s) => s)
  const [showQuick, setShowQuick] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!familyId) return
    const unsub = watchMessages(familyId, setMessages)
    return () => unsub()
  }, [familyId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(text) {
    await sendMessage(familyId, user.uid, role, text)
    setShowQuick(false)
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-inner overflow-hidden">
      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {messages.length === 0 && (
          <p className="text-center text-gray-300 mt-8 text-base">
            아직 메시지가 없어요.<br />첫 메시지를 보내보세요 😊
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === user?.uid
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2 text-base shadow-sm
                  ${msg.isAuto
                    ? 'bg-gray-100 text-gray-500 text-sm italic text-center mx-auto rounded-xl px-3 py-1'
                    : isMine
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
              >
                {!isMine && !msg.isAuto && (
                  <p className="text-xs text-gray-400 mb-0.5">
                    {msg.senderRole === 'parent' ? '👨‍👩‍👧 부모님' : '👦 아이'}
                  </p>
                )}
                {msg.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 퀵 메시지 선택 */}
      {showQuick && (
        <div className="border-t border-gray-100 p-3 bg-amber-50 flex flex-col gap-2">
          {QUICK_MESSAGES[role].map((text) => (
            <button
              key={text}
              onClick={() => handleSend(text)}
              className="text-left bg-white rounded-xl px-4 py-3 text-base shadow-sm
                         hover:bg-amber-100 active:scale-95 transition-transform"
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {/* 메시지 보내기 버튼 */}
      <div className="border-t border-gray-100 p-3">
        <button
          onClick={() => setShowQuick((v) => !v)}
          className="w-full bg-amber-500 text-white font-bold text-xl py-4 rounded-2xl
                     active:scale-95 transition-transform shadow"
        >
          {showQuick ? '✕ 닫기' : '💬 메시지 보내기'}
        </button>
      </div>
    </div>
  )
}
