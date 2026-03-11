import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, RefreshCw, Copy } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";

export default function TempMail() {
  const [, setLocation] = useLocation();
  const [tempMailLocalPart, setTempMailLocalPart] = useState("");
  const [tempMailDurationMinutes, setTempMailDurationMinutes] = useState(60);
  const [tempMailUnlimited, setTempMailUnlimited] = useState(false);
  const [autoRefreshTempMail, setAutoRefreshTempMail] = useState(true);

  const generateLocalPart = () => {
    const random = Math.random().toString(36).slice(2, 8);
    setTempMailLocalPart(`temp-${random}`);
  };

  const { data: tempMailboxes, refetch: refetchTempMailboxes } = trpc.tempMail.list.useQuery();
  const { refetch: refetchEmails } = trpc.emailAccount.list.useQuery();

  const createTempMailboxMutation = trpc.tempMail.create.useMutation({
    onSuccess: () => {
      toast.success("临时邮箱已创建");
      refetchTempMailboxes();
      refetchEmails();
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  const extendTempMailboxMutation = trpc.tempMail.extend.useMutation({
    onSuccess: () => {
      toast.success("有效期已更新");
      refetchTempMailboxes();
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const deleteTempMailboxMutation = trpc.tempMail.delete.useMutation({
    onSuccess: () => {
      toast.success("临时邮箱已停用");
      refetchTempMailboxes();
      refetchEmails();
    },
    onError: (error) => {
      toast.error(`停用失败: ${error.message}`);
    },
  });

  useEffect(() => {
    if (!autoRefreshTempMail) return;
    const timer = setInterval(() => {
      refetchTempMailboxes();
      refetchEmails();
    }, 15000);
    return () => clearInterval(timer);
  }, [autoRefreshTempMail, refetchTempMailboxes, refetchEmails]);

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-4">
        <div className="bg-card border border-border/60 rounded-xl shadow-elegant">
          <div className="px-5 py-4 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">临时邮箱</CardTitle>
            <CardDescription>生成临时邮箱用于接收一次性邮件</CardDescription>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>地址前缀（可选）</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="例如 promo"
                    value={tempMailLocalPart}
                    onChange={(e) => setTempMailLocalPart(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border-border/70"
                    onClick={generateLocalPart}
                  >
                    自动生成
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>有效期（分钟）</Label>
                <Input
                  type="number"
                  min={5}
                  max={10080}
                  value={tempMailDurationMinutes}
                  onChange={(e) => setTempMailDurationMinutes(Number(e.target.value))}
                  disabled={tempMailUnlimited}
                />
              </div>
              <div className="space-y-2">
                <Label>无限期</Label>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={tempMailUnlimited}
                    onCheckedChange={setTempMailUnlimited}
                  />
                  <span className="text-sm text-muted-foreground">不自动过期</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>自动刷新</Label>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={autoRefreshTempMail}
                    onCheckedChange={setAutoRefreshTempMail}
                  />
                  <span className="text-sm text-muted-foreground">15 秒</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  createTempMailboxMutation.mutate({
                    localPart: tempMailLocalPart.trim() || undefined,
                    expiresInMinutes: tempMailUnlimited ? undefined : tempMailDurationMinutes,
                    unlimited: tempMailUnlimited,
                  })
                }
                disabled={createTempMailboxMutation.isPending}
              >
                {createTempMailboxMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                生成临时邮箱
              </Button>
              <Button
                variant="outline"
                className="border-border/70"
                onClick={() => {
                  refetchTempMailboxes();
                  refetchEmails();
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </div>

            {tempMailboxes && tempMailboxes.length > 0 ? (
              <div className="space-y-3">
                {tempMailboxes.map((mailbox) => {
                  const expired = mailbox.expiresAt ? new Date(mailbox.expiresAt) < new Date() : false;
                  return (
                    <div key={mailbox.id} className="border border-border/60 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{mailbox.address}</div>
                        <Badge variant={expired || !mailbox.isActive ? "destructive" : "secondary"}>
                          {expired || !mailbox.isActive ? "已过期" : "有效"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {mailbox.expiresAt
                          ? `过期时间: ${format(new Date(mailbox.expiresAt), "MM/dd HH:mm", { locale: zhCN })}`
                          : "无限期"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border/70"
                          onClick={() => navigator.clipboard.writeText(mailbox.address)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          复制地址
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border/70"
                          onClick={() => extendTempMailboxMutation.mutate({
                            id: mailbox.id,
                            expiresInMinutes: tempMailUnlimited ? undefined : tempMailDurationMinutes,
                            unlimited: tempMailUnlimited,
                          })}
                          disabled={extendTempMailboxMutation.isPending}
                        >
                          {tempMailUnlimited ? "设为无限期" : "延长有效期"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border/70"
                          onClick={() => setLocation(`/?account=${mailbox.accountId}`)}
                        >
                          查看收件箱
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-border/70"
                          onClick={() => deleteTempMailboxMutation.mutate({ id: mailbox.id })}
                          disabled={deleteTempMailboxMutation.isPending}
                        >
                          停用
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">暂无临时邮箱</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
