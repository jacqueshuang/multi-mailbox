import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Mail,
  Settings,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Server,
  Lock,
  Chrome,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Reorder } from "framer-motion";

export default function Accounts() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isConnectingMicrosoft, setIsConnectingMicrosoft] = useState(false);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesDrafts, setNotesDrafts] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();

  // Form state
  const [formData, setFormData] = useState({
    email: "",
    displayName: "",
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    imapUsername: "",
    imapPassword: "",
    groupId: undefined as number | undefined,
  });

  // Fetch accounts
  const { data: accounts, isLoading, refetch } = trpc.emailAccount.list.useQuery();
  const [localAccounts, setLocalAccounts] = useState<typeof accounts>([]);

  useEffect(() => {
    if (accounts) {
      setLocalAccounts(accounts);
    }
  }, [accounts]);

  // Fetch groups
  const { data: groups } = trpc.accountGroup.list.useQuery();

  // Mutations
  const addAccountMutation = trpc.emailAccount.addImap.useMutation({
    onSuccess: () => {
      toast.success("邮箱账户添加成功");
      setIsAddDialogOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`添加失败: ${error.message}`);
    },
  });

  const deleteAccountMutation = trpc.emailAccount.delete.useMutation({
    onSuccess: () => {
      toast.success("邮箱账户已删除");
      refetch();
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const createGroupMutation = trpc.accountGroup.create.useMutation({
    onSuccess: () => {
      toast.success("分组创建成功");
      setNewGroupName("");
      utils.accountGroup.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteGroupMutation = trpc.accountGroup.delete.useMutation({
    onSuccess: () => {
      toast.success("分组删除成功");
      utils.accountGroup.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reorderMutation = trpc.emailAccount.reorder.useMutation({
    onSuccess: () => {
      utils.emailAccount.list.invalidate();
    },
  });

  const moveAccountMutation = trpc.accountGroup.moveAccount.useMutation({
    onSuccess: () => {
      utils.emailAccount.list.invalidate();
      utils.accountGroup.list.invalidate();
      toast.success("账户分组已更新");
    },
    onError: (error) => {
      toast.error(`移动分组失败: ${error.message}`);
    },
  });

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    createGroupMutation.mutate({ name: newGroupName });
  };

  const syncAccountMutation = trpc.emailAccount.sync.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`同步完成，获取了 ${result.newEmails} 封新邮件`);
      } else {
        const errorMsg = 'error' in result ? result.error : ('errors' in result ? (result as any).errors.join(", ") : '未知错误');
        toast.error(`同步失败: ${errorMsg}`);
      }
      refetch();
    },
    onError: (error) => {
      toast.error(`同步失败: ${error.message}`);
    },
  });

  const updateAccountMutation = trpc.emailAccount.update.useMutation({
    onSuccess: () => {
      toast.success("备注已保存");
      setEditingNotes(null);
      utils.emailAccount.list.invalidate();
    },
    onError: (error) => {
      toast.error(`保存失败: ${error.message}`);
    },
  });


  const testConnectionMutation = trpc.emailAccount.testConnection.useMutation({
    onSuccess: (result) => {
      setIsTestingConnection(false);
      if (result.success) {
        toast.success("连接测试成功");
      } else {
        toast.error(`连接失败: ${result.error}`);
      }
    },
    onError: (error) => {
      setIsTestingConnection(false);
      toast.error(`测试失败: ${error.message}`);
    },
  });

  // Google OAuth
  const { data: googleOAuthStatus } = trpc.emailAccount.googleOAuthStatus.useQuery();
  const { data: microsoftOAuthStatus } = trpc.emailAccount.microsoftOAuthStatus.useQuery();
  
  const getGoogleAuthUrlMutation = trpc.emailAccount.getGoogleAuthUrl.useMutation({
    onSuccess: (result) => {
      // Redirect to Google OAuth
      window.location.href = result.authUrl;
    },
    onError: (error) => {
      setIsConnectingGoogle(false);
      toast.error(`连接 Google 失败: ${error.message}`);
    },
  });

  const handleConnectGoogle = () => {
    setIsConnectingGoogle(true);
    const origin = import.meta.env.DEV ? "https://messager.sk29.pw" : window.location.origin;
    const redirectUri = `${origin}/google-callback`;
    getGoogleAuthUrlMutation.mutate({ redirectUri });
  };

  const getMicrosoftAuthUrlMutation = trpc.emailAccount.getMicrosoftAuthUrl.useMutation({
    onSuccess: (result) => {
      window.location.href = result.authUrl;
    },
    onError: (error) => {
      setIsConnectingMicrosoft(false);
      toast.error(`连接 Microsoft 失败: ${error.message}`);
    },
  });

  const handleConnectMicrosoft = () => {
    if (!microsoftOAuthStatus?.configured) {
      toast.error(
        `Microsoft OAuth 尚未配置。请先设置 MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET，并在 Azure 应用中添加重定向 URI：${window.location.origin}/microsoft-callback`
      );
      return;
    }

    setIsConnectingMicrosoft(true);
    const redirectUri = `${window.location.origin}/microsoft-callback`;
    getMicrosoftAuthUrlMutation.mutate({ redirectUri });
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      email: "",
      displayName: "",
      imapHost: "",
      imapPort: 993,
      imapSecure: true,
      imapUsername: "",
      imapPassword: "",
      groupId: undefined,
    });
  };

  const startEditNotes = (accountId: number, currentNotes: string | null) => {
    setEditingNotes(accountId);
    setNotesDrafts((prev) => ({
      ...prev,
      [accountId]: currentNotes || "",
    }));
  };

  const cancelEditNotes = () => {
    setEditingNotes(null);
  };

  const saveNotes = (accountId: number) => {
    updateAccountMutation.mutate({
      id: accountId,
      notes: notesDrafts[accountId] ?? "",
    });
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAccountMutation.mutate(formData);
  };

  // Handle test connection
  const handleTestConnection = () => {
    setIsTestingConnection(true);
    testConnectionMutation.mutate({
      imapHost: formData.imapHost,
      imapPort: formData.imapPort,
      imapSecure: formData.imapSecure,
      imapUsername: formData.imapUsername,
      imapPassword: formData.imapPassword,
    });
  };

  // Common IMAP presets
  const imapPresets: Record<string, { host: string; port: number }> = {
    "gmail.com": { host: "imap.gmail.com", port: 993 },
    "outlook.com": { host: "outlook.office365.com", port: 993 },
    "hotmail.com": { host: "outlook.office365.com", port: 993 },
    "yahoo.com": { host: "imap.mail.yahoo.com", port: 993 },
    "qq.com": { host: "imap.qq.com", port: 993 },
    "163.com": { host: "imap.163.com", port: 993 },
    "126.com": { host: "imap.126.com", port: 993 },
  };

  // Auto-fill IMAP settings based on email domain
  const handleEmailChange = (email: string) => {
    setFormData(prev => ({ ...prev, email, imapUsername: email }));
    
    const domain = email.split("@")[1]?.toLowerCase();
    if (domain && imapPresets[domain]) {
      setFormData(prev => ({
        ...prev,
        imapHost: imapPresets[domain].host,
        imapPort: imapPresets[domain].port,
      }));
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-4">
        {/* Header */}
        <div className="bg-card border border-border/60 rounded-xl shadow-elegant">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border/50">
            <div>
              <h1 className="text-lg font-semibold">邮箱账户</h1>
              <p className="text-sm text-muted-foreground mt-1">
                管理您的邮箱账户，支持 Gmail、Microsoft/Outlook 和 IMAP 协议
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {googleOAuthStatus?.configured && (
                <Button
                  variant="outline"
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGoogle}
                  className="bg-background border-border/70 hover:bg-accent/40"
                >
                  {isConnectingGoogle ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  连接 Gmail
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleConnectMicrosoft}
                disabled={isConnectingMicrosoft}
                className="bg-background border-border/70 hover:bg-accent/40"
              >
                {isConnectingMicrosoft ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Chrome className="h-4 w-4 mr-2" />
                )}
                连接 Microsoft/Outlook
                {!microsoftOAuthStatus?.configured && (
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                    未配置
                  </Badge>
                )}
              </Button>
              <Button variant="outline" className="border-border/70" onClick={() => setIsManageGroupsOpen(true)}>
                管理分组
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    添加 IMAP 邮箱
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <form onSubmit={handleSubmit}>
                    <DialogHeader>
                      <DialogTitle>添加 IMAP 邮箱</DialogTitle>
                      <DialogDescription>
                        输入您的邮箱信息和 IMAP 服务器配置
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="email">邮箱地址</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={formData.email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="displayName">显示名称（可选）</Label>
                        <Input
                          id="displayName"
                          placeholder="我的邮箱"
                          value={formData.displayName}
                          onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>分组（可选）</Label>
                        <Select
                          value={formData.groupId?.toString() || "none"}
                          onValueChange={(val) =>
                            setFormData((prev) => ({
                              ...prev,
                              groupId: val === "none" ? undefined : parseInt(val),
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择分组" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">无分组</SelectItem>
                            {groups?.map((group) => (
                              <SelectItem
                                key={group.id}
                                value={group.id.toString()}
                              >
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="imapHost">IMAP 服务器</Label>
                          <Input
                            id="imapHost"
                            placeholder="imap.example.com"
                            value={formData.imapHost}
                            onChange={(e) => setFormData(prev => ({ ...prev, imapHost: e.target.value }))}
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="imapPort">端口</Label>
                          <Input
                            id="imapPort"
                            type="number"
                            value={formData.imapPort}
                            onChange={(e) => setFormData(prev => ({ ...prev, imapPort: parseInt(e.target.value) }))}
                            required
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="imapSecure">使用 SSL/TLS</Label>
                        <Switch
                          id="imapSecure"
                          checked={formData.imapSecure}
                          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, imapSecure: checked }))}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="imapUsername">用户名</Label>
                        <Input
                          id="imapUsername"
                          placeholder="通常是邮箱地址"
                          value={formData.imapUsername}
                          onChange={(e) => setFormData(prev => ({ ...prev, imapUsername: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="imapPassword">密码 / 应用专用密码</Label>
                        <Input
                          id="imapPassword"
                          type="password"
                          placeholder="••••••••"
                          value={formData.imapPassword}
                          onChange={(e) => setFormData(prev => ({ ...prev, imapPassword: e.target.value }))}
                          required
                        />
                        <p className="text-xs text-muted-foreground">
                          Gmail 请使用应用专用密码；Outlook/Hotmail 如果测试失败，通常是微软禁用了普通密码的 IMAP 登录，需要应用专用密码或改用 OAuth。
                        </p>
                      </div>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-border/70"
                        onClick={handleTestConnection}
                        disabled={isTestingConnection || !formData.imapHost || !formData.imapUsername || !formData.imapPassword}
                      >
                        {isTestingConnection ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Server className="h-4 w-4 mr-2" />
                        )}
                        测试连接
                      </Button>
                      <Button type="submit" disabled={addAccountMutation.isPending}>
                        {addAccountMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        添加账户
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog
                open={isManageGroupsOpen}
                onOpenChange={setIsManageGroupsOpen}
              >
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>管理账户分组</DialogTitle>
                    <DialogDescription>创建、删除邮箱账户分组。</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <form onSubmit={handleCreateGroup} className="flex gap-2">
                      <Input
                        placeholder="新分组名称"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                      />
                      <Button
                        type="submit"
                        disabled={
                          !newGroupName.trim() || createGroupMutation.isPending
                        }
                      >
                        {createGroupMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "创建"
                        )}
                      </Button>
                    </form>

                    <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                      {groups?.length === 0 && (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          暂无分组
                        </div>
                      )}
                      {groups?.map((group) => (
                        <div
                          key={group.id}
                          className="flex items-center justify-between p-3"
                        >
                          <span className="text-sm font-medium">
                            {group.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              deleteGroupMutation.mutate({ id: group.id })
                            }
                            disabled={deleteGroupMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Account List */}
        <div className="bg-card border border-border/60 rounded-xl shadow-elegant p-5">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : localAccounts && localAccounts.length > 0 ? (
          <Reorder.Group
            axis="y"
            values={localAccounts}
            onReorder={setLocalAccounts}
            className="space-y-4"
          >
            {localAccounts.map((account) => (
              <Reorder.Item
                key={account.id}
                value={account}
                onDragEnd={() => {
                  const updates = localAccounts.map((a, index) => ({
                    id: a.id,
                    sortOrder: index,
                  }));
                  reorderMutation.mutate(updates);
                }}
              >
                <Card className="overflow-hidden">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                          <GripVertical className="h-5 w-5" />
                        </div>
                        <div
                          className={`h-9 w-9 rounded-full border border-border/60 flex items-center justify-center ${
                            account.syncStatus === "error"
                              ? "bg-destructive/10"
                              : "bg-primary/10"
                          }`}
                        >
                          <Mail
                            className={`h-4 w-4 ${
                              account.syncStatus === "error"
                                ? "text-destructive"
                                : "text-primary"
                            }`}
                          />
                        </div>
                        <div>
                        <CardTitle className="text-sm font-semibold">
                          {account.displayName || account.email}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {account.email}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          account.syncStatus === "syncing"
                            ? "default"
                            : account.syncStatus === "error"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {account.syncStatus === "syncing" && (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        )}
                        {account.syncStatus === "syncing"
                          ? "同步中"
                          : account.syncStatus === "error"
                            ? "错误"
                            : "正常"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-border/70 text-muted-foreground"
                      >
                        {account.accountType === "google"
                          ? "Google"
                          : account.accountType === "microsoft"
                            ? "Microsoft"
                            : "IMAP"}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3 w-full">
                    <div className="flex flex-wrap items-start justify-between gap-3 text-sm">
                      <div className="text-muted-foreground">
                        {account.lastSyncAt ? (
                          <>上次同步: {format(new Date(account.lastSyncAt), "MM/dd HH:mm", { locale: zhCN })}</>
                        ) : (
                          "尚未同步"
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={account.groupId?.toString() ?? "none"}
                          onValueChange={(value) =>
                            moveAccountMutation.mutate({
                              accountId: account.id,
                              groupId: value === "none" ? null : parseInt(value, 10),
                            })
                          }
                        >
                          <SelectTrigger className="h-9 w-[140px] border-border/70">
                            <SelectValue placeholder="选择分组" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">无分组</SelectItem>
                            {groups?.map((group) => (
                              <SelectItem key={group.id} value={group.id.toString()}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border/70"
                          onClick={() => syncAccountMutation.mutate({ id: account.id })}
                          disabled={syncAccountMutation.isPending || account.syncStatus === "syncing"}
                        >
                          <RefreshCw
                            className={`h-4 w-4 mr-2 ${
                              syncAccountMutation.isPending ||
                              account.syncStatus === "syncing"
                                ? "animate-spin"
                                : ""
                            }`}
                          />
                          同步
                        </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-border/70"
                        onClick={() =>
                          editingNotes === account.id
                            ? cancelEditNotes()
                            : startEditNotes(account.id, account.notes ?? null)
                        }
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive border-border/70"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除邮箱账户 "{account.email}" 吗？此操作将同时删除该账户下的所有邮件，且无法恢复。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteAccountMutation.mutate({ id: account.id })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">备注</span>
                      {editingNotes !== account.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditNotes(account.id, account.notes ?? null)}
                        >
                          编辑
                        </Button>
                      )}
                    </div>
                    {editingNotes === account.id ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full min-h-[80px] rounded-md border border-border/60 bg-background p-2 text-sm"
                          value={notesDrafts[account.id] ?? ""}
                          onChange={(e) =>
                            setNotesDrafts((prev) => ({
                              ...prev,
                              [account.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => saveNotes(account.id)}
                            disabled={updateAccountMutation.isPending}
                          >
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditNotes}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-muted-foreground">
                        {account.notes?.trim() || "暂无备注"}
                      </div>
                    )}
                  </div>
                  {account.lastSyncError && (
                    <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                      <XCircle className="h-4 w-4 inline mr-2" />
                      {account.lastSyncError}
                    </div>
                  )}
                </div>
                </CardContent>
              </Card>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-14 w-14 rounded-full border border-border/60 bg-muted/60 flex items-center justify-center mb-4">
                <Mail className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-base font-medium mb-2">还没有邮箱账户</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                添加您的第一个邮箱账户，开始统一管理所有邮件
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                添加邮箱
              </Button>
            </CardContent>
          </Card>
        )}
        </div>

        {/* Help Section */}
        <div className="bg-card border border-border/60 rounded-xl shadow-elegant">
          <div className="px-5 py-4 border-b border-border/50">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lock className="h-4 w-4" />
              安全提示
            </CardTitle>
          </div>
          <div className="p-5 text-sm text-muted-foreground space-y-2">
            <p>
              <strong>Gmail 用户：</strong>推荐使用上方“连接 Gmail”按钮走 OAuth，或在 Google 账户设置中生成应用专用密码用于 IMAP。
            </p>
            <p>
              <strong>Microsoft/Outlook 用户：</strong>推荐使用上方“连接 Microsoft/Outlook”按钮。系统会使用 OAuth + Outlook IMAP（XOAUTH2）进行同步，避免普通密码登录受限的问题。
            </p>
            <p>
              <strong>QQ/163 邮箱用户：</strong>请在邮箱设置中开启 IMAP 服务，并使用授权码作为密码。
            </p>
            <p>
              您的邮箱凭据或 OAuth 令牌将被安全存储，仅用于同步邮件。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
