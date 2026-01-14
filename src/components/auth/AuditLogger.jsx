import { base44 } from '@/api/base44Client';

// Simple hash function for tamper detection
function simpleHash(data) {
  let hash = 0;
  const str = JSON.stringify(data);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Get the last audit log entry to chain hashes
async function getLastAuditLogEntry() {
  try {
    const entries = await base44.entities.AuditLogEntry.list('-created_date', 1);
    return entries[0] || null;
  } catch (error) {
    console.error('Failed to get last audit entry:', error);
    return null;
  }
}

// Main audit logging function
export async function logAudit({
  actionType,
  entityType,
  entityId = null,
  summaryMessage,
  beforeSnapshot = null,
  afterSnapshot = null,
  changedFields = null,
  pageContext = null,
  correlationId = null
}) {
  try {
    // Get current user
    const user = await base44.auth.me();
    
    // Get last entry for hash chain
    const lastEntry = await getLastAuditLogEntry();
    const prevHash = lastEntry?.entry_hash || '0';
    
    // Create entry data
    const entryData = {
      timestamp: new Date().toISOString(),
      actor_user_id: user.id,
      actor_email: user.email,
      actor_role: user.role || 'readonly',
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      summary_message: summaryMessage,
      before_snapshot: beforeSnapshot,
      after_snapshot: afterSnapshot,
      changed_fields: changedFields,
      page_context: pageContext || window.location.pathname,
      correlation_id: correlationId,
      prev_hash: prevHash
    };
    
    // Calculate hash for this entry
    const entryHash = simpleHash({
      prevHash,
      timestamp: entryData.timestamp,
      actor: entryData.actor_email,
      action: entryData.action_type,
      entity: entryData.entity_type,
      summary: entryData.summary_message
    });
    
    entryData.entry_hash = entryHash;
    
    // Create audit log entry
    await base44.entities.AuditLogEntry.create(entryData);
    
    return entryHash;
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    // Don't throw - audit logging should not break main operations
  }
}

// Helper to calculate changed fields
export function calculateChangedFields(before, after) {
  const changes = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  
  allKeys.forEach(key => {
    const oldValue = before?.[key];
    const newValue = after?.[key];
    
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push({
        field: key,
        old_value: oldValue != null ? String(oldValue) : null,
        new_value: newValue != null ? String(newValue) : null
      });
    }
  });
  
  return changes;
}

// Specific audit log helpers
export const auditLog = {
  login: (userEmail) => logAudit({
    actionType: 'LOGIN',
    entityType: 'User',
    summaryMessage: `Användare ${userEmail} loggade in`
  }),
  
  logout: (userEmail) => logAudit({
    actionType: 'LOGOUT',
    entityType: 'User',
    summaryMessage: `Användare ${userEmail} loggade ut`
  }),
  
  createEntity: (entityType, entityId, data, pageContext) => logAudit({
    actionType: 'CREATE',
    entityType,
    entityId,
    summaryMessage: `Skapade ${entityType} med ID ${entityId}`,
    afterSnapshot: data,
    pageContext
  }),
  
  updateEntity: (entityType, entityId, before, after, pageContext) => logAudit({
    actionType: 'UPDATE',
    entityType,
    entityId,
    summaryMessage: `Uppdaterade ${entityType} med ID ${entityId}`,
    beforeSnapshot: before,
    afterSnapshot: after,
    changedFields: calculateChangedFields(before, after),
    pageContext
  }),
  
  statusChange: (entityType, entityId, oldStatus, newStatus, pageContext) => logAudit({
    actionType: 'STATUS_CHANGE',
    entityType,
    entityId,
    summaryMessage: `Ändrade status för ${entityType} från ${oldStatus} till ${newStatus}`,
    changedFields: [{
      field: 'status',
      old_value: oldStatus,
      new_value: newStatus
    }],
    pageContext
  }),
  
  voidProduction: (productionEventId, reason, pageContext) => logAudit({
    actionType: 'VOID',
    entityType: 'ProductionEvent',
    entityId: productionEventId,
    summaryMessage: `Makulerade produktionstillfälle: ${reason}`,
    pageContext
  }),
  
  reversal: (entityType, entityId, reason, pageContext) => logAudit({
    actionType: 'REVERSAL',
    entityType,
    entityId,
    summaryMessage: `Skapade återföring för ${entityType}: ${reason}`,
    pageContext
  }),
  
  acknowledgeAlert: (alertId, orderQty, supplier, pageContext) => logAudit({
    actionType: 'ACKNOWLEDGE',
    entityType: 'InventoryAlert',
    entityId: alertId,
    summaryMessage: `Bekräftade beställning: ${orderQty} enheter från ${supplier}`,
    pageContext
  })
};

export default auditLog;