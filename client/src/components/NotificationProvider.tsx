import { useEffect } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Mail, RefreshCw, AlertCircle } from "lucide-react";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const utils = trpc.useUtils();

  const { isConnected } = useWebSocket({
    onNewEmail: (data) => {
      const emailData = data?.email ?? data ?? {};

      // Show toast notification
      toast.success(
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">{emailData.fromName || emailData.fromAddress || "未知发件人"}</div>
            <div className="text-sm text-muted-foreground truncate max-w-[250px]">
              {emailData.subject || "(无主题)"}
            </div>
          </div>
        </div>,
        {
          duration: 5000,
          action: {
            label: "查看",
            onClick: () => {
              // Navigate to inbox
              window.location.href = "/";
            },
          },
        }
      );

      // Invalidate email queries to refresh the list
      utils.email.list.invalidate();
      utils.email.unreadCount.invalidate();
    },

    onSyncComplete: (data) => {
      if (typeof data?.newEmails === "number" && data.newEmails > 0) {
        toast.info(
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span>同步完成，收到 {data.newEmails} 封新邮件</span>
          </div>,
          { duration: 3000 }
        );
      }

      if (data?.status === "error") {
        toast.error(
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{data?.error || "邮件同步失败"}</span>
          </div>,
          { duration: 4000 }
        );
      }

      // Refresh data after sync completed or failed
      utils.email.list.invalidate();
      utils.email.unreadCount.invalidate();
      utils.emailAccount.list.invalidate();
    },

    onError: (error) => {
      console.error("[Notification] Error:", error);
      // Only show toast for actual connection errors, not initial connection failures
    },
  });

  // Show connection status change
  useEffect(() => {
    if (isConnected) {
      console.log("[Notification] WebSocket connected");
    }
  }, [isConnected]);

  return <>{children}</>;
}
