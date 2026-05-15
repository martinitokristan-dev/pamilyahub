import { defineStore } from "pinia";
import { ref } from "vue";
import { fileService } from "@/services/fileService.js";
import { useDashboardStore } from "./dashboard.js";
import { useToast } from "@/composables/useToast.js";

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
    per_page: 20,
    total: 0,
    last_page: 1,
  });
  const lastPage = ref(1);

  function isCacheValid() {
    if (!cacheTime.value) return false;
    return Date.now() - cacheTime.value < CACHE_TTL;
  }

  async function fetchAll(force = false, page = 1, perPage = 20) {
    if (fetched.value && !force && isCacheValid() && page === lastPage.value) return;
    // Only show spinner on initial load — page changes swap data silently
    const isInitialLoad = files.value.length === 0 && !fetched.value;
    if (isInitialLoad || force) {
      loading.value = true;
    }
    lastPage.value = page;
    try {
      const res = await fileService.getAll(page, perPage);

      // Check if response has pagination data
      if (res.data.data && res.data.data.data) {
        // Paginated response
        files.value = res.data.data.data;
        pagination.value = {
          page: res.data.data.page,
          per_page: res.data.data.per_page,
          total: res.data.data.total,
          last_page: res.data.data.last_page,
        };
      } else {
        // Non-paginated response (backwards compatibility)
        files.value = res.data.data;
        pagination.value = {
          page: 1,
          per_page: files.value.length,
          total: files.value.length,
          last_page: 1,
        };
      }
      fetched.value = true;
      cacheTime.value = Date.now();
    } catch (e) {
      error.value = e.response?.data?.message ?? "Failed to load files";
    } finally {
      loading.value = false;
    }
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
