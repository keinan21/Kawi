import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ClerkProvider } from '@clerk/clerk-react'

import { routeTree } from './routeTree.gen'
import { BannerTanpaClerkKey } from './components/murid/BannerTanpaClerkKey.tsx'
import './index.css'

const router = createRouter({ routeTree })

const container = document.getElementById('root')
if (!container) throw new Error('Elemen #root tidak ditemukan')

const publishableKey = import.meta.env['VITE_CLERK_PUBLISHABLE_KEY']

const root = createRoot(container)

if (typeof publishableKey !== 'string' || publishableKey.length === 0) {
  root.render(
    <StrictMode>
      <BannerTanpaClerkKey />
    </StrictMode>,
  )
} else {
  root.render(
    <StrictMode>
      <ClerkProvider publishableKey={publishableKey}>
        <RouterProvider router={router} />
      </ClerkProvider>
    </StrictMode>,
  )
}