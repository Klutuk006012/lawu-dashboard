'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import {
  BookMarked,
  BookOpenText,
  Bot,
  Cpu,
  HardDrive,
  MemoryStick,
  MessageSquarePlus,
  Menu,
  Moon,
  Server,
  Settings2,
  Sun,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { LAWU_HARDWARE, type ConversationSummary, type ViewKey } from '@/lib/lawu'
import { ChatView } from '@/components/lawu/chat-view'
import { SearchView } from '@/components/lawu/search-view'
import { MonitorView } from '@/components/lawu/monitor-view'
import { GuideView } from '@/components/lawu/guide-view'
import { SettingsView } from '@/components/lawu/settings-view'

const NAV: { key: ViewKey; label: string; icon: React.ElementType }[] = [
  { key: 'chat', label: 'Konsol Chat', icon: BookOpenText },
  { key: 'search', label: 'Pencarian Ebook', icon: BookMarked },
  { key: 'monitor', label: 'Monitoring & Alert', icon: Cpu },
  { key: 'guide', label: 'Panduan Server Rust', icon: Server },
  { key: 'settings', label: 'Pengaturan', icon: Settings2 },
]

const VIEW_TITLE: Record<ViewKey, string> = {
  chat: 'Konsol Chat — Lawu-2.5-Fine',
  search: 'Pencarian Ebook',
  monitor: 'Monitoring & Alert',
  guide: 'Panduan Server Rust',
  settings: 'Pengaturan',
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Bot className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">Lawu-2.5-Fine</p>
        <p className="text-[10.5px] text-muted-foreground">Ebook Search Engine · Dashboard</p>
      </div>
    </div>
  )
}

function SidebarContent({
  view,
  onNavigate,
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
  showLogo = true,
}: {
  view: ViewKey
  onNavigate: (v: ViewKey) => void
  conversations: ConversationSummary[]
  activeConversationId: string | null
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onNewChat: () => void
  showLogo?: boolean
}) {
  return (
    <div className="flex h-full flex-col">
      {showLogo && (
        <div className="px-4 pt-4">
          <Logo />
        </div>
      )}

      <div className="px-3 pt-4">
        <Button onClick={onNewChat} className="w-full justify-start gap-2 rounded-xl" size="sm">
          <MessageSquarePlus className="h-4 w-4" />
          Obrolan Baru
        </Button>
      </div>

      <nav aria-label="Navigasi utama" className="mt-4 px-3">
        <p className="px-2 pb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          Modul
        </p>
        <ul className="space-y-0.5">
          {NAV.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onNavigate(item.key)}
                aria-current={view === item.key ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                  view === item.key
                    ? 'bg-primary/10 font-medium text-primary dark:bg-primary/15'
                    : 'text-foreground/80 hover:bg-sidebar-accent'
                )}
              >
                <item.icon className={cn('h-4 w-4 shrink-0', view === item.key && 'text-primary')} />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 min-h-0 flex-1 px-3">
        <p className="px-2 pb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          Riwayat Obrolan
        </p>
        <ScrollArea className="h-[calc(100%-2rem)]">
          <ul className="space-y-0.5 pb-3 pr-2">
            {conversations.length === 0 && (
              <li className="px-2 py-1.5 text-xs text-muted-foreground">
                Belum ada obrolan — mulai dari Konsol Chat.
              </li>
            )}
            {conversations.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    onSelectConversation(c.id)
                    onNavigate('chat')
                  }}
                  className={cn(
                    'flex w-full items-center rounded-lg px-2.5 py-2 pr-8 text-left text-[13px] transition-colors',
                    activeConversationId === c.id && view === 'chat'
                      ? 'bg-sidebar-accent font-medium'
                      : 'hover:bg-sidebar-accent'
                  )}
                >
                  <span className="truncate">{c.title}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Hapus obrolan ${c.title}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteConversation(c.id)
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </div>

      <div className="border-t px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
            <Cpu className="h-3 w-3" /> i5-10400
          </Badge>
          <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
            <MemoryStick className="h-3 w-3" /> 8 GB
          </Badge>
          <Badge variant="secondary" className="gap-1 text-[10px] font-normal">
            <HardDrive className="h-3 w-3" /> SSD 128 · HDD 500
          </Badge>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const { theme, setTheme } = useTheme()
  const [view, setView] = React.useState<ViewKey>('chat')
  const [conversations, setConversations] = React.useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((data) => setConversations(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [refreshKey])

  const handleNewChat = () => {
    setActiveConversationId(null)
    setView('chat')
    setMobileNavOpen(false)
  }

  const handleDeleteConversation = async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
      if (activeConversationId === id) setActiveConversationId(null)
      setRefreshKey((k) => k + 1)
    } catch {
      // diamkan — daftar akan disegarkan berikutnya
    }
  }

  const sidebarProps = {
    view,
    onNavigate: (v: ViewKey) => {
      setView(v)
      setMobileNavOpen(false)
    },
    conversations,
    activeConversationId,
    onSelectConversation: setActiveConversationId,
    onDeleteConversation: handleDeleteConversation,
    onNewChat: handleNewChat,
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex min-h-0 flex-1">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-sidebar md:block">
          <SidebarContent {...sidebarProps} />
        </aside>

        {/* Area utama */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background/85 px-4 backdrop-blur">
            <div className="flex min-w-0 items-center gap-2">
              {/* Nav mobile */}
              <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Buka menu navigasi">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0" aria-describedby={undefined}>
                  <SheetHeader className="border-b px-4 py-3">
                    <SheetTitle asChild>
                      <div>
                        <Logo />
                      </div>
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                      Menu navigasi dashboard Lawu-2.5-Fine
                    </SheetDescription>
                  </SheetHeader>
                  <div className="h-[calc(100%-60px)]">
                    <SidebarContent {...sidebarProps} showLogo={false} />
                  </div>
                </SheetContent>
              </Sheet>
              <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">
                {VIEW_TITLE[view]}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="hidden font-normal sm:inline-flex">
                fine-tune codex + reasoning · GGUF Q3_K_M
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                aria-label={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
              </Button>
            </div>
          </header>

          <main className="min-h-0 flex-1">
            {view === 'chat' && (
              <ChatView
                conversationId={activeConversationId}
                onConversationCreated={setActiveConversationId}
                onConversationsChanged={() => setRefreshKey((k) => k + 1)}
              />
            )}
            {view === 'search' && <SearchView />}
            {view === 'monitor' && <MonitorView />}
            {view === 'guide' && <GuideView />}
            {view === 'settings' && <SettingsView />}
          </main>

          {/* Footer sticky: mt-auto menjaga tetap di dasar; konten panjang mendorongnya turun */}
          <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-[11px] text-muted-foreground">
            <p>
              Lawu-2.5-Fine · {LAWU_HARDWARE.cpu} · {LAWU_HARDWARE.ram} · Debian 13
            </p>
            <p className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#34a853]" aria-hidden />
              Index Tantivy: aktif · Telegram: simulasi · llama.cpp: menyusul
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
