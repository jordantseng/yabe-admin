import { NavLink, Outlet } from "react-router-dom";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/useAuth";
import logo from "@/assets/logo.png";

export function AppLayout() {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b px-8 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="YABE logo"
              className="h-[36px] w-auto rounded-sm"
            />
            <NavigationMenu>
              <NavigationMenuList className="gap-2">
                <NavigationMenuItem>
                  <NavLink
                    to="/orders"
                    className={({ isActive }) =>
                      cn(navigationMenuTriggerStyle(), isActive && "bg-muted")
                    }
                  >
                    訂單
                  </NavLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            {user?.email && <span className="max-w-[200px] truncate">{user.email}</span>}
            <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
              登出
            </Button>
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  );
}
