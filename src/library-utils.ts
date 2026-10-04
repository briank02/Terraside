export const joinPath = (parentPath: string, name: string) => {
  const separator = parentPath.endsWith('\\') || parentPath.endsWith('/')
    ? ''
    : (parentPath.includes('\\') ? '\\' : '/')
  return parentPath + separator + name
}

// A stable pseudo-random rank keeps Random view fixed until a new seed is chosen.
export const getRandomRank = (value: string, seed: number) => {
  let hash = (2166136261 ^ seed) >>> 0
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 0x7feb352d)
  hash ^= hash >>> 15
  hash = Math.imul(hash, 0x846ca68b)
  return (hash ^ (hash >>> 16)) >>> 0
}
