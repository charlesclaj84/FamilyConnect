import { UserCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const sizeClasses = {
  xs: { container: 'w-7 h-7', text: 'text-xs', icon: 'h-4 w-4' },
  sm: { container: 'w-10 h-10', text: 'text-sm', icon: 'h-5 w-5' },
  md: { container: 'w-14 h-14', text: 'text-lg', icon: 'h-7 w-7' },
  lg: { container: 'w-20 h-20', text: 'text-2xl', icon: 'h-10 w-10' },
}

interface AvatarProps {
  url?: string | null
  initials?: string
  size?: keyof typeof sizeClasses
  className?: string
}

export function Avatar({ url, initials, size = 'md', className }: AvatarProps) {
  const s = sizeClasses[size]
  return (
    <div
      className={cn(
        'rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden shrink-0 select-none',
        s.container,
        className,
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Profile photo" className="w-full h-full object-cover" />
      ) : initials ? (
        <span className={cn('font-semibold text-muted-foreground', s.text)}>{initials}</span>
      ) : (
        <UserCircle className={cn('text-muted-foreground/40', s.icon)} />
      )}
    </div>
  )
}
