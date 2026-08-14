// @ts-nocheck
/**
 * VSM Data Store - Svelte 5 Runes
 * Stores steps, connections, and map metadata
 * Persisted to localStorage as a Multi-Map Workspace
 */
import { createStep } from '../models/StepFactory.js'
import { createConnection } from '../models/ConnectionFactory.js'
import { calculateMetrics } from '../utils/calculations/metrics.js'
import { calculateCdReadiness } from '../utils/calculations/cdReadiness.js'
import { emptyDora } from '../utils/calculations/doraReconciliation.js'
import { createAnnotation } from '../utils/annotations.js'
import { sanitizeVSMData, validateVSMData } from '../utils/validation/vsmValidator.js'
import { autoPositionStep } from '../utils/ui/autoPositionStep.js'
import { vsmLocalStorageRepo } from '../infrastructure/VsmLocalStorageRepository.js'
import { vsmUIStore } from './vsmUIStore.svelte.js'

// Hàm tạo ID an toàn (Không bị crash trên môi trường HTTP/Local IP)
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'map-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

function createVsmDataStore() {
  const defaultState = {
    id: null, name: 'Untitled Map', description: '', steps: [], connections: [],
    createdAt: null, updatedAt: null, readinessOverrides: {}, dora: emptyDora(),
    annotations: [], baseline: null
  };

  // 1. TẢI WORKSPACE TỪ LOCALSTORAGE
  let workspaceJson;
  try { workspaceJson = localStorage.getItem('vsm-workspace'); } catch(e) {}
  let workspace = workspaceJson ? JSON.parse(workspaceJson) : null;

  if (!workspace || !workspace.maps) {
    let legacyJson;
    try { legacyJson = localStorage.getItem('vsm-data'); } catch(e) {}
    
    if (legacyJson) {
      const legacyData = sanitizeVSMData(JSON.parse(legacyJson));
      workspace = {
        maps: { [legacyData.id]: legacyData },
        openTabs: [legacyData.id],
        activeTabId: legacyData.id
      };
    } else {
      workspace = { maps: {}, openTabs: [], activeTabId: null };
    }
  }

  let maps = $state(workspace.maps || {});
  let openTabs = $state(workspace.openTabs || []);
  let activeTabId = $state(workspace.activeTabId || null);

  let activeData = maps[activeTabId] ? sanitizeVSMData(maps[activeTabId]) : { ...defaultState };

  let id = $state(activeData.id);
  let name = $state(activeData.name);
  let description = $state(activeData.description);
  let steps = $state(activeData.steps);
  let connections = $state(activeData.connections);
  let createdAt = $state(activeData.createdAt);
  let updatedAt = $state(activeData.updatedAt);
  let readinessOverrides = $state(activeData.readinessOverrides || {});
  let dora = $state(activeData.dora || emptyDora());
  let annotations = $state(activeData.annotations || []);
  let baseline = $state(activeData.baseline || null);

  let cachedMetrics = $derived(calculateMetrics(steps, connections));
  let cachedCdReadiness = $derived(calculateCdReadiness(steps, connections, readinessOverrides));

  function syncActiveToMaps() {
    if (!id) return;
    maps[id] = {
      id, name, description, 
      steps: $state.snapshot(steps), 
      connections: $state.snapshot(connections),
      createdAt, updatedAt, 
      readinessOverrides: $state.snapshot(readinessOverrides),
      dora: $state.snapshot(dora), 
      annotations: $state.snapshot(annotations), 
      baseline: $state.snapshot(baseline)
    };
  }

  function persist() {
    if (id) syncActiveToMaps();
    try {
      localStorage.setItem('vsm-workspace', JSON.stringify({
        maps: $state.snapshot(maps),
        openTabs: $state.snapshot(openTabs),
        activeTabId: id
      }));
    } catch(e) { console.error('Failed to save workspace', e) }
  }

  function loadIntoActive(mapData) {
    const safe = sanitizeVSMData(mapData);
    id = safe.id; name = safe.name; description = safe.description;
    steps = safe.steps; connections = safe.connections;
    createdAt = safe.createdAt; updatedAt = safe.updatedAt;
    readinessOverrides = safe.readinessOverrides || {};
    dora = safe.dora || emptyDora(); annotations = safe.annotations || [];
    baseline = safe.baseline || null;
  }

  function aggregateSubprocesses() {
    const verticalConns = connections.filter(c => c.type === 'vertical');
    const horizontalConns = connections.filter(c => c.type !== 'vertical');

    if (verticalConns.length === 0) {
      steps = steps.map(s => ({ ...s, isSubProcess: false, parentId: null }));
      return;
    }

    const hasHorizontal = new Set();
    horizontalConns.forEach(c => { hasHorizontal.add(c.source); hasHorizontal.add(c.target); });

    const adj = {};
    verticalConns.forEach(c => {
      if (!adj[c.source]) adj[c.source] = [];
      if (!adj[c.target]) adj[c.target] = [];
      adj[c.source].push(c.target);
      adj[c.target].push(c.source);
    });

    const roots = Object.keys(adj).filter(id => hasHorizontal.has(id));
    let newSteps = steps.map(s => ({ ...s, isSubProcess: false, parentId: null }));

    roots.forEach(rootId => {
      const visited = new Set([rootId]);
      const queue = [rootId];

      while (queue.length > 0) {
        const current = queue.shift();
        if (adj[current]) {
          adj[current].forEach(neighbor => {
            if (!visited.has(neighbor) && !hasHorizontal.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
              const childIndex = newSteps.findIndex(s => s.id === neighbor);
              if (childIndex !== -1) {
                newSteps[childIndex] = { ...newSteps[childIndex], isSubProcess: true, parentId: rootId };
              }
            }
          });
        }
      }
    });
    steps = newSteps;
  }

  return {
    get maps() { return maps },
    get openTabs() { return [...openTabs] },
    get id() { return id },
    get name() { return name },
    get description() { return description },
    get steps() { return [...steps] },
    get connections() { return [...connections] },
    get createdAt() { return createdAt },
    get updatedAt() { return updatedAt },
    get metrics() { return cachedMetrics },
    get cdReadiness() { return cachedCdReadiness },
    get readinessOverrides() { return readinessOverrides },
    get dora() { return dora },
    get annotations() { return [...annotations] },
    get baseline() { return baseline },

    openMapInTab(mapId) {
      if (!maps[mapId]) return;
      if (id) syncActiveToMaps();
      if (!openTabs.includes(mapId)) openTabs = [...openTabs, mapId];
      loadIntoActive(maps[mapId]);
      persist();
      vsmUIStore.closeWelcomeScreen();
    },

    closeTab(targetId) {
      openTabs = openTabs.filter(t => t !== targetId);
      if (id === targetId) {
        if (openTabs.length > 0) {
          const nextId = openTabs[openTabs.length - 1];
          loadIntoActive(maps[nextId]);
        } else {
          id = null;
          vsmUIStore.openWelcomeScreen();
        }
      }
      persist();
    },

    deleteMap(targetId) {
      openTabs = openTabs.filter(t => t !== targetId);
      const newMaps = { ...maps };
      delete newMaps[targetId];
      maps = newMaps;
      
      if (id === targetId) {
        if (openTabs.length > 0) {
          const nextId = openTabs[openTabs.length - 1];
          loadIntoActive(maps[nextId]);
        } else {
          id = null;
          vsmUIStore.openWelcomeScreen();
        }
      }
      persist();
    },

    createNewMap(mapName = 'Untitled Map') {
      if (id) syncActiveToMaps();
      const now = new Date().toISOString();
      const newId = generateId(); // Đã thay thế crypto.randomUUID

      id = newId; name = mapName; description = ''; steps = []; connections = [];
      createdAt = now; updatedAt = now; readinessOverrides = {};
      dora = emptyDora(); annotations = []; baseline = null;

      openTabs = [...openTabs, newId];
      syncActiveToMaps();
      persist();
      vsmUIStore.closeWelcomeScreen();
    },

    loadMap(mapData) {
      if (id) syncActiveToMaps();
      const safe = sanitizeVSMData(mapData);
      safe.id = generateId(); // Đã thay thế crypto.randomUUID
      
      loadIntoActive(safe);
      if (!openTabs.includes(safe.id)) openTabs = [...openTabs, safe.id];
      
      syncActiveToMaps();
      persist();
      vsmUIStore.closeWelcomeScreen();
    },

    captureBaseline() { baseline = { steps: steps.map((s) => ({ ...s })), connections: connections.map((c) => ({ ...c })), capturedAt: new Date().toISOString() }; persist() },
    clearBaseline() { baseline = null; persist() },
    updateMapName(newName) { name = newName; updatedAt = new Date().toISOString(); persist() },
    updateMapDescription(newDescription) { description = newDescription; updatedAt = new Date().toISOString(); persist() },
    clearMap() { id = null; name = ''; description = ''; steps = []; connections = []; createdAt = null; updatedAt = null; readinessOverrides = {}; dora = emptyDora(); annotations = []; baseline = null; persist() },
    setDora(updates) { dora = { ...dora, ...updates }; updatedAt = new Date().toISOString(); persist() },
    addAnnotation(targetType, targetId, wasteType, note = '') { const annotation = createAnnotation(targetType, targetId, wasteType, note); annotations = [...annotations, annotation]; updatedAt = new Date().toISOString(); persist(); return annotation },
    updateAnnotation(annotationId, updates) { annotations = annotations.map((a) => (a.id === annotationId ? { ...a, ...updates } : a)); updatedAt = new Date().toISOString(); persist() },
    removeAnnotation(annotationId) { annotations = annotations.filter((a) => a.id !== annotationId); updatedAt = new Date().toISOString(); persist() },
    setReadinessOverride(itemId, status) { readinessOverrides = { ...readinessOverrides, [itemId]: status }; persist() },
    confirmReadiness(itemId) { readinessOverrides = { ...readinessOverrides, [itemId]: 'confirmed' }; persist() },
    resetReadiness(itemId) { const next = { ...readinessOverrides }; delete next[itemId]; readinessOverrides = next; persist() },

    addStep(stepName = 'New Step', overrides = {}) { const position = overrides.position || autoPositionStep(steps.length); const newStep = createStep(stepName, { ...overrides, position }); steps = [...steps, newStep]; updatedAt = new Date().toISOString(); persist(); return newStep },
    updateStep(stepId, updates) { steps = steps.map((step) => step.id === stepId ? { ...step, ...updates } : step); aggregateSubprocesses(); updatedAt = new Date().toISOString(); persist() },
    deleteStep(stepId) { const removedConnectionIds = connections.filter((conn) => conn.source === stepId || conn.target === stepId).map((conn) => conn.id); steps = steps.filter((step) => step.id !== stepId); connections = connections.filter((conn) => conn.source !== stepId && conn.target !== stepId); annotations = annotations.filter((a) => !(a.targetType === 'step' && a.targetId === stepId) && !(a.targetType === 'connection' && removedConnectionIds.includes(a.targetId))); aggregateSubprocesses(); updatedAt = new Date().toISOString(); persist() },
    updateStepPosition(stepId, position) { steps = steps.map((step) => step.id === stepId ? { ...step, position } : step); persist() },
    addConnection(source, target, type = 'forward', reworkRate = 0, sourceHandle = 'right', targetHandle = 'left') { const existingConnection = connections.find((c) => c.source === source && c.target === target); if (existingConnection) return null; const newConnection = createConnection(source, target, type, reworkRate); newConnection.sourceHandle = sourceHandle; newConnection.targetHandle = targetHandle; connections = [...connections, newConnection]; aggregateSubprocesses(); updatedAt = new Date().toISOString(); persist(); return newConnection },
    updateConnection(connectionId, updates) { connections = connections.map((conn) => conn.id === connectionId ? { ...conn, ...updates } : conn); updatedAt = new Date().toISOString(); persist() },
    deleteConnection(connectionId) { connections = connections.filter((conn) => conn.id !== connectionId); annotations = annotations.filter((a) => !(a.targetType === 'connection' && a.targetId === connectionId)); aggregateSubprocesses(); updatedAt = new Date().toISOString(); persist() },
    restoreSnapshot(snapshot) { steps = snapshot.steps.map((s) => ({ ...s })); connections = snapshot.connections.map((c) => ({ ...c })); updatedAt = new Date().toISOString(); persist() },
    getStepById(stepId) { const step = steps.find((s) => s.id === stepId); return step ? { ...step } : null },
    getConnectionById(connectionId) { const conn = connections.find((c) => c.id === connectionId); return conn ? { ...conn } : null },
  }
}

export const vsmDataStore = createVsmDataStore()
export const selectMetrics = () => vsmDataStore.metrics