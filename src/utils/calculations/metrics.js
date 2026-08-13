/**
 * VSM Metrics Calculations
 *
 * Pure functions for calculating value stream metrics.
 * All times are in minutes, percentages as 0-100.
 *
 * See: .claude/rules/vsm-domain.md#metric-calculations
 */

import {
  FLOW_EFFICIENCY_GOOD_THRESHOLD,
  FLOW_EFFICIENCY_WARNING_THRESHOLD,
  FIRST_PASS_YIELD_GOOD_THRESHOLD,
  FIRST_PASS_YIELD_WARNING_THRESHOLD,
  REWORK_MULTIPLIER_GOOD_THRESHOLD,
  REWORK_MULTIPLIER_WARNING_THRESHOLD,
  BOTTLENECK_QUEUE_THRESHOLD,
  BOTTLENECK_QUEUE_MULTIPLIER,
} from '../../data/thresholds.js'

// ==============================================================================
// BỘ LỌC THÔNG MINH (BỔ SUNG MỚI)
// ==============================================================================

/**
 * Lọc ra những block đang thực sự tham gia vào luồng
 * 1. Không phải là process con
 * 2. Phải có ít nhất 1 kết nối (tránh đếm các block trơ trọi)
 */
export function getActiveMainSteps(steps, connections) {
  if (!steps) return [];
  
  // 1. Luôn loại bỏ các process con dọc đã được nhận diện (isSubProcess)
  let active = steps.filter(s => !s.isSubProcess);
  
  // 2. CHỈ lọc dựa trên các kết nối NGANG
  if (Array.isArray(connections)) {
    const horizontalConns = connections.filter(c => c.type !== 'vertical');

    if (horizontalConns.length > 0) {
      const connectedIds = new Set();
      horizontalConns.forEach(c => {
        connectedIds.add(c.source);
        connectedIds.add(c.target);
      });
      // Giữ lại block nếu ID của nó nằm trong danh sách đang được nối NGANG
      active = active.filter(s => connectedIds.has(s.id));
    } else {
      // Nếu map CHƯA CÓ bất kỳ kết nối ngang nào, không đếm block nào vào tổng cả
      return [];
    }
  }
  
  return active;
}

// ==============================================================================
// TYPE DEFINITIONS
// ==============================================================================

// (Giữ nguyên các comment @typedef như của bạn)

// ==============================================================================
// PRIMARY API - Use these functions as entry points
// ==============================================================================

// Time constants
const MINUTES_PER_WORK_DAY = 480

export function calculateMetrics(steps = [], connections = []) {
  // Lấy ra danh sách các bước hợp lệ cho toàn bộ map
  const activeSteps = getActiveMainSteps(steps, connections);

  return {
    totalLeadTime: calculateTotalLeadTime(steps, connections),
    totalProcessTime: calculateTotalProcessTime(steps, connections),
    flowEfficiency: calculateFlowEfficiency(steps, connections),
    firstPassYield: calculateFirstPassYield(steps, connections),
    stepCount: activeSteps.length, // Đếm số block hợp lệ
    totalQueueSize: calculateTotalQueueSize(steps, connections),
    activityRatio: calculateActivityRatio(steps, connections),
    reworkImpact: calculateReworkImpact(steps, connections), // Giữ nguyên hàm này vì nó lấy baseLeadTime
    bottleneckIds: identifyBottlenecks(steps, connections),
  }
}

export function formatDuration(minutes) {
  if (minutes === 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  if (minutes < MINUTES_PER_WORK_DAY) {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  const days = Math.floor(minutes / MINUTES_PER_WORK_DAY)
  const remainingMinutes = minutes % MINUTES_PER_WORK_DAY
  const hours = Math.floor(remainingMinutes / 60)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

// ==============================================================================
// CALCULATION UTILITIES - Exported for testing and direct use
// ==============================================================================

const MAX_REWORK_RATE = 0.95

export function calculateTotalLeadTime(steps, connections) {
  const activeSteps = getActiveMainSteps(steps, connections);
  return activeSteps.reduce((sum, step) => sum + (step.leadTime || 0), 0)
}

export function calculateTotalProcessTime(steps, connections) {
  const activeSteps = getActiveMainSteps(steps, connections);
  return activeSteps.reduce((sum, step) => sum + (step.processTime || 0), 0)
}

export function calculateFlowEfficiency(steps, connections) {
  const processTime = calculateTotalProcessTime(steps, connections)
  const leadTime = calculateTotalLeadTime(steps, connections)

  if (leadTime === 0) {
    return {
      value: 0,
      percentage: 0,
      status: 'neutral',
      displayValue: 'N/A',
    }
  }

  const value = processTime / leadTime
  const percentage = value * 100

  let status
  if (percentage >= FLOW_EFFICIENCY_GOOD_THRESHOLD) {
    status = 'good'
  } else if (percentage >= FLOW_EFFICIENCY_WARNING_THRESHOLD) {
    status = 'warning'
  } else {
    status = 'critical'
  }

  return {
    value,
    percentage,
    status,
    displayValue: `${percentage.toFixed(1)}%`,
  }
}

export function calculateFirstPassYield(steps, connections) {
  const activeSteps = getActiveMainSteps(steps, connections);
  if (activeSteps.length === 0) {
    return {
      value: 0,
      percentage: 0,
      status: 'neutral',
      displayValue: 'N/A',
    }
  }

  const value = activeSteps.reduce(
    (product, step) => product * ((step.percentCompleteAccurate || 100) / 100),
    1
  )
  const percentage = value * 100

  let status
  if (percentage >= FIRST_PASS_YIELD_GOOD_THRESHOLD) {
    status = 'good'
  } else if (percentage >= FIRST_PASS_YIELD_WARNING_THRESHOLD) {
    status = 'warning'
  } else {
    status = 'critical'
  }

  return {
    value,
    percentage,
    status,
    displayValue: `${percentage.toFixed(1)}%`,
  }
}

export function calculateTotalQueueSize(steps, connections) {
  const activeSteps = getActiveMainSteps(steps, connections);
  return activeSteps.reduce((sum, step) => sum + (step.queueSize || 0), 0)
}

export function calculateActivityRatio(steps, connections) {
  const activeSteps = getActiveMainSteps(steps, connections);
  if (activeSteps.length === 0) {
    return {
      value: 0,
      displayValue: 'N/A',
    }
  }
  const avgProcessTime = calculateTotalProcessTime(steps, connections) / activeSteps.length
  return {
    value: avgProcessTime,
    displayValue: formatDuration(Math.round(avgProcessTime)),
  }
}

export function calculateReworkImpact(steps, connections) {
  const baseLeadTime = calculateTotalLeadTime(steps, connections)

  if (!connections || connections.length === 0) {
    return {
      effectiveLeadTime: baseLeadTime,
      reworkMultiplier: 1,
      totalReworkRate: 0,
      status: 'neutral',
      displayValue: formatDuration(baseLeadTime),
    }
  }

  const reworkConnections = connections.filter((c) => c.type === 'rework')
  if (reworkConnections.length === 0) {
    return {
      effectiveLeadTime: baseLeadTime,
      reworkMultiplier: 1,
      totalReworkRate: 0,
      status: 'neutral',
      displayValue: formatDuration(baseLeadTime),
    }
  }

  const totalReworkRate = Math.min(
    reworkConnections.reduce((sum, c) => sum + (c.reworkRate || 0) / 100, 0),
    MAX_REWORK_RATE
  )

  const reworkMultiplier = 1 / (1 - totalReworkRate)
  const effectiveLeadTime = Math.round(baseLeadTime * reworkMultiplier)

  let status
  if (reworkMultiplier <= REWORK_MULTIPLIER_GOOD_THRESHOLD) {
    status = 'good'
  } else if (reworkMultiplier <= REWORK_MULTIPLIER_WARNING_THRESHOLD) {
    status = 'warning'
  } else {
    status = 'critical'
  }

  return {
    effectiveLeadTime,
    reworkMultiplier: Number(reworkMultiplier.toFixed(2)),
    totalReworkRate: Number((totalReworkRate * 100).toFixed(1)),
    status,
    displayValue: formatDuration(effectiveLeadTime),
  }
}

export function identifyBottlenecks(steps, connections) {
  const activeSteps = getActiveMainSteps(steps, connections);
  if (activeSteps.length === 0) return []

  const stepsWithQueue = activeSteps.filter((s) => (s.queueSize || 0) > 0)
  if (stepsWithQueue.length === 0) return []

  const avgQueue = stepsWithQueue.reduce((sum, s) => sum + s.queueSize, 0) / stepsWithQueue.length
  const threshold = Math.max(avgQueue * BOTTLENECK_QUEUE_MULTIPLIER, BOTTLENECK_QUEUE_THRESHOLD)

  return activeSteps.filter((s) => (s.queueSize || 0) > threshold).map((s) => s.id)
}

export const calculateAllMetrics = calculateMetrics