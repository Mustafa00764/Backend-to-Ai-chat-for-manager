import { Bot, Database, FileText, MessageSquare, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db/prisma'

export default async function AdminPage() {
  const [usersCount, chatsCount, filesCount, knowledgeCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.chat.count(),
      prisma.file.count(),
      prisma.knowledgeConversation.count()
    ])

  const stats = [
    {
      title: 'Пользователи',
      value: usersCount,
      icon: Users
    },
    {
      title: 'AI-чаты',
      value: chatsCount,
      icon: MessageSquare
    },
    {
      title: 'Файлы',
      value: filesCount,
      icon: FileText
    },
    {
      title: 'Разговоры в базе',
      value: knowledgeCount,
      icon: Database
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Общая панель управления Manager AI.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map(stat => {
          const Icon = stat.icon

          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Следующий шаг
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Сейчас готовим пользователей и роли. После этого перейдем к AI-чатам и
          базе знаний.
        </CardContent>
      </Card>
    </div>
  )
}
