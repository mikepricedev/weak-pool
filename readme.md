# `WeakPool`

## Introduction

The `WeakPool` provides a mechanism to efficiently manage pooled objects using both strong and weak referencing techniques. This helps optimize memory management and reduce garbage collection overhead by reusing objects from a pool instead of instantiating new ones.

## Installation

```bash
npm i weak-pool
```

## Features

- **Object Pooling**: Facilitates reusing objects to prevent frequent and performance degrading garbage collection.
- **Dynamic Scaling**: Adjusts the pool size based on usage patterns.
- **Scaling Algorithms**: Offers flexibility to define custom scaling algorithms.

## How to Use

### Importing

```ts
import WeakPool, { Create, Reset } from "weak-pool";
```

### Basic Usage

1. **Creating a Pool**: Define how objects are created and reset, then instantiate the pool.

```ts
interface MyObj {
  myProp: string;
}

const create: Create<MyObj> = () => ({ myProp: "defaultValue" });

const reset: Reset<MyObj> = (obj) => {
  obj.myProp = "defaultValue";
};

const pool = new WeakPool(create, reset);
```

2. **Acquiring an Object**: Retrieve an object from the pool or get a new one if the pool is empty.

```ts
const obj = pool.acquire();
```

3. **Releasing an Object**: Release an object back into the pool.

```ts
pool.release(obj);
```

### Properties

You can use various properties to get insights about the pool:

- `numActiveObjects`: Number of objects currently in use.
- `curMaxStrongPoolSize`: Maximum size of the strongly referenced object pool.
- `numStrongPooledRefs`: Number of objects in the strongly referenced pool.
- `numWeakPooledRefs`: Number of objects in the weakly referenced pool.
- `numGC`: Number of weakly referenced objects that have been garbage collected since the last strong pool size update.
- `numActiveGC`: Number of active objects that have been collected over the lifetime of the pool. Should be `0`.

### Advanced

#### How Scaling Works

The scaling algorithm determines the maximum size of the strong pool. The `WeakPool` then migrates objects to or from the weak reference pool as necessary to maintain the size limit of the strong pool.

Pool size updates are scheduled to occur asynchronously whenever an object is released back to the pool. Subsequent release calls before the update execution will not schedule additional updates.

#### Custom Scaling Algorithms

```ts
import { PoolScalingSignature } from "weak-pool";

// Define a scaling algorithm with the following signature
const myPoolScalingAlgo: PoolScalingSignature = (
  numActiveObjects,
  curMaxStrongPoolSize,
  numStrongPooledRefs,
  numWeakPooledRefs,
  numGC
) => {
  // Implement custom logic here
  return customSize;
};

// Add your algo to the pool constructor as a third argument
const pool = new WeakPool(create, reset, myPoolScalingAlgo);
```

### Utility Methods

These methods provide a mechanism to test and retrieve data about the state of an object within the `WeakPool`. They can be used to determine if an object is actively in use, stored in the strong reference pool, or in the weak reference pool.

- `isActive(obj: Obj): boolean`: Checks if the provided object is currently active and in use.

- `isStrongPooled(obj: Obj): boolean`: Determines if the provided object is currently in the strongly referenced object pool.

- `isWeakPooled(obj: Obj): boolean`: Determines if the provided object is currently in the weakly referenced object pool.

## ECMAScript Compatibility and Required Features

This WeakPool library relies on some advanced JavaScript features to optimize object pooling and memory management. Here are the key ECMAScript features the library utilizes:

### Private Class Members (ECMAScript 2022)

The library uses private class fields and methods to encapsulate data and internal behaviors within the `WeakPool` class, promoting better data protection and integrity.

### WeakRef and FinalizationRegistry (ECMAScript 2021)

The `WeakRef` and `FinalizationRegistry` classes are vital components in the library, enabling the efficient management of object lifecycles in the weak pool. These features were introduced in ECMAScript 2021, offering the ability to weakly reference objects and to register finalizer callbacks, facilitating better memory management and garbage collection optimizations.

### Browser and Node.js Compatibility

Given the use of these advanced features, the library is expected to be compatible with environments supporting ECMAScript 2021 and 2022. Users should ensure their target environments support these features.

## Contribution

This is an experimental pooling library built to play with the concept of using weak refs in pooling as a strategy for dynamic pool scaling and an interface to implement algorithms that can utilize information about the pool's composition and GC'd events to dynamically scale the pool over time.

I am by no means an expert in the nuanced areas of object pooling or garbage collection. The astute among you may see many pitfalls in this approach, but also opportunities. I would be immensely grateful for **all** advice and contributions to further enhance this project.

### Roadmap

1. **Validate the Concept**: Implement an initial suite of benchmarks to validate the core approach of utilizing weak refs for dynamic pool scaling.

2. **Algorithm Tools**: Expand and adapt initial benchmark suite to provide tooling for the development and testing of custom scaling algorithms.
