import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/AppSidebar'
import { AppNavbar } from '@/components/layout/AppNavbar'
import { GlobalBarcodeScanner } from '@/components/layout/GlobalBarcodeScanner'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppNavbar />
          <main className="flex-1 overflow-auto p-6 bg-gray-50/80 min-h-[calc(100vh-4rem)]">
            {children}
          </main>
        </SidebarInset>
        <GlobalBarcodeScanner />
      </SidebarProvider>
    </TooltipProvider>
  )
}
