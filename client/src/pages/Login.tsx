import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    displayName: "",
  });

  const loginMutation = trpc.auth.loginPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("登录成功");
      setLocation("/");
    },
    onError: (error) => {
      toast.error(error.message || "登录失败");
    },
  });

  const registerMutation = trpc.auth.registerPassword.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("注册成功");
      setLocation("/");
    },
    onError: (error) => {
      toast.error(error.message || "注册失败");
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Card className="border border-border/60 shadow-elegant">
          <CardHeader className="space-y-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full border border-border/60 bg-primary/10 flex items-center justify-center">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">多邮箱管理中心</CardTitle>
                <CardDescription>使用用户名和密码登录或注册</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-muted/40">
                <TabsTrigger value="login" className="text-sm">登录</TabsTrigger>
                <TabsTrigger value="register" className="text-sm">注册</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4">
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    loginMutation.mutate(loginForm);
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="login-username">用户名</Label>
                    <Input
                      id="login-username"
                      value={loginForm.username}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, username: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">密码</Label>
                    <Input
                      id="login-password"
                      type="password"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, password: e.target.value }))}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                    {loginMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    登录
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-4">
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    registerMutation.mutate(registerForm);
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="register-username">用户名</Label>
                    <Input
                      id="register-username"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, username: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-display-name">显示名称（可选）</Label>
                    <Input
                      id="register-display-name"
                      value={registerForm.displayName}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, displayName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">密码</Label>
                    <Input
                      id="register-password"
                      type="password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))}
                      required
                      minLength={8}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                    {registerMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    注册并登录
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <div className="bg-card border border-border/60 rounded-xl shadow-elegant px-4 py-3 text-xs text-muted-foreground text-center">
          推荐使用邮箱账户进行 OAuth 授权连接，以获得最佳同步体验。
        </div>
      </div>
    </div>
  );
}
