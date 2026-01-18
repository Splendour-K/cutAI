import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { VisualStyle } from '@/types/animation';

export interface BrandPreset {
  id: string;
  name: string;
  description: string;
  style: VisualStyle;
  createdAt: Date;
  isDefault: boolean;
}

const STORAGE_KEY = 'lovable_brand_presets';

export function useBrandPresets() {
  const [presets, setPresets] = useState<BrandPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPresets(parsed.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt)
        })));
      }
    } catch (error) {
      console.error('Failed to load brand presets:', error);
    }
    setIsLoading(false);
  }, []);

  // Save presets to localStorage whenever they change
  const saveToStorage = useCallback((newPresets: BrandPreset[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPresets));
    } catch (error) {
      console.error('Failed to save brand presets:', error);
    }
  }, []);

  const createPreset = useCallback((name: string, description: string, style: VisualStyle): BrandPreset => {
    const newPreset: BrandPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      style: { ...style, id: `custom_${Date.now()}` },
      createdAt: new Date(),
      isDefault: presets.length === 0, // First preset is default
    };

    const updated = [...presets, newPreset];
    setPresets(updated);
    saveToStorage(updated);
    toast.success(`Brand preset "${name}" saved!`);
    return newPreset;
  }, [presets, saveToStorage]);

  const updatePreset = useCallback((presetId: string, updates: Partial<Omit<BrandPreset, 'id' | 'createdAt'>>) => {
    const updated = presets.map(p => 
      p.id === presetId ? { ...p, ...updates } : p
    );
    setPresets(updated);
    saveToStorage(updated);
    toast.success('Brand preset updated');
  }, [presets, saveToStorage]);

  const deletePreset = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    const updated = presets.filter(p => p.id !== presetId);
    
    // If deleted preset was default, make first remaining preset default
    if (preset?.isDefault && updated.length > 0) {
      updated[0].isDefault = true;
    }
    
    setPresets(updated);
    saveToStorage(updated);
    toast.success('Brand preset deleted');
  }, [presets, saveToStorage]);

  const setDefaultPreset = useCallback((presetId: string) => {
    const updated = presets.map(p => ({
      ...p,
      isDefault: p.id === presetId
    }));
    setPresets(updated);
    saveToStorage(updated);
    toast.success('Default preset updated');
  }, [presets, saveToStorage]);

  const getDefaultPreset = useCallback((): BrandPreset | undefined => {
    return presets.find(p => p.isDefault);
  }, [presets]);

  const duplicatePreset = useCallback((presetId: string) => {
    const original = presets.find(p => p.id === presetId);
    if (!original) return;

    const newPreset: BrandPreset = {
      ...original,
      id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${original.name} (Copy)`,
      createdAt: new Date(),
      isDefault: false,
    };

    const updated = [...presets, newPreset];
    setPresets(updated);
    saveToStorage(updated);
    toast.success(`Duplicated "${original.name}"`);
    return newPreset;
  }, [presets, saveToStorage]);

  return {
    presets,
    isLoading,
    createPreset,
    updatePreset,
    deletePreset,
    setDefaultPreset,
    getDefaultPreset,
    duplicatePreset,
  };
}
