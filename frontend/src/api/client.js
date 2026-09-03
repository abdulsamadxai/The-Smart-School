import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

// Credentials are stored in sessionStorage so they persist for the browser session
// but are cleared when the tab is closed.
export function setCredentials(username, password) {
    sessionStorage.setItem('auth_user', username)
    sessionStorage.setItem('auth_pass', password)
}

export function clearCredentials() {
    sessionStorage.removeItem('auth_user')
    sessionStorage.removeItem('auth_pass')
    sessionStorage.removeItem('auth_role')
}

export function hasCredentials() {
    return !!sessionStorage.getItem('auth_user')
}

export function setRole(role) {
    sessionStorage.setItem('auth_role', role)
}

export function getRole() {
    return sessionStorage.getItem('auth_role') || 'admin'
}

function getAuthHeader() {
    const user = sessionStorage.getItem('auth_user') || ''
    const pass = sessionStorage.getItem('auth_pass') || ''
    return { Authorization: `Basic ${btoa(`${user}:${pass}`)}` }
}

const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
    config.headers = { ...config.headers, ...getAuthHeader() }
    return config
})

api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            clearCredentials()
            window.location.reload()
        }
        return Promise.reject(err)
    }
)

// Students
export const getStudents = (params) => api.get('/students', { params })
export const getStudent = (id) => api.get(`/students/${id}`)
export const registerStudent = (data) => api.post('/students', data)
export const scheduleTest = (id, data) => api.patch(`/students/${id}/schedule-test`, data)
export const enterScore = (id, data) => api.patch(`/students/${id}/enter-score`, data)
export const decide = (id, data) => api.patch(`/students/${id}/decide`, data)
export const confirmJoining = (id, data) => api.patch(`/students/${id}/confirm-joining`, data)
export const saveBatchFees = (data) => api.post('/fees/batch-save', data)

// Criteria
export const getCriteria = () => api.get('/criteria')
export const createCriterion = (data) => api.post('/criteria', data)
export const updateCriterion = (id, data) => api.put(`/criteria/${id}`, data)
export const deleteCriterion = (id) => api.delete(`/criteria/${id}`)

// Dashboard
export const getDashboardStats = () => api.get('/dashboard/stats')

// Export
export const getExportUrl = () => {
    const user = sessionStorage.getItem('auth_user') || ''
    const pass = sessionStorage.getItem('auth_pass') || ''
    const url = new URL(`${BASE_URL}/students/export/csv`)
    url.username = user
    url.password = pass
    return `${BASE_URL}/students/export/csv`
}

export const exportCSV = () => {
    return api.get('/students/export/csv', { responseType: 'blob' })
}

export default api
