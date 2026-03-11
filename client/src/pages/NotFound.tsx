import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border border-border/60 shadow-elegant">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-destructive/10 rounded-full" />
              <AlertCircle className="relative h-12 w-12 text-destructive" />
            </div>
          </div>

          <h1 className="text-3xl font-semibold text-foreground mb-2">404</h1>

          <h2 className="text-lg font-semibold text-muted-foreground mb-3">
            页面未找到
          </h2>

          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            您访问的页面不存在，可能已被移动或删除。
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button onClick={handleGoHome}>
              <Home className="w-4 h-4 mr-2" />
              返回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
