'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  AudioLines,
  Bot,
  Code2,
  Database,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Users
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard
  },
  {
    href: '/admin/audio-transcriber',
    label: 'Audio transcription',
    icon: AudioLines
  },
  {
    href: '/admin/users',
    label: 'Пользователи',
    icon: Users
  },
  {
    href: '/admin/chats',
    label: 'AI-чаты',
    icon: MessageSquare
  },
  {
    href: '/admin/knowledge',
    label: 'База знаний',
    icon: Database
  },
  {
    href: '/admin/files',
    label: 'Файлы',
    icon: FileText
  },
  {
    href: '/admin/ai',
    label: 'AI-настройки',
    icon: Bot
  },
  {
    href: '/admin/api-docs',
    label: 'API Docs',
    icon: Code2
  }
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden min-h-screen w-72 border-r bg-card lg:block">
      <div className="flex h-16 items-center border-b px-6">
        <div>
          <p className="text-lg font-semibold">Manager AI</p>
          <p className="text-xs text-muted-foreground">Admin Panel</p>
        </div>
      </div>

      <nav className="space-y-1 p-4">
        {navItems.map(item => {
          const Icon = item.icon
          const active =
            item.href === '/admin'
              ? pathname === item.href
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground',
                active && 'bg-muted text-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
