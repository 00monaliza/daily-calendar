import { Outlet } from 'react-router-dom'
import { TopNav } from '@/widgets/top-nav/TopNav'

export function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
