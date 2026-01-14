import React from 'react';
import AlertList from '@/components/alerts/AlertList';

export default function AlertsPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AlertList />
      </div>
    </div>
  );
}