import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from 'lucide-react';

// Permission definitions by role
const ROLE_PERMISSIONS = {
  admin: [
    'users.manage',
    'roles.manage',
    'integrations.manage',
    'products.read',
    'products.write',
    'bom.read',
    'bom.write',
    'batches.read',
    'batches.changeStatus',
    'batches.correctBatchNumber',
    'inventory.read',
    'inventory.receive',
    'inventory.adjust',
    'inventory.scrap',
    'production.createEvent',
    'production.voidEvent',
    'purchase.createPO',
    'purchase.receivePO',
    'alerts.acknowledgeOrdered',
    'auditlog.read',
    'shopify.manage'
  ],
  production: [
    'products.read',
    'bom.read',
    'batches.read',
    'inventory.read',
    'production.createEvent',
    'alerts.acknowledgeOrdered'
  ],
  warehouse: [
    'products.read',
    'batches.read',
    'batches.changeStatus',
    'inventory.read',
    'inventory.receive',
    'inventory.scrap',
    'alerts.acknowledgeOrdered'
  ],
  purchasing: [
    'products.read',
    'batches.read',
    'inventory.read',
    'inventory.receive',
    'purchase.createPO',
    'purchase.receivePO',
    'alerts.acknowledgeOrdered'
  ],
  readonly: [
    'products.read',
    'batches.read',
    'inventory.read',
    'auditlog.read'
  ]
};

// Hook to check permissions
export function usePermissions() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to load user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const hasPermission = (permission) => {
    if (!user) return false;
    const userRole = user.role || 'readonly';
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList) => {
    return permissionList.some(p => hasPermission(p));
  };

  const hasAllPermissions = (permissionList) => {
    return permissionList.every(p => hasPermission(p));
  };

  return {
    user,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isAdmin: user?.role === 'admin',
    role: user?.role || 'readonly'
  };
}

// Component to gate content by permission
export function PermissionGate({ permission, children, fallback = null, showError = false }) {
  const { hasPermission, loading } = usePermissions();

  if (loading) {
    return null;
  }

  if (!hasPermission(permission)) {
    if (showError) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Du har inte behörighet att se detta innehåll.
          </AlertDescription>
        </Alert>
      );
    }
    return fallback;
  }

  return <>{children}</>;
}

// Export permission constants for easy use
export const PERMISSIONS = {
  // Users & Roles
  USERS_MANAGE: 'users.manage',
  ROLES_MANAGE: 'roles.manage',
  
  // Integrations
  INTEGRATIONS_MANAGE: 'integrations.manage',
  SHOPIFY_MANAGE: 'shopify.manage',
  
  // Products
  PRODUCTS_READ: 'products.read',
  PRODUCTS_WRITE: 'products.write',
  
  // BOM / Recipes
  BOM_READ: 'bom.read',
  BOM_WRITE: 'bom.write',
  MANAGE_RECIPES: 'bom.write',
  
  // Batches
  BATCHES_READ: 'batches.read',
  BATCHES_CHANGE_STATUS: 'batches.changeStatus',
  BATCHES_CORRECT_NUMBER: 'batches.correctBatchNumber',
  
  // Inventory
  INVENTORY_READ: 'inventory.read',
  INVENTORY_RECEIVE: 'inventory.receive',
  INVENTORY_ADJUST: 'inventory.adjust',
  INVENTORY_SCRAP: 'inventory.scrap',
  
  // Production
  PRODUCTION_CREATE: 'production.createEvent',
  PRODUCTION_VOID: 'production.voidEvent',
  
  // Purchase
  PURCHASE_CREATE_PO: 'purchase.createPO',
  PURCHASE_RECEIVE_PO: 'purchase.receivePO',
  
  // Alerts
  ALERTS_ACKNOWLEDGE: 'alerts.acknowledgeOrdered',
  
  // Audit Log
  AUDITLOG_READ: 'auditlog.read'
};

export default PermissionGate;