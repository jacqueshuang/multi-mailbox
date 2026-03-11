import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Star,
  Paperclip,
  ChevronRight,
  Mail,
  MailOpen,
  Clock,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { zhCN } from "date-fns/locale";
import EmailDetail from "./EmailDetail";

export default function Starred() {
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);

  // Fetch starred emails
  const { data: emailList, isLoading } = trpc.email.list.useQuery({
    isStarred: true,
    limit: 100,
  });

  const emails = emailList?.items ?? [];

  // Fetch accounts for display
  const { data: accounts } = trpc.emailAccount.list.useQuery();

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
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
              已加星标
            </h1>
            {emails && (
              <Badge variant="secondary" className="font-normal">
                {emails.length} 封邮件
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Email List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
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
        ) : emails && emails.length > 0 ? (
          <div className="divide-y">
            {emails.map((email) => (
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
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatEmailDate(email.date)}
                      </span>
                    </div>
                  </div>
                  <div className={`text-sm truncate mb-1 ${!email.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {email.subject || "(无主题)"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {email.snippet}
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs font-normal">
                      {getAccountName(email.accountId)}
                    </Badge>
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[400px] text-center p-8">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Star className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">没有星标邮件</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              点击邮件中的星标图标来标记重要邮件
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
