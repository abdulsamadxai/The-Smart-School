import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { clearCredentials, getRole } from '../api/client'
import styles from './Layout.module.css'

export default function Layout() {
    const navigate = useNavigate()
    const role = getRole()
    const [menuOpen, setMenuOpen] = useState(false)

    function handleLogout() {
        clearCredentials()
        navigate('/login')
    }

    return (
        <div className={styles.app}>
            <aside className={styles.sidebar}>
                <div className={styles.brand}>
                    <img src="/tss-logo.png" alt="The Smart School" className={styles.brandLogo} />
                    <div>
                        <div className={styles.brandName}>The Smart School</div>
                        <div className={styles.brandSub}>Admissions Portal</div>
                    </div>
                    <button
                        type="button"
                        className={styles.menuBtn}
                        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen(o => !o)}
                    >
                        {menuOpen ? '✕' : '☰'}
                    </button>
                </div>

                <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`}>
                    {role === 'director' && (
                        <NavLink
                            to="/director"
                            onClick={() => setMenuOpen(false)}
                            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                        >
                            <span className={styles.navIcon}>📊</span>
                            Director Dashboard
                        </NavLink>
                    )}
                    <NavLink
                        to="/"
                        end
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>🏫</span>
                        Admission Dashboard
                    </NavLink>
                    <NavLink
                        to="/settings/criteria"
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>⚙️</span>
                        Admission Criteria Rules
                    </NavLink>
                    <NavLink
                        to="/challans"
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>📄</span>
                        Admission Fee Challan
                    </NavLink>
                    <NavLink
                        to="/monthly-challans"
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>🖨️</span>
                        Monthly Batch Challan
                    </NavLink>
                    <NavLink
                        to="/fee-record"
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>💰</span>
                        Fee Record
                    </NavLink>
                    <NavLink
                        to="/student-records"
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>🧑‍🎓</span>
                        Student Records
                    </NavLink>
                    <NavLink
                        to="/certificates"
                        onClick={() => setMenuOpen(false)}
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>🎓</span>
                        Certificates
                    </NavLink>
                </nav>

                <button className={`${styles.logoutBtn} ${menuOpen ? styles.logoutBtnOpen : ''}`} onClick={handleLogout}>
                    <span>⎋</span> Sign Out
                </button>
            </aside>

            <main className={styles.main}>
                <Outlet />
            </main>
        </div>
    )
}
