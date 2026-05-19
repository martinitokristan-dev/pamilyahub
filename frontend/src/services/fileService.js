import api from "@/lib/axios.js";

export const fileService = {
  getAll: (page = 1, perPage = 10) =>
    api.get("/files", { params: { page, per_page: perPage } }),
  upload: (formData, onProgress) =>
    api.post("/files", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total,
          );
          onProgress(percentCompleted);
        }
      },
    }),
  delete: (id) => api.delete(`/files/${id}`),
};
