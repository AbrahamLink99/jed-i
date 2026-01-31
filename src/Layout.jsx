import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, Factory, Boxes,
  Warehouse, Calculator, Menu, X,
  ChevronRight, Bell, Shield, LogOut, ChefHat } from
'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from '@/api/base44Client';
import { EnvironmentProvider } from '@/components/environment/EnvironmentContext';
import EnvironmentSwitcher from '@/components/environment/EnvironmentSwitcher';
import EnvironmentBanner from '@/components/environment/EnvironmentBanner';

const navigation = [
{ name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
{ name: 'Notiser', icon: Bell, page: 'Alerts' },
{ name: 'Artiklar', icon: Package, page: 'Products' },
{ name: 'Recept', icon: ChefHat, page: 'Recipes' },
{ name: 'Produktion', icon: Factory, page: 'Production' },
{ name: 'Färdigvaror', icon: Package, page: 'FinishedGoods' },
{ name: 'Batcher', icon: Boxes, page: 'Batches' },
{ name: 'Lager', icon: Warehouse, page: 'Inventory' },
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

  return (
    <EnvironmentProvider>
      <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen &&
      <div
        className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        onClick={() => setSidebarOpen(false)} />

      }

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sky-900 border-r border-sky-900 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-sky-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#03a9f4] flex items-center justify-center">
              <Factory className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-amber-50">Lagermaster</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}>

            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  isActive ?
                  "bg-sky-700/20 text-amber-50" :
                  "text-sky-100 hover:bg-sky-800 hover:text-amber-50"
                )}>

                <item.icon className={cn(
                  "w-5 h-5",
                  isActive ? "text-amber-50" : "text-sky-100"
                )} />
                {item.name}
                {isActive &&
                <ChevronRight className="w-4 h-4 ml-auto text-amber-50" />
                }
              </Link>);

          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sky-800 space-y-3">
          {user?.role === 'admin' &&
          <Link
            to={createPageUrl('Admin')}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
              currentPageName === 'Admin' ?
              "bg-sky-700/20 text-amber-50" :
              "text-sky-100 hover:bg-sky-800 hover:text-amber-50"
            )}>

              <Shield className={cn(
              "w-5 h-5",
              currentPageName === 'Admin' ? "text-amber-50" : "text-sky-100"
              )} />
              Admin
            </Link>
          }
          {user &&
          <div className="px-4 py-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-sky-100">Inloggad som:</span>
                <Badge variant="outline" className="text-xs border-amber-50 text-amber-50">
                  {user.role || 'user'}
                </Badge>
              </div>
              <p className="text-sm font-medium text-amber-50 truncate">
                {user.email}
              </p>
              <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => base44.auth.logout()}>

                <LogOut className="w-4 h-4 mr-2" />
                Logga ut
              </Button>
            </div>
          }
          <div className="text-xs text-sky-100/60 text-center">
            Lagermaster v1.0
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-sky-900 border-b border-sky-900 flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon" className="text-amber-50 mr-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-9 w-9 lg:hidden"

              onClick={() => setSidebarOpen(true)}>

              <Menu className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-2">
              {navigation.find((n) => n.page === currentPageName)?.icon &&
              <div className="p-2 rounded-lg bg-sky-800">
                  {React.createElement(
                  navigation.find((n) => n.page === currentPageName)?.icon || LayoutDashboard,
                  { className: "w-4 h-4 text-amber-50" }
                )}
                </div>
              }
              <h1 className="text-amber-50 font-semibold">
                {navigation.find((n) => n.page === currentPageName)?.name || currentPageName}
              </h1>
            </div>
          </div>

          <EnvironmentSwitcher />
        </header>

        {/* Page content */}
        <main>
          <EnvironmentBanner />
          {children}
        </main>
      </div>
    </div>
    </EnvironmentProvider>);

}