import { getWeakRef } from "weak-ref-cache";
import { defaultPoolScalingAlgo } from "./defaultPoolScalingAlgo";

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
    return this.#numActiveObjects;
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

  static readonly #registeredWeakRefs = new WeakSet<WeakRef<UnknownObject>>();

  readonly #weakPool = new Set<WeakRef<Obj>>();

  readonly #strongPool: Obj[] = [];

  #numActiveObjects: number = 0;

  #poolSizeUpdateScheduled: boolean = false;

  #numGC: number = 0;

  readonly #updatePoolSize = () => {
    this.#maxStrongPoolSize = this.#poolScalingAlgorithm(
      this.numActiveObjects,
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
    this.#weakPool.delete(weakObj);

    if (this.#numGC === Number.MAX_SAFE_INTEGER) {
      return;
    }

    this.#numGC++;
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
    this.#numActiveObjects++;

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

      return obj;
    }

    return this.#create();
  }

  /**
   * Release an object to the pool.
   */
  release(obj: Obj): void {
    this.#numActiveObjects = Math.max(this.#numActiveObjects - 1, 0);

    this.#reset(obj);

    if (this.#strongPool.length < this.#maxStrongPoolSize) {
      this.#strongPool.push(obj);
    } else {
      const weakObj = getWeakRef(obj);

      this.#weakPool.add(weakObj);

      if (!WeakPool.#registeredWeakRefs.has(weakObj)) {
        this.#objFinalizer.register(obj, weakObj);

        WeakPool.#registeredWeakRefs.add(weakObj);
      }
    }

    if (this.#poolSizeUpdateScheduled) {
      return;
    }

    this.#poolSizeUpdateScheduled = true;

    setTimeout(this.#updatePoolSize, 0);
  }
}

export default WeakPool;

export type UnknownObject = {};
