/* Test stand-in for next/cache: tagged caching only exists inside the Next.js runtime, so tests read data directly. */
export const cacheTag = () => {};
export const cacheLife = () => {};
export const revalidateTag = () => {};
export const revalidatePath = () => {};
export const updateTag = () => {};
