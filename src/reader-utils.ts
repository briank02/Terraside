export const parseSavedPage = (value: string | null) => {
  const page = Number(value)
  return Number.isSafeInteger(page) && page >= 1 ? page : 1
}
