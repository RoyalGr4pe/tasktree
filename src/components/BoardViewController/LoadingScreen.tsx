'use client';

import LoadingOne from '@/components/ui/loading';

interface LoadingScreenProps {
  phase: 'init' | 'loading';
}

export default function LoadingScreen({ phase }: LoadingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-3">
      <LoadingOne />
      <p className="text-xs text-monday-dark-secondary">
        {phase === 'init' ? 'Connecting…' : 'Loading tasks…'}
      </p>
    </div>
  );
}
