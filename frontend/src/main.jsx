import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './styles/theme.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#161b27',
          color: '#e8eaf0',
          border: '1px solid #252d42',
          fontSize: '13px',
        },
        success: { iconTheme: { primary: '#34d058', secondary: '#0a0c12' } },
        error: { iconTheme: { primary: '#e53e3e', secondary: '#fff' } },
      }}
    />
  </React.StrictMode>
)
