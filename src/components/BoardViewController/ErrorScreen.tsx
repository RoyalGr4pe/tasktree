'use client';

interface ErrorScreenProps {
  message: string | null;
  onRetry: () => void;
}

export default function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="p-5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive max-w-sm w-full mx-4">
        <p className="font-semibold text-sm mb-1">Something went wrong</p>
        <p className="text-sm">{message}</p>
        <button
          onClick={onRetry}
          className="mt-3 px-3 py-1.5 text-sm font-medium text-white bg-monday-blue rounded hover:bg-monday-blue-hover transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
