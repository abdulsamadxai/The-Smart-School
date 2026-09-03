import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { clearCredentials, getRole } from '../api/client'
import styles from './Layout.module.css'

export default function Layout() {
    const navigate = useNavigate()
    const [menuOpen, setMenuOpen] = useState(false)
    const role = getRole()

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
                </div>

                <nav className={styles.nav}>
                    {role === 'director' && (
                        <NavLink
                            to="/director"
                            className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                        >
                            <span className={styles.navIcon}>📊</span>
                            Director Dashboard
                        </NavLink>
                    )}
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>🏫</span>
                        Admission Dashboard
                    </NavLink>
                    <NavLink
                        to="/settings/criteria"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>⚙️</span>
                        Admission Criteria Rules
                    </NavLink>
                    <NavLink
                        to="/challans"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>📄</span>
                        Admission Fee Challan
                    </NavLink>
                    <NavLink
                        to="/monthly-challans"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>🖨️</span>
                        Monthly Batch Challan
                    </NavLink>
                    <NavLink
                        to="/fee-record"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>💰</span>
                        Fee Record
                    </NavLink>
                    <NavLink
                        to="/student-records"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>🧑‍🎓</span>
                        Student Records
                    </NavLink>
                    <NavLink
                        to="/certificates"
                        className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
                    >
                        <span className={styles.navIcon}>🎓</span>
                        Certificates
                    </NavLink>
                </nav>

                <button className={styles.logoutBtn} onClick={handleLogout}>
                    <span>⎋</span> Sign Out
                </button>
            </aside>

            <main className={styles.main}>
                <Outlet />
            </main>
        </div>
    )
}
