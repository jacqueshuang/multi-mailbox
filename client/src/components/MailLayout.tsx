import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/useMobile";
import { useTheme } from "@/contexts/ThemeContext";
import {
  Mail,
  Inbox,
  Star,
  Settings,
  LogOut,
  PanelLeft,
  Key,
  Tag,
  ChevronRight,
  Users,
  MailPlus,
  Sun,
  Moon,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { trpc } from "@/lib/trpc";

const menuItems = [
  { icon: Inbox, label: "收件箱", path: "/", badge: "unread" },
  { icon: Star, label: "已加星标", path: "/starred" },
  { icon: Mail, label: "所有邮件", path: "/all" },
];

const settingsItems = [
  { icon: Settings, label: "邮箱账户", path: "/accounts" },
  { icon: MailPlus, label: "临时邮箱", path: "/temp-mail" },
  { icon: Key, label: "API 密钥", path: "/api-keys" },
  { icon: Tag, label: "标签管理", path: "/labels" },
];

const SIDEBAR_WIDTH_KEY = "mail-sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function MailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-6 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-border/60 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              多邮箱管理中心
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              统一管理您的所有邮箱账户，支持 Gmail 和 IMAP 协议邮箱
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = "/login";
            }}
            size="lg"
            className="w-full shadow-elegant"
          >
            登录以继续
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <MailLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </MailLayoutContent>
    </SidebarProvider>
  );
}

type MailLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function MailLayoutContent({
  children,
  setSidebarWidth,
}: MailLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const { theme, toggleTheme, switchable } = useTheme();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Fetch unread count
  const { data: unreadCount } = trpc.email.unreadCount.useQuery({});

  // Fetch accounts for sidebar
  const { data: accounts } = trpc.emailAccount.list.useQuery();

  // Fetch labels for sidebar
  const { data: labels } = trpc.label.list.useQuery();

  // Fetch account groups
  const { data: groups } = trpc.accountGroup.list.useQuery();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-border/70"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-14 justify-center border-b border-border/60">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm font-semibold tracking-tight truncate">
                    邮箱管理
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 pt-1">
            {/* Main navigation */}
            <SidebarMenu className="py-2">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-9 transition-all font-normal"
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.badge === "unread" && unreadCount && unreadCount > 0 && (
                        <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-xs">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Email accounts section */}
            {!isCollapsed && accounts && accounts.length > 0 && (
              <div className="py-2 border-t border-border/60">
                {groups?.map((group) => {
                  const groupAccounts = accounts.filter(
                    (a) => a.groupId === group.id
                  );
                  if (groupAccounts.length === 0) return null;
                  return (
                    <Collapsible
                      key={group.id}
                      defaultOpen
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className="w-full justify-between font-medium text-muted-foreground uppercase tracking-wider text-[11px] h-7 hover:bg-transparent px-3">
                            <span>{group.name}</span>
                            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenu>
                            {groupAccounts.map((account) => (
                              <SidebarMenuItem key={account.id}>
                                <SidebarMenuButton
                                  onClick={() =>
                                    setLocation(`/?account=${account.id}`)
                                  }
                                  tooltip={account.email}
                                  className="h-9 font-normal pl-6"
                                >
                                  <div
                                    className={`h-2 w-2 rounded-full shrink-0 ${
                                      account.syncStatus === "syncing"
                                        ? "bg-yellow-500 animate-pulse-subtle"
                                        : account.syncStatus === "error"
                                        ? "bg-destructive"
                                        : "bg-green-500"
                                    }`}
                                  />
                                  <span className="truncate text-sm">
                                    {account.displayName || account.email}
                                  </span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            ))}
                          </SidebarMenu>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                })}

                {/* Ungrouped Accounts */}
                {(() => {
                  const ungrouped = accounts.filter((a) => !a.groupId);
                  if (ungrouped.length === 0) return null;

                  return (
                    <>
                      {groups && groups.length > 0 ? (
                        <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          其他账户
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                          邮箱账户
                        </div>
                      )}
                      <SidebarMenu>
                        {ungrouped.map((account) => (
                          <SidebarMenuItem key={account.id}>
                            <SidebarMenuButton
                              onClick={() =>
                                setLocation(`/?account=${account.id}`)
                              }
                              tooltip={account.email}
                              className="h-9 font-normal"
                            >
                              <div
                                className={`h-2 w-2 rounded-full shrink-0 ${
                                  account.syncStatus === "syncing"
                                    ? "bg-yellow-500 animate-pulse-subtle"
                                    : account.syncStatus === "error"
                                    ? "bg-destructive"
                                    : "bg-green-500"
                                }`}
                              />
                              <span className="truncate text-sm">
                                {account.displayName || account.email}
                              </span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Labels section */}
            {!isCollapsed && labels && labels.length > 0 && (
              <div className="py-2 border-t border-border/60">
                <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  标签
                </div>
                <SidebarMenu>
                  {labels.map(label => (
                    <SidebarMenuItem key={label.id}>
                      <SidebarMenuButton
                        onClick={() => setLocation(`/?label=${label.id}`)}
                        tooltip={label.name}
                        className="h-9 font-normal"
                      >
                        <Tag className="h-4 w-4 shrink-0" style={{ color: label.color }} />
                        <span className="truncate text-sm">{label.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </div>
            )}

            {/* Settings section */}
            <div className="py-2 border-t border-border/60 mt-auto">
              {!isCollapsed && (
                <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  设置
                </div>
              )}
              <SidebarMenu>
                {settingsItems.map(item => {
                  const isActive = location === item.path;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        isActive={isActive}
                        onClick={() => setLocation(item.path)}
                        tooltip={item.label}
                        className="h-9 transition-all font-normal"
                      >
                        <item.icon
                          className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                        />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {user?.role === "admin" && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={location === "/admin/users"}
                      onClick={() => setLocation("/admin/users")}
                      tooltip="用户管理"
                      className="h-9 transition-all font-normal"
                    >
                      <Users className={`h-4 w-4 ${location === "/admin/users" ? "text-primary" : ""}`} />
                      <span>用户管理</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </div>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-border/60">
            {switchable && toggleTheme && (
              <div className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg border border-border/60 bg-background/60 mb-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Sun className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span>夜间模式</span>
                </div>
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={() => toggleTheme()}
                  aria-label="切换日夜模式"
                />
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "用户"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setLocation("/accounts")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>邮箱设置</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/api-keys")}>
                  <Key className="mr-2 h-4 w-4" />
                  <span>API 密钥</span>
                </DropdownMenuItem>
                {user?.role === "admin" && (
                  <DropdownMenuItem onClick={() => setLocation("/admin/users")}>
                    <Users className="mr-2 h-4 w-4" />
                    <span>用户管理</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/10 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b border-border/60 h-14 items-center justify-between bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">邮箱管理</span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 h-full overflow-hidden">{children}</main>
      </SidebarInset>
    </>
  );
}
