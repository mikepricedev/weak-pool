import { WeakPool, UnknownObject } from "../WeakPool";

export function acquireN<Obj extends UnknownObject>(
  num: number,
  pool: WeakPool<Obj>
): Obj[] {
  const objs: Obj[] = [];

  for (let i = 0; i < num; i++) {
    objs.push(pool.acquire());
  }
  return objs;
}

export function releaseAll<Obj extends UnknownObject>(
  objs: Obj[],
  pool: WeakPool<Obj>
) {
  objs.forEach((o) => pool.release(o));
}
