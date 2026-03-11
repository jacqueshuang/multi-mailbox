import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";

export default function AdminUsers() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [updatingUserId, setUpdatingUserId] = useState<number | null>(null);

  const { data: users, isLoading, refetch } = trpc.admin.listUsers.useQuery(undefined, {
    enabled: !!user && user.role === "admin",
  });

  const setUserRoleMutation = trpc.admin.setUserRole.useMutation({
    onSuccess: () => {
      toast.success("角色已更新");
      setUpdatingUserId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
      setUpdatingUserId(null);
    },
  });

  const setUserStatusMutation = trpc.admin.setUserStatus.useMutation({
    onSuccess: () => {
      toast.success("状态已更新");
      setUpdatingUserId(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
      setUpdatingUserId(null);
    },
  });

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (user.role !== "admin") {
      setLocation("/");
    }
  }, [loading, user, setLocation]);

  const rows = useMemo(() => users ?? [], [users]);

  if (loading || isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>用户管理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">暂无用户</div>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="border rounded-lg p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">
                        {row.name || row.email || row.openId}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {row.email || "-"}
                      </div>
                    </div>
                    <Badge variant={row.role === "admin" ? "default" : "secondary"}>
                      {row.role === "admin" ? "管理员" : "用户"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-muted-foreground">登录方式</div>
                      <div>{row.loginMethod || "-"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">注册时间</div>
                      <div>
                        {row.createdAt
                          ? format(new Date(row.createdAt), "yyyy/MM/dd HH:mm", { locale: zhCN })
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">最近登录</div>
                      <div>
                        {row.lastSignedIn
                          ? format(new Date(row.lastSignedIn), "yyyy/MM/dd HH:mm", { locale: zhCN })
                          : "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">状态</div>
                      <div>{row.isActive ? "启用" : "已禁用"}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={row.role}
                      onValueChange={(value) => {
                        setUpdatingUserId(row.id);
                        setUserRoleMutation.mutate({
                          id: row.id,
                          role: value as "user" | "admin",
                        });
                      }}
                      disabled={setUserRoleMutation.isPending && updatingUserId === row.id}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="设置角色" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">用户</SelectItem>
                        <SelectItem value="admin">管理员</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant={row.isActive ? "outline" : "default"}
                      onClick={() => {
                        setUpdatingUserId(row.id);
                        setUserStatusMutation.mutate({
                          id: row.id,
                          isActive: !row.isActive,
                        });
                      }}
                      disabled={setUserStatusMutation.isPending && updatingUserId === row.id}
                    >
                      {row.isActive ? "禁用" : "启用"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
