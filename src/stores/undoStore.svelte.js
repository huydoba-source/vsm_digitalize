/**
 * Undo/Redo Store - Svelte 5 Runes
 * Manages snapshot stacks for undo and redo operations on VSM data.
 * Snapshots contain { steps, connections } and are deep-copied to prevent
 * shared-reference mutations.
 *
 * @file This file uses Svelte 5 runes ($state)
 */

import { vsmDataStore } from './vsmDataStore.svelte.js'

const MAX_UNDO_DEPTH = 20

/**
 * Deep-copy a snapshot to prevent shared-reference mutations
 * @param {{ steps: Array, connections: Array }} snapshot
 * @returns {{ steps: Array, connections: Array }}
 */
const cloneSnapshot = (snapshot) => ({
  steps: snapshot.steps.map((s) => ({ ...s })),
  connections: snapshot.connections.map((c) => ({ ...c })),
})

/**
 * Create the undo/redo store
 * @returns {Object} Undo store with reactive state and actions
 */
function createUndoStore() {
  // Quản lý lịch sử Undo/Redo phân mảnh cho từng Map ID
  let histories = $state({})

  // Hàm định tuyến lấy đúng lịch sử của Map đang active
  function getActiveHistory() {
    const id = vsmDataStore.id;
    if (!id) return null;
    
    if (!histories[id]) {
      histories[id] = { undoStack: [], redoStack: [] };
    }
    return histories[id];
  }

  return {
    get canUndo() {
      const h = getActiveHistory();
      return h ? h.undoStack.length > 0 : false;
    },

    get canRedo() {
      const h = getActiveHistory();
      return h ? h.redoStack.length > 0 : false;
    },

    pushSnapshot(snapshot) {
      const h = getActiveHistory();
      if (!h) return;

      const cloned = cloneSnapshot(snapshot)
      const full = [...h.undoStack, cloned]
      h.undoStack = full.length > MAX_UNDO_DEPTH ? full.slice(1) : full
      h.redoStack = []
    },

    undo(currentState) {
      const h = getActiveHistory();
      if (!h || h.undoStack.length === 0) return null;

      const snapshot = h.undoStack[h.undoStack.length - 1]
      h.undoStack = h.undoStack.slice(0, -1)
      h.redoStack = [...h.redoStack, cloneSnapshot(currentState)]

      return cloneSnapshot(snapshot)
    },

    redo(currentState) {
      const h = getActiveHistory();
      if (!h || h.redoStack.length === 0) return null;

      const snapshot = h.redoStack[h.redoStack.length - 1]
      h.redoStack = h.redoStack.slice(0, -1)
      h.undoStack = [...h.undoStack, cloneSnapshot(currentState)]

      return cloneSnapshot(snapshot)
    },

    clear() {
      const h = getActiveHistory();
      if (h) {
        h.undoStack = []
        h.redoStack = []
      }
    },
  }
}

export const undoStore = createUndoStore()