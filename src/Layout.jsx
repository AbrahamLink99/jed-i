import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, Factory, Boxes,
  Warehouse, Calculator, Menu, X,
  ChevronRight, Bell, Shield, LogOut, ChefHat, Droplets } from
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
{ name: 'Tappning', icon: Droplets, page: 'Filling' },
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
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0 shadow-sm",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600 to-cyan-700 flex items-center justify-center shadow-sm">
              <Factory className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">Lagermaster</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}>

            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {navigation.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive ?
                  "bg-cyan-50 text-cyan-900 shadow-sm" :
                  "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                )}>

                <item.icon className={cn(
                  "w-4 h-4",
                  isActive ? "text-cyan-600" : "text-slate-500"
                )} />
                {item.name}
                {isActive &&
                <ChevronRight className="w-4 h-4 ml-auto text-cyan-600" />
                }
              </Link>);

          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-slate-200 bg-slate-50 space-y-2">
          {user?.role === 'admin' &&
          <Link
            to={createPageUrl('Admin')}
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
              currentPageName === 'Admin' ?
              "bg-cyan-50 text-cyan-900 shadow-sm" :
              "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
            )}>

              <Shield className={cn(
              "w-4 h-4",
              currentPageName === 'Admin' ? "text-cyan-600" : "text-slate-500"
              )} />
              Admin
            </Link>
          }
          {user &&
          <div className="px-3 py-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Inloggad som:</span>
                <Badge variant="secondary" className="text-xs">
                  {user.role || 'user'}
                </Badge>
              </div>
              <p className="text-sm font-medium text-slate-900 truncate">
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
          <div className="text-xs text-slate-500 text-center">
            Lagermaster v1.0
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon" 
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>

            <div className="flex items-center gap-3">
              {navigation.find((n) => n.page === currentPageName)?.icon &&
              <div className="p-2 rounded-lg bg-cyan-50">
                  {React.createElement(
                  navigation.find((n) => n.page === currentPageName)?.icon || LayoutDashboard,
                  { className: "w-5 h-5 text-cyan-600" }
                )}
                </div>
              }
              <h1 className="text-slate-900 font-semibold text-lg">
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
    </EnvironmentProvider>
  );
}