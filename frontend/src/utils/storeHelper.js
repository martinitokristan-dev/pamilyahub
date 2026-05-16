/**
 * Helper to handle "Silent Refresh" (Stale-While-Revalidate) pattern in Pinia stores.
 * Now includes a Promise-locking mechanism to prevent duplicate simultaneous calls.
 */

const inFlight = {}

export async function performSilentFetch({
  loading,
  fetched,
  cacheTime,
  currentData,
  fetchFn,
  force = false,
  backgroundTtl = 30000, // 30 seconds
  cacheKey = 'default'
}) {
  const hasData = Array.isArray(currentData) ? currentData.length > 0 : !!currentData;
  const isStale = Date.now() - (cacheTime?.value || 0) > backgroundTtl;

  // 1. If we have fresh data and not forcing, don't do anything
  if (fetched?.value && !force && !isStale) return;

  // 2. If a request for this key is already in progress, wait for it
  if (inFlight[cacheKey]) {
    return inFlight[cacheKey];
  }

  // 3. Only show the visible loading spinner if we have NO data or if it's a forced refresh
  if (!hasData || force) {
    if (loading) loading.value = true;
  }

  // 4. Create the Promise and store it in the in-flight map
  inFlight[cacheKey] = (async () => {
    try {
      await fetchFn();
      
      if (fetched) fetched.value = true;
      if (cacheTime) cacheTime.value = Date.now();
    } finally {
      // Cleanup: remove from in-flight map once finished
      delete inFlight[cacheKey];
      if (loading) loading.value = false;
    }
  })();

  return inFlight[cacheKey];
}
