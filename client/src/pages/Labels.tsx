import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Tag,
  Trash2,
  Edit,
  Loader2,
  Palette,
} from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
];

export default function Labels() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<{ id: number; name: string; color: string; description?: string } | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#6366f1",
    description: "",
  });

  const utils = trpc.useUtils();

  const { data: labels, isLoading } = trpc.label.list.useQuery();

  const createLabelMutation = trpc.label.create.useMutation({
    onSuccess: () => {
      utils.label.list.invalidate();
      setIsAddDialogOpen(false);
      resetForm();
      toast.success("标签创建成功");
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  const updateLabelMutation = trpc.label.update.useMutation({
    onSuccess: () => {
      utils.label.list.invalidate();
      setEditingLabel(null);
      resetForm();
      toast.success("标签更新成功");
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const deleteLabelMutation = trpc.label.delete.useMutation({
    onSuccess: () => {
      utils.label.list.invalidate();
      toast.success("标签已删除");
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      color: "#6366f1",
      description: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLabel) {
      updateLabelMutation.mutate({
        id: editingLabel.id,
        name: formData.name,
        color: formData.color,
        description: formData.description || undefined,
      });
    } else {
      createLabelMutation.mutate({
        name: formData.name,
        color: formData.color,
        description: formData.description || undefined,
      });
    }
  };

  const openEditDialog = (label: { id: number; name: string; color: string; description?: string | null }) => {
    setEditingLabel({
      id: label.id,
      name: label.name,
      color: label.color,
      description: label.description || undefined,
    });
    setFormData({
      name: label.name,
      color: label.color,
      description: label.description || "",
    });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold">邮件标签</h1>
            <p className="text-sm text-muted-foreground mt-1">
              创建和管理邮件标签，方便分类整理邮件
            </p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setEditingLabel(null); }}>
                <Plus className="h-4 w-4 mr-2" />
                新建标签
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>新建标签</DialogTitle>
                  <DialogDescription>
                    创建一个新的邮件标签
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">标签名称</Label>
                    <Input
                      id="name"
                      placeholder="例如：工作、重要、待办"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">描述（可选）</Label>
                    <Input
                      id="description"
                      placeholder="标签的简短描述"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>标签颜色</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-8 h-8 rounded-full transition-all ${
                            formData.color === color
                              ? "ring-2 ring-offset-2 ring-primary scale-110"
                              : "hover:scale-105"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => setFormData(prev => ({ ...prev, color }))}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                        className="w-20 h-8 p-1 cursor-pointer"
                      />
                      <span className="text-sm text-muted-foreground">{formData.color}</span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={createLabelMutation.isPending}>
                    {createLabelMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    创建
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Dialog */}
        <Dialog open={!!editingLabel} onOpenChange={(open) => !open && setEditingLabel(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>编辑标签</DialogTitle>
                <DialogDescription>
                  修改标签信息
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">标签名称</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-description">描述（可选）</Label>
                  <Input
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>标签颜色</Label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`w-8 h-8 rounded-full transition-all ${
                          formData.color === color
                            ? "ring-2 ring-offset-2 ring-primary scale-110"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      className="w-20 h-8 p-1 cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground">{formData.color}</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingLabel(null)}>
                  取消
                </Button>
                <Button type="submit" disabled={updateLabelMutation.isPending}>
                  {updateLabelMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  保存
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Labels List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : labels && labels.length > 0 ? (
          <div className="space-y-3">
            {labels.map((label) => (
              <Card key={label.id} className="overflow-hidden">
                <CardHeader className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: `${label.color}20` }}
                      >
                        <Tag className="h-5 w-5" style={{ color: label.color }} />
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ backgroundColor: label.color }}
                          />
                          {label.name}
                          {label.isSystem && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded">系统</span>
                          )}
                        </CardTitle>
                        {label.description && (
                          <CardDescription className="text-sm mt-1">
                            {label.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(label)}
                        disabled={label.isSystem}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            disabled={label.isSystem}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认删除</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要删除标签「{label.name}」吗？此操作将移除所有邮件上的该标签，但不会删除邮件本身。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteLabelMutation.mutate({ id: label.id })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              删除
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Tag className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">还没有标签</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                创建标签来分类和整理您的邮件
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                新建标签
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4" />
              使用提示
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>添加标签：</strong>在邮件详情页面，点击标签图标可以为邮件添加或移除标签。
            </p>
            <p>
              <strong>筛选邮件：</strong>点击侧边栏中的标签名称，可以快速查看带有该标签的所有邮件。
            </p>
            <p>
              <strong>颜色区分：</strong>为不同类型的邮件使用不同颜色的标签，便于快速识别。
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
