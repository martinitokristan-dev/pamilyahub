/**
 * Helper to handle "Silent Refresh" (Stale-While-Revalidate) pattern in Pinia stores.
 * 
 * @param {Object} options
 * @param {Ref} options.loading - Pinia loading ref
 * @param {Ref} options.fetched - Pinia fetched ref
 * @param {Ref} options.cacheTime - Pinia cacheTime ref
 * @param {Array|Object} options.currentData - Current data in the store
 * @param {Function} options.fetchFn - The actual API call function
 * @param {Boolean} options.force - Force a hard refresh with loading spinner
 * @param {Number} options.backgroundTtl - How long before we check the server again (default 30s)
 */
export async function performSilentFetch({
  loading,
  fetched,
  cacheTime,
  currentData,
  fetchFn,
  force = false,
  backgroundTtl = 30000 // 30 seconds
}) {
  const hasData = Array.isArray(currentData) ? currentData.length > 0 : !!currentData;
  const isStale = Date.now() - (cacheTime?.value || 0) > backgroundTtl;

  // 1. If we have fresh data and not forcing, don't do anything
  if (fetched.value && !force && !isStale) return;

  // 2. Only show the visible loading spinner if we have NO data or if it's a forced refresh
  if (!hasData || force) {
    loading.value = true;
  }

  try {
    // 3. Execute the fetch (silent in the background if we already have data)
    await fetchFn();
    
    // 4. Update tracking refs
    if (fetched) fetched.value = true;
    if (cacheTime) cacheTime.value = Date.now();
  } finally {
    // 5. Always turn off loading
    loading.value = false;
  }
}
