import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { SynraStoreProvider } from './lib/useSynraStore'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SynraStoreProvider>
      <App />
    </SynraStoreProvider>
  </React.StrictMode>,
)
