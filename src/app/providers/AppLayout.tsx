import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { TopNav } from '@/widgets/top-nav/TopNav'
import { BottomNav } from '@/widgets/bottom-nav/BottomNav'
import { BookingModal } from '@/widgets/booking-modal/BookingModal'
import { ToastContainer } from '@/shared/ui/Toast'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { useProperties } from '@/entities/property/queries'
import { useUser } from '@/features/auth/useUser'

export function AppLayout() {
  const isMobile = useIsMobile()
  const { user } = useUser()
  const { data: properties = [] } = useProperties(user?.id)
  const [fabModalOpen, setFabModalOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className={`flex-1 ${isMobile ? 'pb-16' : ''}`}>
        <Outlet />
      </main>
      {isMobile && (
        <BottomNav onAddBooking={() => setFabModalOpen(true)} />
      )}
      {fabModalOpen && (
        <BookingModal
          booking={null}
          properties={properties}
          prefillDate={null}
          prefillPropertyId={null}
          onClose={() => setFabModalOpen(false)}
        />
      )}
      <ToastContainer />
    </div>
  )
}
