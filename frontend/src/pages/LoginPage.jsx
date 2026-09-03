import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { setCredentials, setRole } from '../api/client'
import api from '../api/client'
import styles from './LoginPage.module.css'

const ROLE_OPTIONS = [
    { value: 'admin', label: '🔧 Admin', hint: 'admin' },
    { value: 'cash_admin', label: '💵 Cash Admin', hint: 'cash_admin' },
    { value: 'bank_admin', label: '🏦 Bank Admin', hint: 'bank_admin' },
    { value: 'director', label: '👔 Director', hint: 'director' },
]

export default function LoginPage({ onLogin }) {
    const navigate = useNavigate()
    const [role, setRoleState] = useState('admin')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        if (!username || !password) return toast.error('Enter username and password')
        setLoading(true)
        setCredentials(username, password)
        try {
            // Validate credentials against /fees/me which returns the role
            // For director we use the director-only endpoint
            let detectedRole = role
            if (role === 'director') {
                await api.get('/director/stats')
                detectedRole = 'director'
            } else {
                const { data } = await api.get('/fees/me')
                detectedRole = data.role
                // Ensure they logged in as the role they selected
                if (detectedRole !== role) {
                    throw Object.assign(new Error(), { response: { status: 403 } })
                }
            }
            setRole(detectedRole)
            onLogin()
            navigate(detectedRole === 'director' ? '/director' : '/')
        } catch (err) {
            if (err.response?.status === 401 || err.response?.status === 403) {
                toast.error('Invalid credentials for selected role')
                sessionStorage.removeItem('auth_user')
                sessionStorage.removeItem('auth_pass')
            } else {
                toast.error('Cannot reach server. Is the backend running?')
                sessionStorage.removeItem('auth_user')
                sessionStorage.removeItem('auth_pass')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.wrapper}>
            <div className={styles.box}>
                <div className={styles.logo}>
                    <img src="/tss-logo.png" alt="The Smart School" className={styles.logoImg} />
                    <div className={styles.logoTitle}>The Smart School</div>
                    <div className={styles.logoSub}>Bara Kahu Campus · Admissions</div>
                </div>

                {/* Role Selector */}
                <div className={styles.roleSelector}>
                    {ROLE_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            className={`${styles.roleBtn} ${role === opt.value ? styles.roleActive : ''}`}
                            onClick={() => setRoleState(opt.value)}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder={ROLE_OPTIONS.find(o => o.value === role)?.hint || 'username'}
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                    </div>
                    <button
                        type="submit"
                        className={`btn btn-primary btn-lg ${styles.submitBtn}`}
                        disabled={loading}
                    >
                        {loading ? <span className="spinner" /> : `Sign In as ${ROLE_OPTIONS.find(o => o.value === role)?.label || 'Admin'}`}
                    </button>
                </form>
            </div>
        </div>
    )
}
