import { useState, useEffect, useCallback } from 'react';

export interface PhotoPair {
  id: string;
  before?: {
    fileUrl: string;
    preview: string;
    notes: string;
    fileName: string;
  };
  after?: {
    fileUrl: string;
    preview: string;
    notes: string;
    fileName: string;
  };
}

export interface ContractorFormData {
  selectedCustomer: string;
  selectedLocation: string;
  manualLocationEntry: string;
  contractorName: string;
  reportDate: string;
  arrivalTime: string;
  workDescription: string;
  internalNotes: string;
  carpetRating: number;
  hardfloorRating: number;
  flooringState: string;
  swmsCompleted: boolean;
  testTagCompleted: boolean;
  equipmentGoodOrder: boolean;
  problemAreas: boolean;
  problemAreasDescription: string;
  methodsAttempted: string;
  incident: boolean;
  incidentDescription: string;
  signatureData: string;
  signatureName: string;
}

export interface UseContractorDraftReturn {
  formData: ContractorFormData;
  setFormData: React.Dispatch<React.SetStateAction<ContractorFormData>>;
  updateFormField: <K extends keyof ContractorFormData>(key: K, value: ContractorFormData[K]) => void;
  photoPairs: PhotoPair[];
  setPhotoPairs: React.Dispatch<React.SetStateAction<PhotoPair[]>>;
  lastSaved: Date | null;
  clearDraft: () => void;
  hasDraft: boolean;
}

const defaultFormData: ContractorFormData = {
  selectedCustomer: '',
  selectedLocation: '',
  manualLocationEntry: '',
  contractorName: '',
  reportDate: new Date().toISOString().split('T')[0],
  arrivalTime: '',
  workDescription: '',
  internalNotes: '',
  carpetRating: 3,
  hardfloorRating: 3,
  flooringState: '',
  swmsCompleted: false,
  testTagCompleted: false,
  equipmentGoodOrder: true,
  problemAreas: false,
  problemAreasDescription: '',
  methodsAttempted: '',
  incident: false,
  incidentDescription: '',
  signatureData: '',
  signatureName: '',
};

export function useContractorFieldReportDraft(token: string, contactName?: string): UseContractorDraftReturn {
  const storageKey = `contractor-field-report-draft-${token}`;
  
  const [formData, setFormData] = useState<ContractorFormData>(() => ({
    ...defaultFormData,
    contractorName: contactName || '',
  }));
  const [photoPairs, setPhotoPairs] = useState<PhotoPair[]>([{ id: crypto.randomUUID() }]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData) {
          setFormData(prev => ({
            ...prev,
            ...parsed.formData,
            // Keep contactName if provided and draft doesn't have it
            contractorName: parsed.formData.contractorName || contactName || prev.contractorName,
          }));
        }
        if (parsed.photoPairs && parsed.photoPairs.length > 0) {
          setPhotoPairs(parsed.photoPairs);
        }
        if (parsed.savedAt) {
          setLastSaved(new Date(parsed.savedAt));
        }
        setHasDraft(true);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    }
    setInitialized(true);
  }, [storageKey, contactName]);

  // Auto-save to localStorage with debounce
  useEffect(() => {
    if (!initialized) return;
    
    const timeoutId = setTimeout(() => {
      const savedAt = new Date().toISOString();
      const draftData = {
        formData,
        photoPairs,
        savedAt,
      };
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(draftData));
        setLastSaved(new Date(savedAt));
        setHasDraft(true);
      } catch (error) {
        console.error('Error saving draft:', error);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [formData, photoPairs, storageKey, initialized]);

  const updateFormField = useCallback(<K extends keyof ContractorFormData>(
    key: K,
    value: ContractorFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setFormData({
        ...defaultFormData,
        contractorName: contactName || '',
      });
      setPhotoPairs([{ id: crypto.randomUUID() }]);
      setLastSaved(null);
      setHasDraft(false);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [storageKey, contactName]);

  return {
    formData,
    setFormData,
    updateFormField,
    photoPairs,
    setPhotoPairs,
    lastSaved,
    clearDraft,
    hasDraft,
  };
}
