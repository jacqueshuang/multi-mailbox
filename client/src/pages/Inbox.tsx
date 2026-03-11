import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  RefreshCw,
  Star,
  Paperclip,
  ChevronRight,
  Mail,
  MailOpen,
  Clock,
  Filter,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useLocation } from "wouter";
import EmailDetail from "./EmailDetail";

export default function Inbox() {
  const [location] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [selectedLabelId, setSelectedLabelId] = useState<string>("all");
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  // Parse account/label filter from URL
  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    const accountId = params.get("account");
    const labelId = params.get("label");

    if (accountId) {
      setSelectedAccountId(accountId);
      setSelectedLabelId("all");
    } else if (labelId) {
      setSelectedLabelId(labelId);
      setSelectedAccountId("all");
    } else {
      setSelectedAccountId("all");
      setSelectedLabelId("all");
    }
    setPage(0);
  }, [location]);

  // Fetch accounts
  const { data: accounts } = trpc.emailAccount.list.useQuery();

  // Fetch emails
  const {
    data: emailList,
    isLoading,
    refetch,
    isFetching
  } = trpc.email.list.useQuery({
    accountId: selectedAccountId !== "all" ? parseInt(selectedAccountId) : undefined,
    labelId: selectedLabelId !== "all" ? parseInt(selectedLabelId) : undefined,
    search: searchQuery || undefined,
    limit: pageSize + 1,
    offset: page * pageSize,
  });

  const pageEmails = useMemo(() => emailList?.items?.slice(0, pageSize) ?? [], [emailList, pageSize]);
  const hasNextPage = (emailList?.items?.length ?? 0) > pageSize;
  const totalCount = emailList?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : page * pageSize + 1;
  const rangeEnd = totalCount === 0 ? 0 : Math.min((page + 1) * pageSize, totalCount);

  // Sync mutation
  const syncMutation = trpc.emailAccount.sync.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // Handle sync
  const handleSync = () => {
    if (selectedAccountId !== "all") {
      syncMutation.mutate({ id: parseInt(selectedAccountId) });
    } else {
      // Sync all accounts
      accounts?.forEach(account => {
        syncMutation.mutate({ id: account.id });
      });
    }
  };

  // Format date
  const formatEmailDate = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return format(d, "HH:mm");
    } else if (diffDays < 7) {
      return formatDistanceToNow(d, { addSuffix: true, locale: zhCN });
    } else {
      return format(d, "MM/dd");
    }
  };

  // Get account name by ID
  const getAccountName = (accountId: number) => {
    const account = accounts?.find(a => a.id === accountId);
    return account?.displayName || account?.email || "";
  };

  if (selectedEmailId) {
    return (
      <EmailDetail 
        emailId={selectedEmailId} 
        onBack={() => setSelectedEmailId(null)} 
      />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">收件箱</h1>
            {emailList && (
              <Badge variant="secondary" className="font-normal">
                {totalCount} 封邮件
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncMutation.isPending || isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${(syncMutation.isPending || isFetching) ? 'animate-spin' : ''}`} />
              同步
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3 px-4 pb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索邮件..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(0);
              }}
              className="pl-9"
            />
          </div>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="所有账户" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">所有账户</SelectItem>
              {accounts?.map(account => (
                <SelectItem key={account.id} value={account.id.toString()}>
                  {account.displayName || account.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Email List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-start gap-4 p-4 rounded-lg border">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (emailList?.items?.length ?? 0) > 0 ? (
          <div className="divide-y">
            {pageEmails.map((email) => (
              <button
                key={email.id}
                onClick={() => setSelectedEmailId(email.id)}
                className={`w-full text-left p-4 hover:bg-accent/50 transition-colors flex items-start gap-4 group ${
                  !email.isRead ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                }`}
              >
                {/* Avatar / Icon */}
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                  !email.isRead ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {!email.isRead ? (
                    <Mail className="h-5 w-5" />
                  ) : (
                    <MailOpen className="h-5 w-5" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`truncate ${!email.isRead ? 'font-semibold' : 'font-medium'}`}>
                      {email.fromName || email.fromAddress}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {email.hasAttachments && (
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                      )}
                      {email.isStarred && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatEmailDate(email.date)}
                      </span>
                    </div>
                  </div>
                  <div className={`text-sm truncate mb-1 ${!email.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {email.subject || "(无主题)"}
                  </div>
                  {/* Labels */}
                  {email.labels && email.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {email.labels.map((label: any) => (
                        <Badge
                          key={label.id}
                          variant="outline"
                          className="text-[10px] h-4 px-1 py-0"
                          style={{
                            borderColor: label.color,
                            color: label.color,
                            backgroundColor: `${label.color}10`
                          }}
                        >
                          {label.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground truncate">
                    {email.snippet}
                  </div>
                  {selectedAccountId === "all" && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs font-normal">
                        {getAccountName(email.accountId)}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">没有邮件</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchQuery
                ? "没有找到匹配的邮件，请尝试其他搜索词"
                : accounts && accounts.length > 0
                  ? "点击同步按钮获取最新邮件"
                  : "请先添加邮箱账户"}
            </p>
            {(!accounts || accounts.length === 0) && (
              <Button
                className="mt-4"
                onClick={() => window.location.href = "/accounts"}
              >
                添加邮箱账户
              </Button>
            )}
          </div>
        )}
      </ScrollArea>
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          第 {page + 1} 页，共 {totalPages} 页（{rangeStart}-{rangeEnd} / {totalCount}）
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
            disabled={page === 0}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={!hasNextPage}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  );
}
