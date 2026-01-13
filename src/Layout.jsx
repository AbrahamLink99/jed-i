import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Package, Factory, Boxes, 
  Warehouse, ShoppingCart, Calculator, Menu, X,
  ChevronRight
} from 'lucide-react';
import { Button } from "@/components/ui/button";

const navigation = [
  { name: 'Dashboard', icon: LayoutDashboard, page: 'Dashboard' },
  { name: 'Produkter', icon: Package, page: 'Products' },
  { name: 'Produktion', icon: Factory, page: 'Production' },
  { name: 'Batcher', icon: Boxes, page: 'Batches' },
  { name: 'Lager', icon: Warehouse, page: 'Inventory' },
  { name: 'Ordrar', icon: ShoppingCart, page: 'Orders' },
  { name: 'Planering', icon: Calculator, page: 'Planning' },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Factory className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">Lagermaster</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
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
                  isActive 
                    ? "bg-indigo-50 text-indigo-700" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5",
                  isActive ? "text-indigo-600" : "text-slate-400"
                )} />
                {item.name}
                {isActive && (
                  <ChevronRight className="w-4 h-4 ml-auto text-indigo-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 text-center">
            Lagermaster v1.0
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-6">
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden mr-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-2">
            {navigation.find(n => n.page === currentPageName)?.icon && (
              <div className="p-2 rounded-lg bg-slate-100">
                {React.createElement(
                  navigation.find(n => n.page === currentPageName)?.icon || LayoutDashboard,
                  { className: "w-4 h-4 text-slate-600" }
                )}
              </div>
            )}
            <h1 className="font-semibold text-slate-900">
              {navigation.find(n => n.page === currentPageName)?.name || currentPageName}
            </h1>
          </div>
        </header>

        {/* Page content */}
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}