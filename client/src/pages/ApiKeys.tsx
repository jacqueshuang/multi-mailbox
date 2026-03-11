import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Key,
  Trash2,
  Copy,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Clock,
  Activity,
  Power,
} from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

export default function ApiKeys() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  // Fetch API keys
  const { data: apiKeys, isLoading, refetch } = trpc.apiKey.list.useQuery();

  // Mutations
  const createKeyMutation = trpc.apiKey.create.useMutation({
    onSuccess: (result) => {
      setGeneratedKey(result.key);
      refetch();
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  const deleteKeyMutation = trpc.apiKey.delete.useMutation({
    onSuccess: () => {
      toast.success("API 密钥已删除");
      refetch();
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const setActiveMutation = trpc.apiKey.setActive.useMutation({
    onSuccess: (_result, variables) => {
      toast.success(variables.isActive ? "API 密钥已启用" : "API 密钥已禁用");
      refetch();
    },
    onError: (error) => {
      toast.error(`状态更新失败: ${error.message}`);
    },
  });

  // Handle create
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    createKeyMutation.mutate({
      name: newKeyName,
      permissions: ["read", "write"],
    });
  };

  // Handle copy
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已复制到剪贴板");
  };

  // Reset dialog state
  const handleDialogClose = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setNewKeyName("");
      setGeneratedKey(null);
      setShowKey(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-4">
        {/* Header */}
        <div className="bg-card border border-border/60 rounded-xl shadow-elegant">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
            <div>
              <h1 className="text-lg font-semibold">API 密钥</h1>
              <p className="text-sm text-muted-foreground mt-1">
                管理用于外部访问的 API 密钥
              </p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  创建密钥
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[450px]">
                {generatedKey ? (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        密钥创建成功
                      </DialogTitle>
                      <DialogDescription>
                        请立即复制并安全保存此密钥，它只会显示一次。
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="relative">
                        <Input
                          value={showKey ? generatedKey : "•".repeat(48)}
                          readOnly
                          className="pr-20 font-mono text-sm"
                        />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setShowKey(!showKey)}
                          >
                            {showKey ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleCopy(generatedKey)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        此密钥以 <code className="bg-muted px-1 rounded">mm_</code> 开头
                      </p>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => handleDialogClose(false)}>
                        完成
                      </Button>
                    </DialogFooter>
                  </>
                ) : (
                  <form onSubmit={handleCreate}>
                    <DialogHeader>
                      <DialogTitle>创建 API 密钥</DialogTitle>
                      <DialogDescription>
                        为您的应用程序创建一个新的 API 密钥
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="keyName">密钥名称</Label>
                        <Input
                          id="keyName"
                          placeholder="例如：我的应用"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          给密钥起一个描述性的名称，方便识别用途
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleDialogClose(false)}
                      >
                        取消
                      </Button>
                      <Button type="submit" disabled={createKeyMutation.isPending}>
                        {createKeyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Key className="h-4 w-4 mr-2" />
                        )}
                        创建
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* API Keys List */}
        <div className="bg-card border border-border/60 rounded-xl shadow-elegant p-5">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          ) : apiKeys && apiKeys.length > 0 ? (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <Card key={key.id}>
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full border border-border/60 bg-primary/10 flex items-center justify-center">
                          <Key className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold">{key.name}</CardTitle>
                          <CardDescription className="font-mono text-xs">
                            {key.keyPrefix}...
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={key.isActive ? "default" : "secondary"}>
                        {key.isActive ? "活跃" : "已禁用"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          创建于 {format(new Date(key.createdAt), "yyyy/MM/dd")}
                        </div>
                        {key.lastUsedAt && (
                          <div className="flex items-center gap-1">
                            <Activity className="h-4 w-4" />
                            {formatDistanceToNow(new Date(key.lastUsedAt), { addSuffix: true, locale: zhCN })}使用
                          </div>
                        )}
                        {(key.usageCount ?? 0) > 0 && (
                          <div>
                            已调用 {key.usageCount} 次
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border/70"
                          onClick={() => setActiveMutation.mutate({ id: key.id, isActive: !key.isActive })}
                          disabled={setActiveMutation.isPending}
                        >
                          <Power className="h-4 w-4 mr-1" />
                          {key.isActive ? "禁用" : "启用"}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive border-border/70">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除</AlertDialogTitle>
                              <AlertDialogDescription>
                                确定要删除 API 密钥 "{key.name}" 吗？使用此密钥的应用将无法继续访问 API。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteKeyMutation.mutate({ id: key.id })}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="h-14 w-14 rounded-full border border-border/60 bg-muted/60 flex items-center justify-center mb-4">
                  <Key className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-medium mb-2">还没有 API 密钥</h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                  创建 API 密钥以便从外部应用程序访问您的邮件数据
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  创建密钥
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* API Documentation */}
        <div className="bg-card border border-border/60 rounded-xl shadow-elegant">
          <div className="px-5 py-4 border-b border-border/50">
            <CardTitle className="text-sm font-semibold">API 使用说明</CardTitle>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">认证方式</h4>
              <p className="text-sm text-muted-foreground mb-2">
                在请求头中添加 Authorization Bearer Token：
              </p>
              <pre className="bg-muted/50 border border-border/60 p-3 rounded-lg text-sm overflow-x-auto">
                <code>Authorization: Bearer mm_your_api_key_here</code>
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">可用接口</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-border/70 text-muted-foreground text-[11px]">GET</Badge>
                  <code className="text-muted-foreground">/api/v1/accounts</code>
                  <span className="text-muted-foreground">- 获取邮箱账户列表</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-border/70 text-muted-foreground text-[11px]">GET</Badge>
                  <code className="text-muted-foreground">/api/v1/emails</code>
                  <span className="text-muted-foreground">- 获取邮件列表</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-border/70 text-muted-foreground text-[11px]">GET</Badge>
                  <code className="text-muted-foreground">/api/v1/emails/:id</code>
                  <span className="text-muted-foreground">- 获取邮件详情</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-border/70 text-muted-foreground text-[11px]">GET</Badge>
                  <code className="text-muted-foreground">/api/v1/stats</code>
                  <span className="text-muted-foreground">- 获取统计信息</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
