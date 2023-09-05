import { it, describe } from "vitest";

import {
  defaultPoolScalingAlgo,
  DEFAULT_MAX_STRONG_POOL_SIZE,
  POOL_SCALING_FACTOR,
  MIN_POOL_TO_ACTIVE_RATIO,
  MAX_POOL_TO_ACTIVE_RATIO,
} from "../defaultPoolScalingAlgo";

describe("defaultPoolScalingAlgo", () => {
  // unused default tail args
  const tailArgs = [0, 0, 0] as const;

  it(`Should return ${DEFAULT_MAX_STRONG_POOL_SIZE} when active is 0`, ({
    expect,
  }) => {
    expect(defaultPoolScalingAlgo(0, 0, ...tailArgs)).toEqual(
      DEFAULT_MAX_STRONG_POOL_SIZE
    );
  });

  it(`Should NOT return less than ${DEFAULT_MAX_STRONG_POOL_SIZE}.`, ({
    expect,
  }) => {
    expect(defaultPoolScalingAlgo(1, 5, ...tailArgs)).toEqual(
      DEFAULT_MAX_STRONG_POOL_SIZE
    );
  });

  it(`Should return ${POOL_SCALING_FACTOR} of num active when pool/active ratio is less than ${MIN_POOL_TO_ACTIVE_RATIO}`, ({
    expect,
  }) => {
    expect(defaultPoolScalingAlgo(100, 9, ...tailArgs)).toEqual(
      100 * POOL_SCALING_FACTOR
    );
  });

  it(`Should return ${POOL_SCALING_FACTOR} of num active when pool/active ratio is greater than ${MAX_POOL_TO_ACTIVE_RATIO}`, ({
    expect,
  }) => {
    expect(defaultPoolScalingAlgo(100, 51, ...tailArgs)).toEqual(
      100 * POOL_SCALING_FACTOR
    );
  });

  it(`Should return 2nd param when ${MIN_POOL_TO_ACTIVE_RATIO} < pool/active < ${MAX_POOL_TO_ACTIVE_RATIO}`, ({
    expect,
  }) => {
    const numActiveObjects = 100;

    // increase the ratio from 1/100 until it reaches 0.6
    for (
      let maxStrongPoolSize = 1,
        poolActiveRatio = maxStrongPoolSize / numActiveObjects;
      poolActiveRatio < 0.6;
      poolActiveRatio = ++maxStrongPoolSize / numActiveObjects
    ) {
      if (
        poolActiveRatio < MIN_POOL_TO_ACTIVE_RATIO ||
        poolActiveRatio > MAX_POOL_TO_ACTIVE_RATIO
      ) {
        // check the algorithm is updating the maxStrongPoolSize
        expect(
          defaultPoolScalingAlgo(
            numActiveObjects,
            maxStrongPoolSize,
            ...tailArgs
          )
        ).not.toEqual(maxStrongPoolSize);
      } else {
        // check the algorithm is returning the same maxStrongPoolSize
        expect(
          defaultPoolScalingAlgo(
            numActiveObjects,
            maxStrongPoolSize,
            ...tailArgs
          )
        ).toEqual(maxStrongPoolSize);
      }
    }
  });
});
