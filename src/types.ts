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
  website?: string;
  url?: string;
  annotation?: string;
  tags?: string[];
  folders?: string[];
  isDeleted?: boolean;
}
