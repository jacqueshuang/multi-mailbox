import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getLoginUrl } from "@/const";
import { Streamdown } from 'streamdown';

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  // If theme is switchable in App.tsx, we can implement theme toggling like this:
  // const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <main className="flex-1">
        <div className="max-w-5xl mx-auto p-6 md:p-8 space-y-4">
          <div className="bg-card border border-border/60 rounded-xl shadow-elegant">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
              <div className="h-9 w-9 rounded-full border border-border/60 bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">示例页面</h1>
                <p className="text-sm text-muted-foreground">
                  该页面仅用于演示，实际产品可替换为正式内容。
                </p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <Streamdown>Any **markdown** content</Streamdown>
              <div>
                <Button variant="default">Example Button</Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
