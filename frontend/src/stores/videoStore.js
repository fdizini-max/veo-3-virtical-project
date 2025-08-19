import { create } from 'zustand';

export const useVideoStore = create((set, get) => ({
  currentJob: null,
  isGenerating: false,
  previewMode: 'vertical',

  startGeneration: (jobData) => set({
    currentJob: jobData,
    isGenerating: true,
  }),

  updateJob: (updates) => set((state) => ({
    currentJob: state.currentJob ? { ...state.currentJob, ...updates } : updates,
  })),

  finishGeneration: () => set({ isGenerating: false }),

  togglePreviewMode: () => set((state) => ({
    previewMode: state.previewMode === 'vertical' ? 'horizontal' : 'vertical',
  })),
}));


