import { useState, useCallback } from 'react';
import { Camera, CameraResultType, CameraSource, Photo, GalleryPhoto } from '@capacitor/camera';
import { isNativeApp, isPluginAvailable } from '@/lib/capacitor';

interface CameraOptions {
  quality?: number;
  allowEditing?: boolean;
  resultType?: CameraResultType;
  source?: CameraSource;
  width?: number;
  height?: number;
}

interface UseCameraResult {
  takePhoto: (options?: CameraOptions) => Promise<Photo | null>;
  pickFromGallery: (options?: CameraOptions) => Promise<Photo | null>;
  pickMultiple: () => Promise<GalleryPhoto[]>;
  isNative: boolean;
  isAvailable: boolean;
  error: string | null;
}

export const useNativeCamera = (): UseCameraResult => {
  const [error, setError] = useState<string | null>(null);
  const isNative = isNativeApp();
  const isAvailable = isPluginAvailable('Camera');

  const takePhoto = useCallback(async (options?: CameraOptions): Promise<Photo | null> => {
    setError(null);
    
    if (!isNative || !isAvailable) {
      // Fall back to web file input - caller should handle this
      setError('Native camera not available, use web fallback');
      return null;
    }

    try {
      const photo = await Camera.getPhoto({
        quality: options?.quality ?? 90,
        allowEditing: options?.allowEditing ?? false,
        resultType: options?.resultType ?? CameraResultType.Uri,
        source: CameraSource.Camera,
        width: options?.width ?? 1920,
        height: options?.height ?? 1920,
        correctOrientation: true,
      });
      return photo;
    } catch (err: any) {
      if (err.message !== 'User cancelled photos app') {
        setError(err.message || 'Failed to take photo');
        console.error('Camera error:', err);
      }
      return null;
    }
  }, [isNative, isAvailable]);

  const pickFromGallery = useCallback(async (options?: CameraOptions): Promise<Photo | null> => {
    setError(null);
    
    if (!isNative || !isAvailable) {
      setError('Native camera not available, use web fallback');
      return null;
    }

    try {
      const photo = await Camera.getPhoto({
        quality: options?.quality ?? 90,
        allowEditing: options?.allowEditing ?? false,
        resultType: options?.resultType ?? CameraResultType.Uri,
        source: CameraSource.Photos,
        width: options?.width ?? 1920,
        height: options?.height ?? 1920,
        correctOrientation: true,
      });
      return photo;
    } catch (err: any) {
      if (err.message !== 'User cancelled photos app') {
        setError(err.message || 'Failed to pick photo');
        console.error('Gallery error:', err);
      }
      return null;
    }
  }, [isNative, isAvailable]);

  const pickMultiple = useCallback(async (): Promise<GalleryPhoto[]> => {
    setError(null);
    
    if (!isNative || !isAvailable) {
      setError('Native camera not available, use web fallback');
      return [];
    }

    try {
      const result = await Camera.pickImages({
        quality: 90,
        width: 1920,
        height: 1920,
        correctOrientation: true,
      });
      return result.photos;
    } catch (err: any) {
      if (err.message !== 'User cancelled photos app') {
        setError(err.message || 'Failed to pick photos');
        console.error('Multi-pick error:', err);
      }
      return [];
    }
  }, [isNative, isAvailable]);

  return {
    takePhoto,
    pickFromGallery,
    pickMultiple,
    isNative,
    isAvailable: isNative && isAvailable,
    error,
  };
};

/**
 * Convert a Capacitor Photo to a File object for upload
 */
export const photoToFile = async (photo: Photo, filename?: string): Promise<File | null> => {
  try {
    if (photo.webPath) {
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const name = filename || `photo_${Date.now()}.${photo.format || 'jpeg'}`;
      return new File([blob], name, { type: `image/${photo.format || 'jpeg'}` });
    }
    return null;
  } catch (err) {
    console.error('Failed to convert photo to file:', err);
    return null;
  }
};
