import { useState, useRef, useCallback } from "react";
import { Canvas as FabricCanvas } from "fabric";

interface HistoryState {
  json: string;
}

export const useFabricEditor = () => {
  const canvasRef = useRef<FabricCanvas | null>(null);
  const [activeObject, setActiveObject] = useState<any>(null);
  const historyRef = useRef<HistoryState[]>([]);
  const historyIndexRef = useRef(-1);

  const saveHistory = useCallback(() => {
    if (!canvasRef.current) return;
    
    const json = JSON.stringify(canvasRef.current.toJSON());
    
    // Remove any redo history
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    
    // Add new state
    historyRef.current.push({ json });
    historyIndexRef.current++;
    
    // Limit history to 50 states
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }
  }, []);

  const undo = useCallback(async () => {
    if (!canvasRef.current || historyIndexRef.current <= 0) return;
    
    historyIndexRef.current--;
    const state = historyRef.current[historyIndexRef.current];
    
    await canvasRef.current.loadFromJSON(JSON.parse(state.json));
    canvasRef.current.renderAll();
  }, []);

  const redo = useCallback(async () => {
    if (!canvasRef.current || historyIndexRef.current >= historyRef.current.length - 1) return;
    
    historyIndexRef.current++;
    const state = historyRef.current[historyIndexRef.current];
    
    await canvasRef.current.loadFromJSON(JSON.parse(state.json));
    canvasRef.current.renderAll();
  }, []);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const deleteSelected = useCallback(() => {
    if (!canvasRef.current) return;
    const activeObjects = canvasRef.current.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => canvasRef.current?.remove(obj));
      canvasRef.current.discardActiveObject();
      canvasRef.current.renderAll();
      saveHistory();
    }
  }, [saveHistory]);

  const duplicateSelected = useCallback(async () => {
    if (!canvasRef.current) return;
    const activeObject = canvasRef.current.getActiveObject();
    if (activeObject) {
      const cloned = await activeObject.clone();
      cloned.set({
        left: (cloned.left || 0) + 10,
        top: (cloned.top || 0) + 10,
      });
      canvasRef.current?.add(cloned);
      canvasRef.current?.setActiveObject(cloned);
      canvasRef.current?.renderAll();
      saveHistory();
    }
  }, [saveHistory]);

  const bringToFront = useCallback(() => {
    if (!canvasRef.current) return;
    const activeObject = canvasRef.current.getActiveObject();
    if (activeObject) {
      canvasRef.current.bringObjectToFront(activeObject);
      canvasRef.current.renderAll();
      saveHistory();
    }
  }, [saveHistory]);

  const sendToBack = useCallback(() => {
    if (!canvasRef.current) return;
    const activeObject = canvasRef.current.getActiveObject();
    if (activeObject) {
      canvasRef.current.sendObjectToBack(activeObject);
      canvasRef.current.renderAll();
      saveHistory();
    }
  }, [saveHistory]);

  const alignObjects = useCallback((alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!canvasRef.current) return;
    const activeObjects = canvasRef.current.getActiveObjects();
    if (activeObjects.length === 0) return;

    const canvasWidth = canvasRef.current.width || 595;
    const canvasHeight = canvasRef.current.height || 842;

    activeObjects.forEach(obj => {
      if (!obj.width || !obj.height) return;
      
      switch (alignment) {
        case 'left':
          obj.set({ left: 0 });
          break;
        case 'center':
          obj.set({ left: (canvasWidth - obj.width * (obj.scaleX || 1)) / 2 });
          break;
        case 'right':
          obj.set({ left: canvasWidth - obj.width * (obj.scaleX || 1) });
          break;
        case 'top':
          obj.set({ top: 0 });
          break;
        case 'middle':
          obj.set({ top: (canvasHeight - obj.height * (obj.scaleY || 1)) / 2 });
          break;
        case 'bottom':
          obj.set({ top: canvasHeight - obj.height * (obj.scaleY || 1) });
          break;
      }
      obj.setCoords();
    });

    canvasRef.current.renderAll();
    saveHistory();
  }, [saveHistory]);

  return {
    canvasRef,
    activeObject,
    setActiveObject,
    saveHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    deleteSelected,
    duplicateSelected,
    bringToFront,
    sendToBack,
    alignObjects,
  };
};
