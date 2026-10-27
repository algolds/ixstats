import { useRef } from "react";

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as Array<keyof T>;
  return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]));
}

/** `value`, or the previous object while every property is unchanged, so memoised children stay quiet. */
export function useShallowStable<T extends object>(value: T): T {
  const ref = useRef(value);
  if (!shallowEqual(ref.current, value)) ref.current = value;
  return ref.current;
}
