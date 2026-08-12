/**
 * VSM Data Validator
 * Validates and sanitizes VSM data structures
 */

/**
 * Validate a single step structure
 * @param {*} step - Step to validate
 * @param {number} index - Step index for error messages
 * @param {Array} errors - Errors array to push into
 */
function validateStepStructure(step, index, errors) {
  if (!step || typeof step !== 'object') {
    errors.push(`Step ${index}: must be an object`)
    return
  }
  if (!step.id) errors.push(`Step ${index}: missing id`)
  if (!step.name) errors.push(`Step ${index}: missing name`)
  if (step.processTime !== undefined && typeof step.processTime !== 'number') {
    errors.push(`Step ${index}: processTime must be a number`)
  }
  if (step.leadTime !== undefined && typeof step.leadTime !== 'number') {
    errors.push(`Step ${index}: leadTime must be a number`)
  }
}

/**
 * Validate a single connection structure
 * @param {*} conn - Connection to validate
 * @param {number} index - Connection index for error messages
 * @param {Array} errors - Errors array to push into
 */
function validateConnectionStructure(conn, index, errors) {
  if (!conn || typeof conn !== 'object') {
    errors.push(`Connection ${index}: must be an object`)
    return
  }
  if (!conn.id) errors.push(`Connection ${index}: missing id`)
  if (!conn.source) errors.push(`Connection ${index}: missing source`)
  if (!conn.target) errors.push(`Connection ${index}: missing target`)
}

/**
 * Validate VSM data structure
 * @param {*} data - Data to validate
 * @returns {Object} Validation result with { valid, errors, data }
 */
export function validateVSMData(data) {
  const errors = []

  // Basic type checks
  if (!data || typeof data !== 'object') {
    errors.push('Data must be an object')
    return { valid: false, errors, data: null }
  }

  // Required fields
  if (!Object.prototype.hasOwnProperty.call(data, 'id')) {
    errors.push('Missing field: id')
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'name')) {
    errors.push('Missing field: name')
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'steps')) {
    errors.push('Missing field: steps')
  }
  if (!Object.prototype.hasOwnProperty.call(data, 'connections')) {
    errors.push('Missing field: connections')
  }

  // Type validation
  if (data.steps !== undefined && !Array.isArray(data.steps)) {
    errors.push('steps must be an array')
  }
  if (data.connections !== undefined && !Array.isArray(data.connections)) {
    errors.push('connections must be an array')
  }

  // Validate steps structure
  if (Array.isArray(data.steps)) {
    data.steps.forEach((step, index) => {
      validateStepStructure(step, index, errors)
    })
  }

  // Validate connections structure
  if (Array.isArray(data.connections)) {
    data.connections.forEach((conn, index) => {
      validateConnectionStructure(conn, index, errors)
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    data: errors.length === 0 ? data : null,
  }
}

/**
 * Sanitize a single step with safe defaults including position coordinates (MỚI THÊM)
 * @param {*} step 
 * @param {number} index 
 * @returns {Object}
 */
export function sanitizeStep(step, index = 0) {
  if (!step || typeof step !== 'object') {
    return {
      id: crypto.randomUUID(),
      name: `Step ${index + 1}`,
      type: 'custom',
      description: '',
      processTime: 60,
      leadTime: 240,
      percentCompleteAccurate: 100,
      queueSize: 0,
      batchSize: 1,
      peopleCount: 1,
      automated: true,
      position: { x: 50 + index * 250, y: 150 },
    }
  }

  const posX = typeof step.position?.x === 'number' && !isNaN(step.position.x)
    ? step.position.x
    : 50 + index * 250
  const posY = typeof step.position?.y === 'number' && !isNaN(step.position.y)
    ? step.position.y
    : 150

  return {
    id: step.id || crypto.randomUUID(),
    name: step.name || `Step ${index + 1}`,
    type: step.type || 'custom',
    description: step.description || '',
    processTime: typeof step.processTime === 'number' && !isNaN(step.processTime) ? step.processTime : 0,
    leadTime: typeof step.leadTime === 'number' && !isNaN(step.leadTime) ? step.leadTime : 0,
    percentCompleteAccurate: typeof step.percentCompleteAccurate === 'number' && !isNaN(step.percentCompleteAccurate) ? step.percentCompleteAccurate : 100,
    queueSize: typeof step.queueSize === 'number' && !isNaN(step.queueSize) ? step.queueSize : 0,
    batchSize: typeof step.batchSize === 'number' && !isNaN(step.batchSize) ? step.batchSize : 1,
    peopleCount: typeof step.peopleCount === 'number' && !isNaN(step.peopleCount) ? step.peopleCount : 1,
    automated: step.automated !== false,
    position: { x: posX, y: posY },
  }
}

/**
 * Sanitize and normalize VSM data with safe defaults
 * @param {*} data - Raw data to sanitize
 * @returns {Object} Sanitized VSM data
 */
export function sanitizeVSMData(data) {
  if (!data || typeof data !== 'object') {
    return {
      id: null,
      name: '',
      description: '',
      steps: [],
      connections: [],
      createdAt: null,
      updatedAt: null,
      readinessOverrides: {},
    }
  }

  const rawSteps = Array.isArray(data.steps) ? data.steps : []
  const sanitizedSteps = rawSteps.map((s, idx) => sanitizeStep(s, idx)) // MỚI CẬP NHẬT: Chuẩn hóa tọa độ x, y cho từng step

  return {
    id: data.id || null,
    name: data.name || '',
    description: data.description || '',
    steps: sanitizedSteps,
    connections: Array.isArray(data.connections) ? data.connections : [],
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    readinessOverrides:
      data.readinessOverrides && typeof data.readinessOverrides === 'object'
        ? data.readinessOverrides
        : {},
    dora:
      data.dora && typeof data.dora === 'object' && !Array.isArray(data.dora)
        ? data.dora
        : undefined,
    annotations: Array.isArray(data.annotations) ? data.annotations : undefined,
    baseline:
      data.baseline && typeof data.baseline === 'object' ? data.baseline : undefined,
  }
}