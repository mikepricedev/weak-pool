import { PoolScalingSignature } from "./WeakPool.js";

/**
 * @internal
 *
 * Default implementation of {@link PoolScalingSignature}.
 *
 */
export const defaultPoolScalingAlgo: PoolScalingSignature = function (
  numActiveObjects,
  curMaxStrongPoolSize
) {
  // Always true at ctor
  if (numActiveObjects === 0) {
    return DEFAULT_MAX_STRONG_POOL_SIZE;
  }

  const poolToActiveRatio = curMaxStrongPoolSize / numActiveObjects;

  if (
    poolToActiveRatio < MIN_POOL_TO_ACTIVE_RATIO ||
    poolToActiveRatio > MAX_POOL_TO_ACTIVE_RATIO
  ) {
    return Math.max(
      Math.ceil(numActiveObjects * POOL_SCALING_FACTOR),
      DEFAULT_MAX_STRONG_POOL_SIZE
    );
  }

  return Math.max(curMaxStrongPoolSize, DEFAULT_MAX_STRONG_POOL_SIZE);
};

/**
 * @internal
 */
export const DEFAULT_MAX_STRONG_POOL_SIZE = 5;

/**
 * @internal
 */
export const POOL_SCALING_FACTOR = 0.2;

/**
 * @internal
 */
export const MIN_POOL_TO_ACTIVE_RATIO = 0.1;

/**
 * @internal
 */
export const MAX_POOL_TO_ACTIVE_RATIO = 0.5;
