// src/components/ui/Logo.tsx
export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-4xl' : 'text-2xl'
  return (
    <span className={`font-display font-bold ${textSize} leading-none`}>
      <span className="text-green-700">trolley</span>
      <span className="text-amber-400">save</span>
    </span>
  )
}
