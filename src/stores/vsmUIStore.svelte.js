/**
 * VSM UI Store - Svelte 5 Runes
 * Manages selection and editing UI state
 * Not persisted (ephemeral state)
 */

/**
 * Create the VSM UI store
 * @returns {Object} VSM UI store with reactive state and actions
 */
/**
 * VSM UI Store - Svelte 5 Runes
 * Ephemeral UI state management
 */

function createVsmUIStore() {
  // Trang chủ state
  let showWelcomeScreen = $state(false)

  // Step selection & editing
  let selectedStepId = $state(null)
  let isEditing = $state(false)

  // Connection selection & editing
  let selectedConnectionId = $state(null)
  let isEditingConnection = $state(false)

  // Guidance banner for backwards mapping
  let guidanceDismissed = $state(false)
  let guidanceForceShow = $state(false)

  return {
    // Welcome Screen Getters & Actions
    get showWelcomeScreen() {
      return showWelcomeScreen
    },
    openWelcomeScreen() {
      showWelcomeScreen = true
      selectedStepId = null
      isEditing = false
      selectedConnectionId = null
      isEditingConnection = false
    },
    closeWelcomeScreen() {
      showWelcomeScreen = false
    },

    // Step Getters & Actions
    get selectedStepId() {
      return selectedStepId
    },
    get isEditing() {
      return isEditing
    },
    selectStep(stepId) {
      selectedStepId = stepId
      selectedConnectionId = null
      isEditingConnection = false
    },
    clearSelection() {
      selectedStepId = null
    },
    setEditing(editing) {
      isEditing = editing
    },

    // Guidance
    get guidanceDismissed() {
      return guidanceDismissed
    },
    get guidanceForceShow() {
      return guidanceForceShow
    },
    dismissGuidance() {
      guidanceDismissed = true
      guidanceForceShow = false
    },
    forceShowGuidance() {
      guidanceForceShow = true
    },
    resetGuidance() {
      guidanceDismissed = false
      guidanceForceShow = false
    },

    // Connection Actions
    selectConnection(connectionId) {
      selectedConnectionId = connectionId
      isEditingConnection = true
      selectedStepId = null
      isEditing = false
    },
    setEditingConnection(editing) {
      isEditingConnection = editing
    },
    clearConnectionSelection() {
      selectedConnectionId = null
      isEditingConnection = false
    },

    // Clear all UI state
    clearUIState() {
      selectedStepId = null
      isEditing = false
      selectedConnectionId = null
      isEditingConnection = false
      guidanceDismissed = false
      guidanceForceShow = false
    },
  }
}

export const vsmUIStore = createVsmUIStore()