import { defineStore } from "pinia";
import { ref } from "vue";
import { fileService } from "@/services/fileService.js";
import { useDashboardStore } from "./dashboard.js";
import { useToast } from "@/composables/useToast.js";
import { cacheSingleSet, cacheSingleGet, isNetworkError } from "@/lib/offlineDb.js";
import { performSilentFetch } from "@/utils/storeHelper.js";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const useFilesStore = defineStore("files", () => {
  const files = ref([]);
  const loading = ref(false);
  const uploading = ref(false);
  const uploadProgress = ref(0);
  const error = ref(null);
  const fetched = ref(false);
  const cacheTime = ref(null);
  const pagination = ref({
    page: 1,
    per_page: 10,
    total: 0,
    last_page: 1,
  });
  const lastPage = ref(1);

  function isCacheValid() {
    if (!cacheTime.value) return false;
    return Date.now() - cacheTime.value < CACHE_TTL;
  }

  async function fetchAll(force = false, page = 1, perPage = 10) {
    const cacheKey = `files_page_${page}`
    lastPage.value = page

    return performSilentFetch({
      loading,
      fetched,
      cacheKey,
      backgroundTtl: 60000,
      force,
      fetchFn: async () => {
        // Hydrate from IndexedDB first for instant display
        if (!files.value.length) {
          try {
            const cached = await cacheSingleGet('files')
            if (cached?.files) {
              files.value = cached.files
              if (cached.pagination) pagination.value = cached.pagination
            }
          } catch { /* ignore */ }
        }

        // Offline: stop here if we have cached data
        if (!navigator.onLine) return

        try {
          const res = await fileService.getAll(page, perPage)

          if (res.data.data && res.data.data.data) {
            files.value = res.data.data.data
            pagination.value = {
              page: res.data.data.page,
              per_page: res.data.data.per_page,
              total: res.data.data.total,
              last_page: res.data.data.last_page,
            }
          } else {
            files.value = res.data.data
            pagination.value = {
              page: 1,
              per_page: files.value.length,
              total: files.value.length,
              last_page: 1,
            }
          }
          await cacheSingleSet('files', { files: files.value, pagination: pagination.value })
        } catch (e) {
          if (!isNetworkError(e)) {
            error.value = e.response?.data?.message ?? "Failed to load files"
          }
        }
      }
    })
  }

  async function loadMore(page) {
    try {
      const res = await fileService.getAll(page, pagination.value.per_page);
      if (res.data.data && res.data.data.data) {
        files.value.push(...res.data.data.data);
        pagination.value.page = page;
      }
    } catch (e) {
      error.value = e.response?.data?.message ?? "Failed to load more files";
    }
  }

  async function upload(formData) {
    if (!navigator.onLine) {
      useToast().error("File uploads require an internet connection.");
      return null;
    }
    uploading.value = true;
    uploadProgress.value = 0;
    error.value = null;
    try {
      const res = await fileService.upload(formData, (progress) => {
        uploadProgress.value = progress;
      });
      files.value.unshift(res.data.data);
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("File uploaded successfully");
      return res.data.data;
    } catch (e) {
      error.value = e.response?.data?.message ?? "Failed to upload file";
      useToast().error(error.value);
      throw e;
    } finally {
      uploading.value = false;
      uploadProgress.value = 0;
    }
  }

  async function remove(id) {
    loading.value = true;
    try {
      await fileService.delete(id);
      files.value = files.value.filter((f) => f.id !== id);
      useDashboardStore().invalidate();
      invalidate();
      useToast().success("File deleted");
    } finally {
      loading.value = false;
    }
  }

  function invalidate() {
    fetched.value = false;
  }

  return {
    files,
    loading,
    uploading,
    uploadProgress,
    error,
    fetched,
    pagination,
    fetchAll,
    loadMore,
    upload,
    remove,
    invalidate,
  };
});
