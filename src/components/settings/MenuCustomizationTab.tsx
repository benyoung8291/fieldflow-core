import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Edit, Trash2, FolderPlus, Folder, ChevronDown, ChevronRight } from "lucide-react";
import * as LucideIcons from "lucide-react";

const defaultMenuItems = [
  { label: "Dashboard", icon: "LayoutDashboard", path: "/dashboard" },
  { label: "Quotes", icon: "FileText", path: "/quotes" },
  { label: "Pipeline", icon: "GitBranch", path: "/pipeline" },
  { label: "Projects", icon: "FolderKanban", path: "/projects" },
  { label: "Service Orders", icon: "Wrench", path: "/service-orders" },
  { label: "Service Contracts", icon: "FileSignature", path: "/service-contracts" },
  { label: "Appointments", icon: "CalendarClock", path: "/appointments" },
  { label: "Scheduler", icon: "Calendar", path: "/scheduler" },
  { label: "Customers", icon: "Users", path: "/customers" },
  { label: "Leads", icon: "Target", path: "/leads" },
  { label: "Workers", icon: "HardHat", path: "/workers" },
  { label: "Analytics", icon: "BarChart3", path: "/analytics" },
  { label: "Settings", icon: "Settings", path: "/settings" },
];

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  path: string | null;
  parent_id: string | null;
  item_order: number;
  is_folder: boolean;
  is_visible: boolean;
  is_system: boolean;
  color: string | null;
}

interface SortableItemProps {
  item: MenuItem;
  children: MenuItem[];
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

function SortableItem({ item, children, onEdit, onDelete, isExpanded, onToggle }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const IconComponent = (LucideIcons as any)[item.icon] || LucideIcons.Circle;

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`flex items-center gap-2 p-3 bg-card border rounded-lg mb-2 ${!item.is_visible ? "opacity-50" : ""}`}>
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {item.is_folder && (
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onToggle}>
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        )}

        {item.is_folder ? (
          <Folder className="h-4 w-4 text-muted-foreground" />
        ) : (
          <IconComponent className="h-4 w-4 text-muted-foreground" />
        )}

        <span className="flex-1 font-medium">{item.label}</span>

        {item.path && (
          <span className="text-xs text-muted-foreground">{item.path}</span>
        )}

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>
            <Edit className="h-4 w-4" />
          </Button>
          {!item.is_system && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {item.is_folder && isExpanded && children.length > 0 && (
        <div className="ml-8 space-y-2">
          <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {children.map((child) => (
              <SortableItem
                key={child.id}
                item={child}
                children={[]}
                onEdit={onEdit}
                onDelete={onDelete}
                isExpanded={false}
                onToggle={() => {}}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

export default function MenuCustomizationTab() {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedColor, setSelectedColor] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("id", session?.user?.id)
        .single();
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ["menu-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("item_order");

      if (error) throw error;
      return (data as MenuItem[]) || [];
    },
  });

  const initializeDefaultMenu = useMutation({
    mutationFn: async () => {
      if (!profile?.tenant_id) {
        throw new Error("Tenant ID not found. Please refresh the page.");
      }

      const itemsToInsert = defaultMenuItems.map((item, index) => ({
        tenant_id: profile.tenant_id,
        label: item.label,
        icon: item.icon,
        path: item.path,
        item_order: index,
        is_folder: false,
        is_visible: true,
        is_system: true,
      }));

      const { error } = await supabase.from("menu_items").insert(itemsToInsert as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Default menu initialized");
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const saveMenuItem = useMutation({
    mutationFn: async (data: Partial<MenuItem>) => {
      if (editingItem?.id) {
        const { error } = await supabase
          .from("menu_items")
          .update(data)
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        if (!profile?.tenant_id) {
          throw new Error("Tenant ID not found. Please refresh the page.");
        }
        
        const { error } = await supabase.from("menu_items").insert({
          ...data,
          tenant_id: profile.tenant_id,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingItem ? "Item updated" : "Item created");
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      setIsDialogOpen(false);
      setEditingItem(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const deleteMenuItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item deleted");
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const reorderItems = useMutation({
    mutationFn: async (updates: { id: string; item_order: number }[]) => {
      for (const update of updates) {
        await supabase
          .from("menu_items")
          .update({ item_order: update.item_order })
          .eq("id", update.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = menuItems.findIndex((item) => item.id === active.id);
    const newIndex = menuItems.findIndex((item) => item.id === over.id);

    const reordered = [...menuItems];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const updates = reordered.map((item, index) => ({
      id: item.id,
      item_order: index,
    }));

    reorderItems.mutate(updates);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setSelectedColor(item.color || "");
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      deleteMenuItem.mutate(id);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const parentId = formData.get("parent_id") as string;

    saveMenuItem.mutate({
      label: formData.get("label") as string,
      icon: formData.get("icon") as string,
      path: isCreatingFolder ? null : (formData.get("path") as string),
      parent_id: parentId === "none" ? null : parentId || null,
      is_folder: isCreatingFolder,
      is_visible: formData.get("is_visible") === "on",
      color: formData.get("color") as string || null,
      item_order: editingItem?.item_order || menuItems.length,
    });
  };

  const topLevelItems = menuItems.filter((item) => !item.parent_id);
  const getChildren = (parentId: string) => menuItems.filter((item) => item.parent_id === parentId);

  const iconOptions = Object.keys(LucideIcons).filter((key) => 
    key !== "createLucideIcon" && 
    key !== "default" && 
    key !== "icons" && 
    key !== "dynamicIconImports" &&
    typeof (LucideIcons as any)[key] !== "string" &&
    // Check if it's a valid React component (has $$typeof or is an object with render function)
    (LucideIcons as any)[key] && 
    typeof (LucideIcons as any)[key] === "object"
  ).sort().slice(0, 150); // Increased to 150 for more icon choices

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Menu Customization</CardTitle>
          <CardDescription>
            Customize your navigation menu by creating folders, reordering items, and changing icons
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {menuItems.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No menu items configured</p>
              <Button 
                onClick={() => initializeDefaultMenu.mutate()}
                disabled={!profile?.tenant_id || initializeDefaultMenu.isPending}
              >
                {initializeDefaultMenu.isPending ? "Initializing..." : "Initialize Default Menu"}
              </Button>
              {!profile?.tenant_id && (
                <p className="text-sm text-muted-foreground mt-2">Loading profile...</p>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setEditingItem(null);
                    setIsCreatingFolder(false);
                    setSelectedColor("");
                    setIsDialogOpen(true);
                  }}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
                <Button
                  onClick={() => {
                    setEditingItem(null);
                    setIsCreatingFolder(true);
                    setSelectedColor("");
                    setIsDialogOpen(true);
                  }}
                  variant="outline"
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Add Folder
                </Button>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={topLevelItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  {topLevelItems.map((item) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      children={getChildren(item.id)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isExpanded={expandedFolders.has(item.id)}
                      onToggle={() => {
                        const newExpanded = new Set(expandedFolders);
                        if (newExpanded.has(item.id)) {
                          newExpanded.delete(item.id);
                        } else {
                          newExpanded.add(item.id);
                        }
                        setExpandedFolders(newExpanded);
                      }}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit" : "Add"} {isCreatingFolder ? "Folder" : "Menu Item"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                name="label"
                defaultValue={editingItem?.label}
                required
              />
            </div>

            <div>
              <Label htmlFor="icon">Icon</Label>
              <Select name="icon" defaultValue={editingItem?.icon || "Circle"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {iconOptions.map((iconName) => {
                    const IconComp = (LucideIcons as any)[iconName];
                    return (
                      <SelectItem key={iconName} value={iconName}>
                        <div className="flex items-center gap-2">
                          <IconComp className="h-4 w-4" />
                          <span>{iconName}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {!isCreatingFolder && (
              <div>
                <Label htmlFor="path">Path *</Label>
                <Input
                  id="path"
                  name="path"
                  defaultValue={editingItem?.path || ""}
                  placeholder="/example"
                  required
                />
              </div>
            )}

            <div>
              <Label htmlFor="parent_id">Parent Folder</Label>
              <Select name="parent_id" defaultValue={editingItem?.parent_id || "none"}>
                <SelectTrigger>
                  <SelectValue placeholder="None (top level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top level)</SelectItem>
                  {menuItems
                    .filter((item) => item.is_folder && item.id !== editingItem?.id)
                    .map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="color">Icon Color (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  name="color"
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="flex-1"
                  placeholder="#3b82f6"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Leave default to use standard icon color
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_visible"
                name="is_visible"
                defaultChecked={editingItem?.is_visible !== false}
              />
              <Label htmlFor="is_visible">Visible</Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingItem ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
