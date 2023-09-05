import { it, describe, beforeEach } from "vitest";

import { WeakPool } from "../WeakPool";
import { acquireN, releaseAll } from "./utils";

describe("WeakPool", () => {
  let pool: WeakPool<unknown[]>;

  beforeEach(() => {
    pool = new WeakPool<unknown[]>(
      () => [],
      (obj) => {
        obj.length = 0;
      }
    );
  });

  it("Tracks active objects.", ({ expect }) => {
    expect(pool.numActiveObjects).toBe(0);

    const obj = pool.acquire();

    expect(pool.numActiveObjects).toBe(1);

    pool.release(obj);

    expect(pool.numActiveObjects).toBe(0);
  });

  it("Tracks objects in strong pool.", ({ expect }) => {
    expect(pool.numStrongPooledRefs).toBe(0);

    pool.release(pool.acquire());

    expect(pool.numStrongPooledRefs).toBe(1);
  });

  it("Tracks objects in weak pool.", ({ expect }) => {
    expect(pool.numWeakPooledRefs).toBe(0);

    // acquire and release enough objects to overflow the strong pool
    releaseAll(acquireN(pool.curMaxStrongPoolSize + 1, pool), pool);

    expect(pool.numWeakPooledRefs).toBe(1);

    // acquire enough objects to move all weak pool objects to the strong pool
    pool.acquire();

    expect(pool.numWeakPooledRefs).toBe(0);
  });

  it("Schedules strong pool scaling at the end of the event loop.", async ({
    expect,
  }) => {
    const { curMaxStrongPoolSize } = pool;

    // acquire enough objects to grow max strong pool size and release 1
    pool.release(acquireN(100 + curMaxStrongPoolSize, pool)[0]);

    // check that the release scheduled, but did NOT run the size change
    expect(curMaxStrongPoolSize).toBe(pool.curMaxStrongPoolSize);

    // wait until the end of the event loop
    await new Promise((resolve) => setTimeout(resolve));

    // check that the size has changed
    expect(curMaxStrongPoolSize).lessThan(pool.curMaxStrongPoolSize);
  });

  it("Grows the strong pool dynamically.", async ({ expect }) => {
    // acquire enough objects to grow max strong pool size
    const objs = acquireN(100, pool);

    // release enough objects to overflow into the weak pool
    releaseAll(objs.splice(0, pool.curMaxStrongPoolSize + 1), pool);

    // Cache the current strong and weak pool sizes
    const { numStrongPooledRefs, numWeakPooledRefs } = pool;

    // wait until the scheduled scaling has run
    await new Promise((resolve) => setTimeout(resolve));

    // check that the strong pool grew
    expect(pool.numStrongPooledRefs).toBeGreaterThan(numStrongPooledRefs);

    // check that the weak pool shrank
    expect(pool.numWeakPooledRefs).toBeLessThan(numWeakPooledRefs);
  });

  it("Shrinks the strong pool dynamically", async ({ expect }) => {
    // acquire enough objects to grow max strong pool size
    const objs = acquireN(100, pool);

    // release one object to schedule scaling
    pool.release(objs.pop()!);

    // wait until the scheduled scaling has run
    await new Promise((resolve) => setTimeout(resolve));

    // release enough objects to fill the strong pool
    releaseAll(
      objs.splice(0, pool.curMaxStrongPoolSize - pool.numStrongPooledRefs),
      pool
    );

    // Cache the current strong and weak pool sizes
    const { numStrongPooledRefs, numWeakPooledRefs } = pool;

    // release enough objects to trigger shrinking
    releaseAll(objs.splice(0, pool.numActiveObjects - 1), pool);

    // wait until the scheduled scaling has run
    await new Promise((resolve) => setTimeout(resolve));

    // check that the strong pool shrank
    expect(pool.numStrongPooledRefs).toBeLessThan(numStrongPooledRefs);

    // check that the weak pool grew
    expect(pool.numWeakPooledRefs).toBeGreaterThan(numWeakPooledRefs);
  });
});
