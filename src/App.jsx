import { useEffect, Component } from 'react'

class EB extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(e) { return { err: e } }
  render() {
    if (this.state.err) return (
      <div id="eb-error" style={{color:'red',padding:16,background:'#fff',maxWidth:800}}>
        <b>ERROR:</b> {this.state.err.message}<br/>
        <pre style={{fontSize:11,overflow:'auto'}}>{this.state.err.stack}</pre>
      </div>
    )
    return this.props.children
  }
}
import { getAuth, onAuthStateChanged } from 'firebase/auth'
import { getFamilyByUid, watchFamily } from './firebase/gameService'
import { useGameStore } from './store/useGameStore'
import AuthPage from './pages/AuthPage'
import WaitingPage from './pages/WaitingPage'
import GamePage from './pages/GamePage'
import GameRoom3D from './components/GameRoom3D'
const IS_PREVIEW = new URLSearchParams(location.search).get('preview') === '1'

export default function App() {
  const user = useGameStore((s) => s.user)
  const role = useGameStore((s) => s.role)
  const familyId = useGameStore((s) => s.familyId)
  const familyConnected = useGameStore((s) => s.familyConnected)
  const setUser = useGameStore((s) => s.setUser)
  const setFamily = useGameStore((s) => s.setFamily)

  // Firebase Auth 상태 복원
  useEffect(() => {
    const auth = getAuth()
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return
      setUser(u)
      const family = await getFamilyByUid(u.uid)
      if (family) setFamily(family)
    })
    return () => unsub()
  }, [])

  // 가족 문서 실시간 감시 (자녀 연결 시 부모 화면 자동 전환)
  useEffect(() => {
    if (!familyId) return
    const unsub = watchFamily(familyId, (data) => {
      setFamily({ ...data, role })
    })
    return () => unsub()
  }, [familyId, role])

  if (IS_PREVIEW) return (
    <div style={{background:'#1a0e06',minHeight:'100vh',display:'flex',flexDirection:'column',gap:24,alignItems:'center',padding:24}}>
      <p style={{color:'#fef3c7',fontWeight:900,fontSize:18}}>🏠 Modern</p>
      <EB><GameRoom3D theme="modern" /></EB>
      <p style={{color:'#fef3c7',fontWeight:900,fontSize:18}}>🏯 Hanok</p>
      <EB><GameRoom3D theme="hanok" /></EB>
    </div>
  )

  // 1. 로그인 안 됨 → 인증 화면
  if (!user) return <AuthPage />

  // 2. 가족 미연결 → 인증 화면
  if (!familyId) return <AuthPage />

  // 3. 부모인데 자녀 미연결 → 초대코드 대기 화면
  if (role === 'parent' && !familyConnected) return <WaitingPage />

  // 4. 게임 화면
  return <GamePage />
}
