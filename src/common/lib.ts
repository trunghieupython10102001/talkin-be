export function cloneObject(data, defaultValue = {}) {
  if (typeof data === 'undefined') return defaultValue;

  return JSON.parse(JSON.stringify(data));
}

export function exclude<O, Key extends keyof O>(
  obj: O,
  keys: Key[],
): Omit<O, Key> {
  for (const key of keys) {
    delete obj[key];
  }
  return obj;
}
