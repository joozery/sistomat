import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppNavbar } from '@/components/layout/AppNavbar'
import { GlobalBarcodeScanner } from '@/components/layout/GlobalBarcodeScanner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TechnicianDesktopGuard } from '@/components/layout/TechnicianDesktopGuard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TechnicianDesktopGuard>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <AppNavbar />
            <main className="flex-1 overflow-auto p-3 pb-10 sm:p-6 sm:pb-10 bg-gray-50/80 min-h-[calc(100vh-4rem)]">
              {children}
            </main>
          </SidebarInset>
          <GlobalBarcodeScanner />
        </SidebarProvider>
      </TooltipProvider>
    </TechnicianDesktopGuard>
  )
}
