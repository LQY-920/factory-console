import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './styles.css'
import App from './App'
import { AppStateProvider } from './state'

createRoot(document.getElementById('root')!).render(<StrictMode><AppStateProvider><App /></AppStateProvider></StrictMode>)

