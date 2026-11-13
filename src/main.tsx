import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import './index.css'
import { SynraStoreProvider } from './lib/useSynraStore'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <SynraStoreProvider>
        <App />
      </SynraStoreProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
