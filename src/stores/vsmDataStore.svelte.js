// @ts-nocheck
/**
 * VSM Data Store - Svelte 5 Runes
 * Stores steps, connections, and map metadata
 * Persisted to localStorage
 * @file This file uses Svelte 5 runes ($state, etc.)
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
/**
 * @typedef {import('../types/index.js').Step} Step
 * @typedef {import('../types/index.js').Connection} Connection
 * @typedef {import('../types/index.js').ValueStreamMap} ValueStreamMap
 */

/**
 * Create the VSM data store
 * @param {Object} [repository] - Persistence repository (default: vsmLocalStorageRepo)
 * @returns {Object} VSM data store with reactive state and actions
 */
function createVsmDataStore(repository = vsmLocalStorageRepo) {
  const initialState = {
    id: null,
    name: '',
    description: '',
    steps: [],
    connections: [],
    createdAt: null,
    updatedAt: null,
    readinessOverrides: {},
    dora: emptyDora(),
    annotations: [],
  }

  // Load persisted state; sanitize on read and validate to catch corrupted localStorage
  const rawPersisted = repository.load(initialState, sanitizeVSMData)
  const persistedValidation = validateVSMData(rawPersisted)
  const persisted = persistedValidation.valid ? rawPersisted : initialState

  // Reactive state using Svelte 5 $state rune
  let id = $state(persisted.id)
  let name = $state(persisted.name)
  let description = $state(persisted.description)
  let steps = $state(persisted.steps)
  let connections = $state(persisted.connections)
  let createdAt = $state(persisted.createdAt)
  let updatedAt = $state(persisted.updatedAt)
  // User confirm/override decisions for the CD readiness scorecard, keyed by item id
  let readinessOverrides = $state(persisted.readinessOverrides || {})
  // DORA metrics for this map (P1c)
  let dora = $state(persisted.dora || emptyDora())
  // Kaizen-burst improvement annotations for this map
  let annotations = $state(persisted.annotations || [])
  // Captured baseline (current-state) snapshot for future-state comparison
  let baseline = $state(persisted.baseline || null)

  // Cached metrics — only recomputed when steps or connections change
  let cachedMetrics = $derived(calculateMetrics(steps, connections))

  // CD readiness scorecard — recomputed when steps, connections, or overrides change
  let cachedCdReadiness = $derived(
    calculateCdReadiness(steps, connections, readinessOverrides)
  )

  // Persist current state via repository
  function persist() {
    repository.save({
      id,
      name,
      description,
      steps,
      connections,
      createdAt,
      updatedAt,
      readinessOverrides,
      dora,
      annotations,
      baseline,
    })
  }

  function aggregateSubprocesses() {
    const verticalConns = connections.filter(c => c.type === 'vertical')
    const horizontalConns = connections.filter(c => c.type !== 'vertical')

    if (verticalConns.length === 0) {
      steps = steps.map(s => ({ ...s, isSubProcess: false, parentId: null }))
      return
    }

    // 1. Tìm các block thuộc luồng chính (có kết nối ngang)
    const hasHorizontal = new Set()
    horizontalConns.forEach(c => {
      hasHorizontal.add(c.source)
      hasHorizontal.add(c.target)
    })

    // 2. Tạo danh sách kề (đồ thị không hướng) để không phụ thuộc vào chiều vẽ mũi tên
    const adj = {}
    verticalConns.forEach(c => {
      if (!adj[c.source]) adj[c.source] = []
      if (!adj[c.target]) adj[c.target] = []
      adj[c.source].push(c.target)
      adj[c.target].push(c.source)
    })

    // 3. Cha là những block vừa nằm trên luồng chính, vừa có kết nối dọc
    const roots = Object.keys(adj).filter(id => hasHorizontal.has(id))

    let hasChanges = false
    let newSteps = steps.map(s => ({ ...s, isSubProcess: false, parentId: null }))

    roots.forEach(rootId => {
      const visited = new Set([rootId])
      const queue = [rootId]
      const descendants = []

      // Duyệt đồ thị để tìm tất cả các block con/cháu
      while (queue.length > 0) {
        const current = queue.shift()
        if (adj[current]) {
          adj[current].forEach(neighbor => {
            // Chỉ đi xuống các block con, không đi ngược sang block chính khác
            if (!visited.has(neighbor) && !hasHorizontal.has(neighbor)) {
              visited.add(neighbor)
              queue.push(neighbor)
              descendants.push(neighbor)
              
              // Gắn cờ và parentId cho block con
              const childIndex = newSteps.findIndex(s => s.id === neighbor)
              if (childIndex !== -1) {
                newSteps[childIndex] = { ...newSteps[childIndex], isSubProcess: true, parentId: rootId }
              }
            }
          })
        }
      }

      if (descendants.length === 0) return

      // Tính tổng Queue Size của các con
      let totalQueue = 0
      descendants.forEach(id => {
        const childNode = newSteps.find(s => s.id === id)
        if (childNode) {
          totalQueue += Number(childNode.queueSize) || 0
        }
      })

      // Chỉ ghi đè Queue Size cho Block Cha
      const parentIndex = newSteps.findIndex(s => s.id === rootId)
      if (parentIndex !== -1) {
        newSteps[parentIndex] = {
          ...newSteps[parentIndex],
          queueSize: totalQueue
        }
        hasChanges = true
      }
    })

    if (hasChanges) steps = newSteps
  }

  return {
    // Reactive getters
    get id() {
      return id
    },
    get name() {
      return name
    },
    get description() {
      return description
    },
    get steps() {
      return [...steps]
    },
    get connections() {
      return [...connections]
    },
    get createdAt() {
      return createdAt
    },
    get updatedAt() {
      return updatedAt
    },

    // Derived metrics — cached via $derived, only recomputed when steps/connections change
    get metrics() {
      return cachedMetrics
    },

    // Derived CD readiness scorecard (13 items)
    get cdReadiness() {
      return cachedCdReadiness
    },

    // User confirm/override decisions for the readiness scorecard
    get readinessOverrides() {
      return readinessOverrides
    },

    // DORA metrics for this map
    get dora() {
      return dora
    },

    // Kaizen-burst improvement annotations
    get annotations() {
      return [...annotations]
    },

    // Captured baseline snapshot for current-vs-future-state comparison
    get baseline() {
      return baseline
    },

    // Map-level Actions
    createNewMap(mapName) {
      const now = new Date().toISOString()
      id = crypto.randomUUID()
      name = mapName
      description = ''
      steps = []
      connections = []
      createdAt = now
      updatedAt = now
      readinessOverrides = {}
      dora = emptyDora()
      annotations = []
      baseline = null
      persist()
      vsmUIStore.closeWelcomeScreen() // MỚI THÊM: Đóng Trang chủ sau khi tạo map mới
    },

    // Capture the live map as the baseline (current state) for comparison
    captureBaseline() {
      baseline = {
        steps: steps.map((s) => ({ ...s })),
        connections: connections.map((c) => ({ ...c })),
        capturedAt: new Date().toISOString(),
      }
      persist()
    },

    clearBaseline() {
      baseline = null
      persist()
    },

    updateMapName(newName) {
      name = newName
      updatedAt = new Date().toISOString()
      persist()
    },

    updateMapDescription(newDescription) {
      description = newDescription
      updatedAt = new Date().toISOString()
      persist()
    },

    loadMap(mapData) {
      const safe = sanitizeVSMData(mapData)
      const validation = validateVSMData(safe)
      if (!validation.valid) {
        console.warn('loadMap: data failed validation, loading with safe defaults', validation.errors)
      }
      id = safe.id
      name = safe.name
      description = safe.description
      steps = safe.steps
      connections = safe.connections
      createdAt = safe.createdAt
      updatedAt = safe.updatedAt
      readinessOverrides = safe.readinessOverrides || {}
      dora = safe.dora || emptyDora()
      annotations = safe.annotations || []
      baseline = safe.baseline || null
      persist()
      vsmUIStore.closeWelcomeScreen() // MỚI THÊM: Đóng Trang chủ sau khi tải map/template
    },

    clearMap() {
      id = null
      name = ''
      description = ''
      steps = []
      connections = []
      createdAt = null
      updatedAt = null
      readinessOverrides = {}
      dora = emptyDora()
      annotations = []
      baseline = null
      persist()
    },

    // Update this map's DORA metrics (P1c)
    setDora(updates) {
      dora = { ...dora, ...updates }
      updatedAt = new Date().toISOString()
      persist()
    },

    // Kaizen-burst annotation CRUD (per-map improvement backlog)
    addAnnotation(targetType, targetId, wasteType, note = '') {
      const annotation = createAnnotation(targetType, targetId, wasteType, note)
      annotations = [...annotations, annotation]
      updatedAt = new Date().toISOString()
      persist()
      return annotation
    },

    updateAnnotation(annotationId, updates) {
      annotations = annotations.map((a) => (a.id === annotationId ? { ...a, ...updates } : a))
      updatedAt = new Date().toISOString()
      persist()
    },

    removeAnnotation(annotationId) {
      annotations = annotations.filter((a) => a.id !== annotationId)
      updatedAt = new Date().toISOString()
      persist()
    },

    // CD readiness confirm/override/reset (per-map, never mutates steps)
    setReadinessOverride(itemId, status) {
      readinessOverrides = { ...readinessOverrides, [itemId]: status }
      persist()
    },

    confirmReadiness(itemId) {
      readinessOverrides = { ...readinessOverrides, [itemId]: 'confirmed' }
      persist()
    },

    resetReadiness(itemId) {
      const next = { ...readinessOverrides }
      delete next[itemId]
      readinessOverrides = next
      persist()
    },

    // Step CRUD
    addStep(stepName = 'New Step', overrides = {}) {
      const position = overrides.position || autoPositionStep(steps.length)
      const newStep = createStep(stepName, { ...overrides, position })
      steps = [...steps, newStep]
      updatedAt = new Date().toISOString()
      persist()
      return newStep
    },

    updateStep(stepId, updates) {
      steps = steps.map((step) =>
        step.id === stepId ? { ...step, ...updates } : step
      )
      aggregateSubprocesses()
      updatedAt = new Date().toISOString()
      persist()
    },

    deleteStep(stepId) {
      const removedConnectionIds = connections
        .filter((conn) => conn.source === stepId || conn.target === stepId)
        .map((conn) => conn.id)
      steps = steps.filter((step) => step.id !== stepId)
      connections = connections.filter(
        (conn) => conn.source !== stepId && conn.target !== stepId
      )
      // Prune annotations targeting the removed step or its connections
      annotations = annotations.filter(
        (a) =>
          !(a.targetType === 'step' && a.targetId === stepId) &&
          !(a.targetType === 'connection' && removedConnectionIds.includes(a.targetId))
      )
      aggregateSubprocesses()
      updatedAt = new Date().toISOString()
      persist()
    },

    updateStepPosition(stepId, position) {
      steps = steps.map((step) =>
        step.id === stepId ? { ...step, position } : step
      )
      // Don't update updatedAt for position-only changes (drag operations)
      persist()
    },

    // Connection CRUD
    // BỔ SUNG tham số sourceHandle và targetHandle
    addConnection(source, target, type = 'forward', reworkRate = 0, sourceHandle = 'right', targetHandle = 'left') {
      const existingConnection = connections.find(
        (c) => c.source === source && c.target === target
      )
      if (existingConnection) return null

      const newConnection = createConnection(source, target, type, reworkRate)
      // Lưu lại vị trí chấm tròn
      newConnection.sourceHandle = sourceHandle
      newConnection.targetHandle = targetHandle
      
      connections = [...connections, newConnection]
      aggregateSubprocesses() // Vẫn giữ nguyên lệnh gọi này
      updatedAt = new Date().toISOString()
      persist()
      return newConnection
    },

    updateConnection(connectionId, updates) {
      connections = connections.map((conn) =>
        conn.id === connectionId ? { ...conn, ...updates } : conn
      )
      updatedAt = new Date().toISOString()
      persist()
    },

    deleteConnection(connectionId) {
      connections = connections.filter((conn) => conn.id !== connectionId)
      annotations = annotations.filter(
        (a) => !(a.targetType === 'connection' && a.targetId === connectionId)
      )
      aggregateSubprocesses()
      updatedAt = new Date().toISOString()
      persist()
    },

    /**
     * Restore a snapshot of steps and connections (used by undo/redo).
     * Bulk-assigns state fields and persists.
     * @param {{ steps: Array, connections: Array }} snapshot
     */
    restoreSnapshot(snapshot) {
      steps = snapshot.steps.map((s) => ({ ...s }))
      connections = snapshot.connections.map((c) => ({ ...c }))
      updatedAt = new Date().toISOString()
      persist()
    },

    // Get step by ID helper — returns shallow copy to prevent untracked mutations
    getStepById(stepId) {
      const step = steps.find((s) => s.id === stepId)
      return step ? { ...step } : null
    },

    // Get connection by ID helper — returns shallow copy to prevent untracked mutations
    getConnectionById(connectionId) {
      const conn = connections.find((c) => c.id === connectionId)
      return conn ? { ...conn } : null
    },
  }
}

// Export singleton instance
export const vsmDataStore = createVsmDataStore()

// Selector for metrics (for compatibility)
export const selectMetrics = () => vsmDataStore.metrics