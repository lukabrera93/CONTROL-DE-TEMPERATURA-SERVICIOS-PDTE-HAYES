import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="no-print fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-sm"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-700 shrink-0" />
      <span>Modo sin conexión — Los cambios se guardan localmente en este dispositivo.</span>
    </div>
  );
};
