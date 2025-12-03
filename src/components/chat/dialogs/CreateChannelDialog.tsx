import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCreateChannel } from "@/hooks/chat";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ChatChannelType } from "@/types/chat";

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateChannelDialog({ open, onOpenChange }: CreateChannelDialogProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = location.pathname.startsWith("/worker") ? "/worker/chat" : "/chat";
  const createChannel = useCreateChannel();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Channel name is required");
      return;
    }

    try {
      const channel = await createChannel.mutateAsync({
        name: name.trim(),
        type: privacy as ChatChannelType,
        description: description.trim() || undefined,
      });

      toast.success(`Channel "${name}" created successfully`);
      onOpenChange(false);
      resetForm();
      navigate(`${basePath}/${channel.id}`);
    } catch (error) {
      console.error("Error creating channel:", error);
      toast.error("Failed to create channel");
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrivacy("public");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a Channel</DialogTitle>
          <DialogDescription>
            Channels are where your team communicates. They're best organized around a topic.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Name</Label>
            <Input
              id="channel-name"
              placeholder="e.g. project-updates"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="channel-description">Description (optional)</Label>
            <Textarea
              id="channel-description"
              placeholder="What's this channel about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-3">
            <Label>Privacy</Label>
            <RadioGroup value={privacy} onValueChange={(v) => setPrivacy(v as "public" | "private")}>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="public" id="public" className="mt-1" />
                <div className="space-y-0.5">
                  <Label htmlFor="public" className="font-medium cursor-pointer">
                    Public
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Anyone in the workspace can view and join
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="private" id="private" className="mt-1" />
                <div className="space-y-0.5">
                  <Label htmlFor="private" className="font-medium cursor-pointer">
                    Private
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Only invited members can view and participate
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createChannel.isPending || !name.trim()}>
              {createChannel.isPending ? "Creating..." : "Create Channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
