import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Star,
  Paperclip,
  Download,
  Mail,
  Clock,
  User,
  FileText,
  Image,
  File,
  Tag,
  Plus,
  Check,
  X
} from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface EmailDetailProps {
  emailId: number;
  onBack: () => void;
}

export default function EmailDetail({ emailId, onBack }: EmailDetailProps) {
  // Fetch email details
  const { data: email, isLoading } = trpc.email.get.useQuery({ id: emailId });

  // Fetch all labels
  const { data: allLabels } = trpc.label.list.useQuery();

  // Fetch labels for this email
  const { data: emailLabels, refetch: refetchLabels } = trpc.label.getForEmail.useQuery({
    emailId,
  });

  // Toggle star mutation
  const toggleStarMutation = trpc.email.toggleStar.useMutation();

  // Mark as read mutation
  const markReadMutation = trpc.email.markRead.useMutation();

  // Label mutations
  const addLabelMutation = trpc.label.addToEmail.useMutation({
    onSuccess: () => refetchLabels(),
  });
  const removeLabelMutation = trpc.label.removeFromEmail.useMutation({
    onSuccess: () => refetchLabels(),
  });

  // Handle star toggle
  const handleToggleStar = () => {
    if (!email) return;
    toggleStarMutation.mutate({
      id: emailId,
      isStarred: !email.isStarred,
    });
  };

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "未知大小";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get file icon
  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return File;
    if (mimeType.startsWith("image/")) return Image;
    if (mimeType.includes("pdf") || mimeType.includes("document")) return FileText;
    return File;
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b p-4">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="p-6 space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Separator className="my-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!email) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Mail className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">邮件不存在或已被删除</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-medium truncate max-w-md">
              {email.subject || "(无主题)"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleStar}
              disabled={toggleStarMutation.isPending}
            >
              <Star
                className={`h-5 w-5 ${
                  email.isStarred ? "text-yellow-500 fill-yellow-500" : ""
                }`}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Subject */}
          <h2 className="text-2xl font-semibold mb-4">
            {email.subject || "(无主题)"}
          </h2>

          {/* Labels */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {emailLabels?.map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                className="h-6 gap-1 pr-1"
                style={{
                  borderColor: label.color,
                  color: label.color,
                  backgroundColor: `${label.color}10`,
                }}
              >
                {label.name}
                <button
                  onClick={() =>
                    removeLabelMutation.mutate({ emailId, labelId: label.id })
                  }
                  className="hover:bg-background/50 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-xs px-2">
                  <Plus className="h-3 w-3 mr-1" /> 添加标签
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[200px]" align="start">
                <Command>
                  <CommandInput placeholder="搜索标签..." />
                  <CommandList>
                    <CommandEmpty>无相关标签</CommandEmpty>
                    <CommandGroup>
                      {allLabels?.map((label) => {
                        const isSelected = emailLabels?.some(
                          (l) => l.id === label.id
                        );
                        return (
                          <CommandItem
                            key={label.id}
                            onSelect={() => {
                              if (isSelected) {
                                removeLabelMutation.mutate({
                                  emailId,
                                  labelId: label.id,
                                });
                              } else {
                                addLabelMutation.mutate({
                                  emailId,
                                  labelId: label.id,
                                });
                              }
                            }}
                          >
                            <div
                              className="mr-2 h-3 w-3 rounded-full"
                              style={{ backgroundColor: label.color }}
                            />
                            <span>{label.name}</span>
                            {isSelected && <Check className="ml-auto h-4 w-4" />}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap items-start gap-4 mb-6">
            {/* Sender */}
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="font-medium">
                  {email.fromName || email.fromAddress}
                </div>
                {email.fromName && (
                  <div className="text-sm text-muted-foreground">
                    {email.fromAddress}
                  </div>
                )}
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
              <Clock className="h-4 w-4" />
              {email.date && format(new Date(email.date), "yyyy年MM月dd日 HH:mm", { locale: zhCN })}
            </div>
          </div>

          {/* Recipients */}
          <div className="text-sm text-muted-foreground mb-6 space-y-1">
            {email.toAddresses && email.toAddresses.length > 0 && (
              <div>
                <span className="font-medium">收件人：</span>
                {(email.toAddresses as string[]).join(", ")}
              </div>
            )}
            {email.ccAddresses && (email.ccAddresses as string[]).length > 0 && (
              <div>
                <span className="font-medium">抄送：</span>
                {(email.ccAddresses as string[]).join(", ")}
              </div>
            )}
          </div>

          <Separator className="my-6" />

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  附件 ({email.attachments.length})
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {email.attachments.map((attachment: any) => {
                  const FileIcon = getFileIcon(attachment.mimeType);
                  return (
                    <a
                      key={attachment.id}
                      href={attachment.s3Url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors group"
                    >
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <FileIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {attachment.filename}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.size)}
                        </div>
                      </div>
                      <Download className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Email Body */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {email.htmlBody ? (
              <div
                className="email-content"
                dangerouslySetInnerHTML={{ __html: email.htmlBody }}
              />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm">
                {email.textBody || "（无内容）"}
              </pre>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
