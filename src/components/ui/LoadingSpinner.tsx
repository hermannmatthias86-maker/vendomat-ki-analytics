export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-12 h-12' : 'w-8 h-8'
  return (
    <div className="flex items-center justify-center w-full py-8">
      <div className={`${s} border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin`} />
    </div>
  )
}
