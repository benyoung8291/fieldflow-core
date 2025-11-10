import { useMemo } from 'react';
import { differenceInDays, addDays } from 'date-fns';

interface Task {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  progress?: number;
}

interface Dependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: string;
  lag_days: number;
}

interface CriticalPathResult {
  criticalTaskIds: Set<string>;
  taskSlack: Map<string, number>;
  criticalPathDuration: number;
}

export function useCriticalPath(tasks: Task[], dependencies: Dependency[]): CriticalPathResult {
  return useMemo(() => {
    if (!tasks.length) {
      return {
        criticalTaskIds: new Set(),
        taskSlack: new Map(),
        criticalPathDuration: 0,
      };
    }

    // Build dependency graph
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const predecessors = new Map<string, Array<{ taskId: string; dep: Dependency }>>();
    const successors = new Map<string, Array<{ taskId: string; dep: Dependency }>>();

    dependencies.forEach(dep => {
      if (!predecessors.has(dep.task_id)) {
        predecessors.set(dep.task_id, []);
      }
      predecessors.get(dep.task_id)!.push({ taskId: dep.depends_on_task_id, dep });

      if (!successors.has(dep.depends_on_task_id)) {
        successors.set(dep.depends_on_task_id, []);
      }
      successors.get(dep.depends_on_task_id)!.push({ taskId: dep.task_id, dep });
    });

    // Calculate ES (Earliest Start) and EF (Earliest Finish) - Forward Pass
    const es = new Map<string, Date>();
    const ef = new Map<string, Date>();
    const visited = new Set<string>();

    const calculateES = (taskId: string): void => {
      if (visited.has(taskId)) return;
      visited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return;

      const preds = predecessors.get(taskId) || [];
      
      if (preds.length === 0) {
        // No predecessors - use task's actual start date
        es.set(taskId, new Date(task.start_date));
      } else {
        // Calculate based on predecessors
        let maxDate = new Date(task.start_date);
        
        preds.forEach(({ taskId: predId, dep }) => {
          calculateES(predId);
          const predTask = taskMap.get(predId);
          if (!predTask) return;

          let constraintDate: Date;
          
          // Handle different dependency types (simplified - mainly using finish_to_start)
          switch (dep.dependency_type) {
            case 'start_to_start':
              constraintDate = new Date(predTask.start_date);
              break;
            case 'finish_to_finish':
            case 'start_to_finish':
            case 'finish_to_start':
            default:
              constraintDate = new Date(predTask.end_date);
              break;
          }

          // Add lag days
          constraintDate = addDays(constraintDate, dep.lag_days);

          if (constraintDate > maxDate) {
            maxDate = constraintDate;
          }
        });

        es.set(taskId, maxDate);
      }

      const taskStart = es.get(taskId)!;
      const duration = differenceInDays(new Date(task.end_date), new Date(task.start_date));
      ef.set(taskId, addDays(taskStart, duration));
    };

    // Calculate ES/EF for all tasks
    tasks.forEach(task => calculateES(task.id));

    // Find project end date (maximum EF)
    let projectEnd = new Date(0);
    ef.forEach(date => {
      if (date > projectEnd) projectEnd = date;
    });

    // Calculate LS (Latest Start) and LF (Latest Finish) - Backward Pass
    const ls = new Map<string, Date>();
    const lf = new Map<string, Date>();
    const backVisited = new Set<string>();

    const calculateLS = (taskId: string): void => {
      if (backVisited.has(taskId)) return;
      backVisited.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return;

      const succs = successors.get(taskId) || [];
      
      if (succs.length === 0) {
        // No successors - use project end date
        lf.set(taskId, projectEnd);
      } else {
        // Calculate based on successors
        let minDate = projectEnd;
        
        succs.forEach(({ taskId: succId, dep }) => {
          calculateLS(succId);
          const succTask = taskMap.get(succId);
          if (!succTask) return;

          const succLS = ls.get(succId);
          if (!succLS) return;

          let constraintDate = new Date(succLS);

          // Subtract lag days
          constraintDate = addDays(constraintDate, -dep.lag_days);

          if (constraintDate < minDate) {
            minDate = constraintDate;
          }
        });

        lf.set(taskId, minDate);
      }

      const taskFinish = lf.get(taskId)!;
      const duration = differenceInDays(new Date(task.end_date), new Date(task.start_date));
      ls.set(taskId, addDays(taskFinish, -duration));
    };

    // Calculate LS/LF for all tasks
    tasks.forEach(task => calculateLS(task.id));

    // Calculate slack/float and identify critical path
    const taskSlack = new Map<string, number>();
    const criticalTaskIds = new Set<string>();

    tasks.forEach(task => {
      const esDate = es.get(task.id);
      const lsDate = ls.get(task.id);
      
      if (esDate && lsDate) {
        const slack = differenceInDays(lsDate, esDate);
        taskSlack.set(task.id, slack);
        
        // Tasks with zero or near-zero slack are on critical path
        if (slack <= 0) {
          criticalTaskIds.add(task.id);
        }
      }
    });

    const criticalPathDuration = differenceInDays(projectEnd, new Date(Math.min(...Array.from(es.values()).map(d => d.getTime()))));

    return {
      criticalTaskIds,
      taskSlack,
      criticalPathDuration,
    };
  }, [tasks, dependencies]);
}
