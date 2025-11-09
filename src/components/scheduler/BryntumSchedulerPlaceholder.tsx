export default function BryntumSchedulerPlaceholder() {
  return (
    <div className="flex items-center justify-center p-12 border-2 border-dashed border-border rounded-lg">
      <div className="text-center space-y-4 max-w-2xl">
        <h3 className="text-lg font-semibold">Bryntum Scheduler Pro Not Installed</h3>
        <p className="text-sm text-muted-foreground">
          Please install the Bryntum Scheduler Pro trial package using the commands below:
        </p>
        <pre className="text-xs bg-muted p-4 rounded-md text-left overflow-x-auto">
          npm config set "@bryntum:registry=https://npm.bryntum.com"{"\n"}
          npm login --registry=https://npm.bryntum.com{"\n"}
          npm install @bryntum/schedulerpro@npm:@bryntum/schedulerpro-trial{"\n"}
          npm install @bryntum/schedulerpro-react
        </pre>
        <p className="text-xs text-muted-foreground">
          After installation, refresh the page to see the Bryntum Scheduler.
        </p>
      </div>
    </div>
  );
}
