import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { HelpCircle, Smartphone, Monitor } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function LocationPermissionHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          Location Help
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            How to Enable Location Access
          </DialogTitle>
          <DialogDescription>
            Location access is required for GPS time tracking when clocking in and out.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="mobile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mobile">
              <Smartphone className="h-4 w-4 mr-2" />
              Mobile
            </TabsTrigger>
            <TabsTrigger value="desktop">
              <Monitor className="h-4 w-4 mr-2" />
              Desktop
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mobile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">iPhone (Safari)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <p className="font-medium text-sm">Method 1: In-Browser Settings</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Tap the <strong>AA</strong> icon in the address bar</li>
                    <li>Select <strong>"Website Settings"</strong></li>
                    <li>Tap <strong>"Location"</strong></li>
                    <li>Choose <strong>"Allow"</strong></li>
                    <li>Reload the page</li>
                  </ol>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <p className="font-medium text-sm">Method 2: Device Settings</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Open <strong>Settings</strong> app</li>
                    <li>Scroll down to <strong>Safari</strong></li>
                    <li>Tap <strong>Location</strong></li>
                    <li>Select <strong>"Allow"</strong> or <strong>"Ask"</strong></li>
                    <li>Return to the app and reload</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Android (Chrome)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <p className="font-medium text-sm">Method 1: In-Browser Settings</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Tap the <strong>lock icon</strong> or <strong>three dots</strong> in the address bar</li>
                    <li>Tap <strong>"Permissions"</strong> or <strong>"Site settings"</strong></li>
                    <li>Find <strong>"Location"</strong></li>
                    <li>Select <strong>"Allow"</strong></li>
                    <li>Reload the page</li>
                  </ol>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <p className="font-medium text-sm">Method 2: Device Settings</p>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Open <strong>Settings</strong> app</li>
                    <li>Go to <strong>Apps</strong> → <strong>Chrome</strong></li>
                    <li>Tap <strong>Permissions</strong></li>
                    <li>Tap <strong>Location</strong></li>
                    <li>Select <strong>"Allow only while using the app"</strong></li>
                    <li>Return to the app and reload</li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertTitle>Tip for Mobile Users</AlertTitle>
              <AlertDescription>
                If you're using the installed app (PWA), you may need to enable location in your device's
                main Settings app under the installed app's name.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="desktop" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Chrome / Edge</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Click the <strong>lock icon</strong> or <strong>site settings icon</strong> in the address bar</li>
                  <li>Click <strong>"Site settings"</strong> or <strong>"Permissions"</strong></li>
                  <li>Find <strong>"Location"</strong> in the list</li>
                  <li>Change it to <strong>"Allow"</strong></li>
                  <li>Reload the page</li>
                </ol>
                <p className="text-xs text-muted-foreground pt-2 border-t mt-3">
                  <strong>Alternative:</strong> Go to chrome://settings/content/location and add this site to allowed sites.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Firefox</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Click the <strong>lock icon</strong> in the address bar</li>
                  <li>Click the <strong>arrow</strong> next to "Connection secure"</li>
                  <li>Click <strong>"More Information"</strong></li>
                  <li>Go to the <strong>Permissions</strong> tab</li>
                  <li>Find <strong>"Access Your Location"</strong></li>
                  <li>Uncheck <strong>"Use Default"</strong></li>
                  <li>Check <strong>"Allow"</strong></li>
                  <li>Close and reload the page</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Safari (Mac)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Open <strong>Safari</strong> menu → <strong>Settings</strong></li>
                  <li>Click the <strong>Websites</strong> tab</li>
                  <li>Select <strong>"Location"</strong> from the left sidebar</li>
                  <li>Find this website in the list</li>
                  <li>Change to <strong>"Allow"</strong></li>
                  <li>Close settings and reload the page</li>
                </ol>
              </CardContent>
            </Card>

            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertTitle>Not Seeing the Lock Icon?</AlertTitle>
              <AlertDescription>
                Look for an icon near the website address that looks like a lock, location pin, or information icon.
                Clicking it will show site permissions.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        <Alert className="bg-blue-50 border-blue-200">
          <HelpCircle className="h-4 w-4 text-blue-600" />
          <AlertTitle>Still Having Issues?</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 text-sm mt-2">
              <li>Make sure location services are enabled on your device</li>
              <li>Try reloading the page after changing settings</li>
              <li>Check if other apps can access your location</li>
              <li>Try a different browser if the issue persists</li>
              <li>Contact your supervisor for assistance</li>
            </ul>
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
}
