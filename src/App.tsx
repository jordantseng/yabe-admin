import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'
import { cn } from '@/lib/utils'
import logo from './assets/logo.png'
import OrderDetailPage from './pages/OrderDetailPage'
import OrdersPage from './pages/OrdersPage'

function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b px-8 py-3">
        <div className="flex items-center gap-3">
          <img src={logo} alt="YABE logo" className="h-12 w-auto rounded-sm" />
          <NavigationMenu>
            <NavigationMenuList className="gap-2">
              <NavigationMenuItem>
                <NavLink
                  to="/orders"
                  className={({ isActive }) =>
                    cn(navigationMenuTriggerStyle(), isActive && 'bg-muted')
                  }
                >
                  訂單
                </NavLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Navigate to="/orders" replace />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:orderId" element={<OrderDetailPage />} />
        <Route path="*" element={<Navigate to="/orders" replace />} />
      </Routes>
    </div>
  )
}

export default App
