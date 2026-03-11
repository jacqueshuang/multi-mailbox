import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Mail } from "lucide-react";

export default function GoogleCallback() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [accountEmail, setAccountEmail] = useState("");

  const handleCallbackMutation = trpc.emailAccount.handleGoogleCallback.useMutation({
    onSuccess: (result) => {
      setStatus("success");
      setAccountEmail(result.account.email);
      
      // Redirect to accounts page after 2 seconds
      setTimeout(() => {
        setLocation("/accounts");
      }, 2000);
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message);
    },
  });

  useEffect(() => {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");

    if (error) {
      setStatus("error");
      setErrorMessage(error === "access_denied" 
        ? "您取消了授权请求" 
        : `授权失败: ${error}`);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setErrorMessage("缺少必要的授权参数");
      return;
    }

    // Get the redirect URI (current page without query params)
    const origin = import.meta.env.DEV ? "https://messager.sk29.pw" : window.location.origin;
    const redirectUri = `${origin}/google-callback`;

    // Handle the callback
    handleCallbackMutation.mutate({
      code,
      state,
      redirectUri,
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border border-border/60 shadow-elegant">
        <CardHeader className="text-center border-b border-border/50">
          <div className="mx-auto mb-4 h-14 w-14 rounded-full border border-border/60 bg-primary/10 flex items-center justify-center">
            {status === "loading" && (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            )}
            {status === "success" && (
              <CheckCircle className="h-6 w-6 text-green-500" />
            )}
            {status === "error" && (
              <XCircle className="h-6 w-6 text-destructive" />
            )}
          </div>
          <CardTitle className="text-base font-semibold">
            {status === "loading" && "正在连接 Gmail..."}
            {status === "success" && "连接成功！"}
            {status === "error" && "连接失败"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "loading" && (
            <p className="text-muted-foreground">
              正在验证您的 Google 账户并设置邮箱同步，请稍候...
            </p>
          )}

          {status === "success" && (
            <>
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{accountEmail}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                您的 Gmail 账户已成功添加，正在跳转到账户管理页面...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <p className="text-destructive">{errorMessage}</p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  className="border-border/70"
                  onClick={() => setLocation("/accounts")}
                >
                  返回账户管理
                </Button>
                <Button onClick={() => window.location.reload()}>
                  重试
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
