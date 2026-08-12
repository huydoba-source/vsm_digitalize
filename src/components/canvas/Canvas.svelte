<script>
  /**
   * VSMCanvas - Svelte Flow integration for VSM visualization
   *
   * This component wraps Svelte Flow and provides:
   * - Custom node types (StepNode for process visualization)
   * - Svelte stores integration for VSM data
   * - Pan/zoom controls and mini-map
   * - Node positioning and drag-to-update
   * - Connection visualization between steps
   */
  import {
    SvelteFlow,
    Background,
    Controls,
    MiniMap,
    MarkerType,
  } from '@xyflow/svelte'
  import '@xyflow/svelte/dist/style.css'

  import { vsmDataStore } from '../../stores/vsmDataStore.svelte.js'
  import { vsmUIStore } from '../../stores/vsmUIStore.svelte.js'
  import { withUndo } from '../../utils/undoHelper.js'
  import { simDataStore } from '../../stores/simulationDataStore.svelte.js'
  import { simControlStore } from '../../stores/simulationControlStore.svelte.js'
  import StepNode from './nodes/StepNode.svelte'
  import ReworkEdge from './edges/ReworkEdge.svelte'
  import GuidanceBanner from '../ui/GuidanceBanner.svelte'
  import ConfirmPopover from '../ui/ConfirmPopover.svelte'
  import EmptyCanvasPlaceholder from './EmptyCanvasPlaceholder.svelte'

  let showDeleteConfirm = $state(false)

  const nodeTypes = {
    stepNode: StepNode,
  }

  const edgeTypes = {
    rework: ReworkEdge,
  }

  const defaultEdgeOptions = {
    type: 'smoothstep',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
    },
    style: {
      strokeWidth: 2,
    },
  }

  // Non-reactive node cache keyed by step ID.
  let nodeCache = Object.create(null)

  // buildNode hỗ trợ tọa độ safePosition dự phòng khi step.position bị undefined
  const buildNode = (step, queueSize, isBottleneck, selected, index = 0) => {
    const safeX = typeof step.position?.x === 'number' && !isNaN(step.position.x)
      ? step.position.x
      : 50 + index * 250
    const safeY = typeof step.position?.y === 'number' && !isNaN(step.position.y)
      ? step.position.y
      : 150
    const safePosition = { x: safeX, y: safeY }

    return {
      id: step.id,
      type: 'stepNode',
      position: safePosition,
      data: {
        ...step,
        position: safePosition,
        simulationQueueSize: queueSize,
        isSimulationBottleneck: isBottleneck,
      },
      selected,
    }
  }

  let nodes = $derived.by(() => {
    const currentStepIds = new Set(vsmDataStore.steps.map((s) => s.id))
    // Evict stale cache entries for deleted steps
    for (const id of Object.keys(nodeCache)) {
      if (!currentStepIds.has(id)) delete nodeCache[id]
    }

    return vsmDataStore.steps.map((step, index) => {
      const queueSize = simControlStore.isRunning
        ? simDataStore.queueSizesByStepId[step.id]
        : undefined
      const isBottleneck = simDataStore.detectedBottlenecks.includes(step.id)
      const selected = step.id === vsmUIStore.selectedStepId

      const cached = nodeCache[step.id]
      if (
        cached &&
        cached.step === step &&
        cached.queueSize === queueSize &&
        cached.isBottleneck === isBottleneck &&
        cached.selected === selected &&
        typeof cached.node.position?.x === 'number'
      ) {
        return cached.node
      }

      const node = buildNode(step, queueSize, isBottleneck, selected, index)
      nodeCache[step.id] = { step, queueSize, isBottleneck, selected, node }
      return node
    })
  })

  // Helper function to get edge stroke color
  function getEdgeStrokeColor(isSelected, connectionType) {
    if (isSelected) return '#3b82f6'
    if (connectionType === 'rework') return '#ef4444'
    return '#6b7280'
  }

  // Derive edges from store
  let edges = $derived(
    vsmDataStore.connections.map((conn) => {
      const isSelected = conn.id === vsmUIStore.selectedConnectionId
      const isRework = conn.type === 'rework'
      return {
        id: conn.id,
        source: conn.source,
        target: conn.target,
        type: isRework ? 'rework' : 'smoothstep',
        animated: isRework,
        selected: isSelected,
        style: {
          stroke: getEdgeStrokeColor(isSelected, conn.type),
          strokeWidth: isSelected ? 3 : 2,
          strokeDasharray: conn.type === 'rework' ? '5,5' : 'none',
        },
        label: conn.type === 'rework' ? `${conn.reworkRate}% rework` : undefined,
        labelStyle: { fill: conn.type === 'rework' ? '#ef4444' : '#6b7280', fontSize: 10 },
      }
    })
  )

  function handleConnect(connection) {
    const { source, target } = connection
    withUndo(() => vsmDataStore.addConnection(source, target))
  }

  function handleNodeDragStop({ targetNode, nodes }) {
    const dragged = nodes?.length ? nodes : targetNode ? [targetNode] : []
    dragged.forEach((node) => {
      if (node.position && typeof node.position.x === 'number') {
        vsmDataStore.updateStepPosition(node.id, node.position)
      }
    })
  }

  function handleNodeClick({ node }) {
    vsmUIStore.clearConnectionSelection()
    vsmUIStore.selectStep(node.id)
    vsmUIStore.setEditing(true)
  }

  function handleEdgeClick({ edge }) {
    vsmUIStore.selectConnection(edge.id)
  }

  function handlePaneClick() {
    vsmUIStore.clearSelection()
    vsmUIStore.clearConnectionSelection()
  }

  function handleKeyDown(event) {
    if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      vsmUIStore.selectedStepId
    ) {
      showDeleteConfirm = true
    }
  }

  function handleConfirmKeyboardDelete() {
    if (vsmUIStore.selectedStepId) {
      withUndo(() => vsmDataStore.deleteStep(vsmUIStore.selectedStepId))
    }
    showDeleteConfirm = false
  }

  function handleCancelKeyboardDelete() {
    showDeleteConfirm = false
  }

  function getNodeColor(node) {
    if (node.selected) return '#3b82f6'
    return '#9ca3af'
  }
</script>

<div
  class="w-full h-full relative"
  onkeydown={handleKeyDown}
  tabindex="0"
  role="application"
  aria-label="Value stream map canvas"
  data-testid="vsm-canvas"
>
  {#if nodes.length === 0}
    <EmptyCanvasPlaceholder />
  {:else}
    <GuidanceBanner />
  {/if}
  {#if showDeleteConfirm}
    <div class="absolute top-4 left-1/2 -translate-x-1/2 z-[60]">
      <div class="relative">
        <ConfirmPopover
          message="Delete this step?"
          onconfirm={handleConfirmKeyboardDelete}
          oncancel={handleCancelKeyboardDelete}
        />
      </div>
    </div>
  {/if}
  <SvelteFlow
    {nodes}
    {edges}
    {nodeTypes}
    {edgeTypes}
    {defaultEdgeOptions}
    fitView
    fitViewOptions={{ padding: 0.2 }}
    minZoom={0.2}
    maxZoom={2}
    zoomOnPinch
    panOnScroll={false}
    zoomOnScroll={false}
    preventScrolling={false}
    snapToGrid
    snapGrid={[20, 20]}
    onconnect={handleConnect}
    onnodedragstop={handleNodeDragStop}
    onnodeclick={handleNodeClick}
    onedgeclick={handleEdgeClick}
    onpaneclick={handlePaneClick}
  >
    <Background color="#e5e7eb" gap={20} />
    <Controls />
    <MiniMap
      class="!hidden sm:!block"
      nodeColor={getNodeColor}
      maskColor="rgba(0, 0, 0, 0.1)"
    />
  </SvelteFlow>
</div>