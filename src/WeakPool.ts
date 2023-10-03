import { getWeakRef } from "weak-ref-cache";
import { defaultPoolScalingAlgo } from "./defaultPoolScalingAlgo.js";

/**
 * Creates a new object when the pool is empty.
 */
export interface Create<Obj extends UnknownObject = UnknownObject> {
  (): Obj;
}

/**
 * Resets an object to defaults before it is released back into the pool.
 */
export interface Reset<Obj extends UnknownObject = UnknownObject> {
  (obj: Obj): void;
}

/**
 * Call signature of the strong pool size algorithm.  Use to implement custom
 * scaling algorithms.
 */
export interface PoolScalingSignature {
  (
    numActiveObjects: number,
    curMaxStrongPoolSize: number,
    numStrongPooledRefs: number,
    numWeakPooledRefs: number,
    numGC: number
  ): number;
}

/**
 * The WeakPool class facilitates object pooling with both strong and weak
 * referencing mechanisms to optimize memory management and garbage collection.
 * The pool maintains a set of active (strongly referenced) and inactive
 * (weakly referenced) objects to reuse objects efficiently instead of creating
 * new ones, thus potentially reducing garbage collection overhead. The class
 * provides methods to acquire and release objects, dynamically adjusting the
 * pool size based on usage patterns.
 */
export class WeakPool<Obj extends UnknownObject> {
  /**
   * Number of allocated objects currently in-use.
   */
  get numActiveObjects(): number {
    return this.#activeObjects.size;
  }

  /**
   * Current maximum size of the strongly referenced object pool.
   */
  get curMaxStrongPoolSize(): number {
    return this.#maxStrongPoolSize;
  }

  /**
   * Number of objects currently in the strongly referenced object pool.
   */
  get numStrongPooledRefs(): number {
    return this.#strongPool.length;
  }

  /**
   * Number of objects currently in the weakly referenced object pool.
   */
  get numWeakPooledRefs(): number {
    return this.#weakPool.size;
  }

  /**
   * Number of weakly referenced objects that have been collected since the
   * last strong pool size update.
   */
  get numGC(): number {
    return this.#numGC;
  }

  /**
   * Number of active objects that have been collected over the lifetime of the
   * pool.  Should be `0`.
   */
  get numActiveGC(): number {
    return this.numActiveGC;
  }

  readonly #weakPool = new Set<WeakRef<Obj>>();

  readonly #strongPool: Obj[] = [];

  readonly #activeObjects = new Set<WeakRef<Obj>>();

  #poolSizeUpdateScheduled: boolean = false;

  #numGC: number = 0;

  #numActiveGC: number = 0;

  readonly #updatePoolSize = () => {
    this.#maxStrongPoolSize = this.#poolScalingAlgorithm(
      this.#activeObjects.size,
      this.#maxStrongPoolSize,
      this.#strongPool.length,
      this.#weakPool.size,
      this.#numGC
    );

    if (this.#maxStrongPoolSize < this.#strongPool.length) {
      do {
        this.#weakPool.add(getWeakRef(this.#strongPool.pop() as Obj));
      } while (this.#maxStrongPoolSize < this.#strongPool.length);
    } else if (
      this.#maxStrongPoolSize > this.#strongPool.length &&
      this.#weakPool.size > 0
    ) {
      for (const weakObj of this.#weakPool) {
        this.#weakPool.delete(weakObj);

        const obj = weakObj.deref();

        if (obj !== undefined) {
          if (this.#strongPool.push(obj) === this.#maxStrongPoolSize) {
            break;
          }
        }
      }
    }

    this.#numGC = 0;

    this.#poolSizeUpdateScheduled = false;
  };

  readonly #objFinalizer = new FinalizationRegistry<WeakRef<Obj>>((weakObj) => {
    if (this.#weakPool.delete(weakObj)) {
      if (this.#numGC === Number.MAX_SAFE_INTEGER) {
        return;
      }

      this.#numGC++;
    } else if (this.#activeObjects.delete(weakObj)) {
      if (this.#numActiveGC === Number.MAX_SAFE_INTEGER) {
        return;
      }

      this.#numActiveGC++;
    }
  });

  readonly #create: Create<Obj>;

  readonly #reset: Reset<Obj>;

  readonly #poolScalingAlgorithm: PoolScalingSignature;

  #maxStrongPoolSize: number;

  /**
   * @param poolScalingAlgorithm - Implement custom strong pool scaling
   * algorithm.
   */
  constructor(
    create: Create<Obj>,
    reset: Reset<Obj>,
    poolScalingAlgorithm?: PoolScalingSignature
  ) {
    this.#create = create;
    this.#reset = reset;
    this.#poolScalingAlgorithm = poolScalingAlgorithm || defaultPoolScalingAlgo;

    this.#maxStrongPoolSize = this.#poolScalingAlgorithm(0, 0, 0, 0, 0);
  }

  /**
   * Get an object from the pool.
   */
  acquire(): Obj {
    const obj = this.#strongPool.pop();

    if (obj !== undefined) {
      for (const weakObj of this.#weakPool) {
        this.#weakPool.delete(weakObj);

        const strongObj = weakObj.deref();

        if (strongObj !== undefined) {
          this.#strongPool.push(strongObj);

          break;
        }
      }

      this.#activeObjects.add(getWeakRef(obj));

      return obj;
    } else {
      const obj = this.#create();

      const weakObj = getWeakRef(obj);

      this.#objFinalizer.register(obj, weakObj);

      this.#activeObjects.add(weakObj);

      return obj;
    }
  }

  /**
   * Release an object to the pool.
   */
  release(obj: Obj): void {
    const weakObj = getWeakRef(obj);

    // Can release objects NOT ini from acquire method call.
    if (!this.#activeObjects.delete(weakObj)) {
      this.#objFinalizer.register(obj, weakObj);
    }

    this.#reset(obj);

    if (this.#strongPool.length < this.#maxStrongPoolSize) {
      this.#strongPool.push(obj);
    } else {
      this.#weakPool.add(weakObj);
    }

    if (this.#poolSizeUpdateScheduled) {
      return;
    }

    this.#poolSizeUpdateScheduled = true;

    setTimeout(this.#updatePoolSize, 0);
  }

  /**
   * Determine if an object is currently active i.e. has been acquired from
   * the pool.
   */
  isActive(obj: Obj): boolean {
    return this.#activeObjects.has(getWeakRef(obj));
  }

  /**
   * Determine if an object is currently in the strongly referenced object pool.
   */
  isStrongPooled(obj: Obj): boolean {
    return this.#strongPool.includes(obj);
  }

  /**
   * Determines if an object is currently in the weakly referenced object pool.
   */
  isWeakPooled(obj: Obj): boolean {
    return this.#weakPool.has(getWeakRef(obj));
  }
}

export default WeakPool;

export type UnknownObject = object;
