import '@fontsource-variable/inter/index.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ProvedorAuth } from './auth/auth'
import { ProvedorAvisos } from './components/avisos'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
})

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ProvedorAvisos>
          <ProvedorAuth>
            <App />
          </ProvedorAuth>
        </ProvedorAvisos>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
