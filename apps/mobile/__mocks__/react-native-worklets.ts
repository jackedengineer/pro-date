// Worklets need a native runtime. In tests, scheduled work runs straight away on the one thread.
type Fn<A extends unknown[]> = (...args: A) => unknown;

export const scheduleOnRN = <A extends unknown[]>(fn: Fn<A>, ...args: A) => void fn(...args);
export const scheduleOnUI = <A extends unknown[]>(fn: Fn<A>, ...args: A) => void fn(...args);
