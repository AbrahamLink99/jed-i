import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, Factory, Boxes,
  Calculator, Menu, X,
  ChevronRight, Bell, Shield, LogOut, ChefHat, Droplets } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { EnvironmentProvider } from '@/components/environment/EnvironmentContext';




const navigation = [
{ name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
{ name: 'Notiser', icon: Bell, page: 'Alerts' },
{ name: 'Artiklar', icon: Package, page: 'Products' },
{ name: 'Recept', icon: ChefHat, page: 'Recipes' },
{ name: 'Produktion', icon: Factory, page: 'Production' },
{ name: 'Tappning', icon: Droplets, page: 'Filling' },
{ name: 'Färdigvaror', icon: Package, page: 'FinishedGoods' },
{ name: 'Batcher', icon: Boxes, page: 'Batches' },
{ name: 'Planering', icon: Calculator, page: 'Planning' }];


export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);


  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  const navItems = React.useMemo(
    () => (user?.role === 'admin' ? [...navigation, { name: 'Admin', icon: Shield, page: 'Admin' }] : navigation),
    [user]
  );

  return (
    <EnvironmentProvider>
      <div className="min-h-screen">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen &&
      <div
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        onClick={() => setSidebarOpen(false)} />

      }

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-16 bg-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 shadow-sm",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-center h-16 border-b border-slate-200">
          <div className="w-8 h-8 rounded-md bg-black" />
        </div>

        <nav className="p-2 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                title={item.name}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center justify-center h-12 w-12 mx-auto rounded-full transition-colors",
                  isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <item.icon className={cn("w-5 h-5")}/>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 bg-white">
          {user && (
            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full bg-slate-100"
                title="Logga ut"
                onClick={() => base44.auth.logout()}
              >
                <span className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </span>
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-16">
        {/* Page content */}
        <main>

          {children}
        </main>
      </div>
    </div>
    </EnvironmentProvider>
  );
}