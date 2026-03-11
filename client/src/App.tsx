import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import MailLayout from "./components/MailLayout";
import Inbox from "./pages/Inbox";
import Starred from "./pages/Starred";
import Accounts from "./pages/Accounts";
import ApiKeys from "./pages/ApiKeys";
import Labels from "./pages/Labels";
import Login from "./pages/Login";
import GoogleCallback from "./pages/GoogleCallback";
import MicrosoftCallback from "./pages/MicrosoftCallback";
import AdminUsers from "./pages/AdminUsers";
import TempMail from "./pages/TempMail";

function Router() {
  return (
    <Switch>
      {/* Auth/OAuth callbacks - outside MailLayout */}
      <Route path="/login" component={Login} />
      <Route path="/google-callback" component={GoogleCallback} />
      <Route path="/microsoft-callback" component={MicrosoftCallback} />

      {/* Main app routes */}
      <Route>
        <MailLayout>
          <Switch>
            <Route path="/" component={Inbox} />
            <Route path="/starred" component={Starred} />
            <Route path="/all" component={Inbox} />
            <Route path="/accounts" component={Accounts} />
            <Route path="/api-keys" component={ApiKeys} />
            <Route path="/labels" component={Labels} />
            <Route path="/temp-mail" component={TempMail} />
            <Route path="/admin/users" component={AdminUsers} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </MailLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster richColors position="top-center" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
