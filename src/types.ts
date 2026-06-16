export const EAGLE_BASE_URL = 'http://localhost:41595';

export interface EagleFolder {
  id: string;
  name: string;
  description?: string;
  children?: EagleFolder[];
}

export interface EagleItem {
  id: string;
  name?: string;
  ext?: string;
  website?: string;
  url?: string;
  annotation?: string;
  tags?: string[];
  folders?: string[];
  fileURL?: string;
  fileUrl?: string;
  filePath?: string;
  thumbnailURL?: string;
  thumbnailUrl?: string;
  thumbnailPath?: string;
  width?: number;
  height?: number;
  size?: number;
  isDeleted?: boolean;
}
