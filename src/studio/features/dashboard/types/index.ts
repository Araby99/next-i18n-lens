export interface SelectedElement {
  key: string;
  fallbackValue: string;
  currentValue: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
