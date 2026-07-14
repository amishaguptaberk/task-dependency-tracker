// Pure scheduling helpers. No Prisma, no IO: plain data in, plain data out.

type Edge = { dependentId: string; dependsOnId: string };

// "A depends on B" = { dependentId: A, dependsOnId: B }.
// Adding that edge creates a cycle iff A is already reachable from B
// by walking dependsOn links.
export function wouldCreateCycle(
  edges: Edge[],
  newDependentId: string,
  newDependsOnId: string
): boolean {
  if (newDependentId === newDependsOnId) return true;

  // adjacency: node -> nodes it depends on
  const dependsOn = new Map<string, string[]>();
  for (const e of edges) {
    const list = dependsOn.get(e.dependentId) ?? [];
    list.push(e.dependsOnId);
    dependsOn.set(e.dependentId, list);
  }

  // iterative DFS from the proposed dependency
  const stack = [newDependsOnId];
  const seen = new Set<string>();
  while (stack.length) {
    const node = stack.pop()!;
    if (node === newDependentId) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...(dependsOn.get(node) ?? []));
  }
  return false;
}

// Forward-pass CPM: topo sort (Kahn's), then earliestStart[t] =
// max(earliestStart[dep] + duration[dep]) over t's dependencies, 0 if none.
// Critical path = the chain with the greatest cumulative duration.
// ponytail: forward pass only, no late start/float; add a backward pass if slack matters.
export function computeSchedule(
  tasks: { id: string; durationDays: number }[],
  edges: Edge[]
): { earliestStart: Record<string, number>; criticalPathIds: string[] } | { error: 'cycle' } {
  const duration = new Map(tasks.map((t) => [t.id, t.durationDays]));
  const deps = new Map<string, string[]>(); // node -> nodes it depends on
  const dependents = new Map<string, string[]>(); // node -> nodes that depend on it
  for (const e of edges) {
    deps.set(e.dependentId, [...(deps.get(e.dependentId) ?? []), e.dependsOnId]);
    dependents.set(e.dependsOnId, [...(dependents.get(e.dependsOnId) ?? []), e.dependentId]);
  }

  // Kahn's algorithm; deps are always processed before their dependents,
  // so earliestStart can be filled in during the same pass.
  const indegree = new Map(tasks.map((t) => [t.id, (deps.get(t.id) ?? []).length]));
  const queue = tasks.filter((t) => indegree.get(t.id) === 0).map((t) => t.id);
  const earliestStart: Record<string, number> = {};
  const bestPred: Record<string, string> = {}; // dep on the longest chain into each node
  let processed = 0;
  while (queue.length) {
    const id = queue.shift()!;
    processed++;
    let es = 0;
    for (const d of deps.get(id) ?? []) {
      const finish = earliestStart[d] + duration.get(d)!;
      if (finish > es) {
        es = finish;
        bestPred[id] = d;
      }
    }
    earliestStart[id] = es;
    for (const dep of dependents.get(id) ?? []) {
      const n = indegree.get(dep)! - 1;
      indegree.set(dep, n);
      if (n === 0) queue.push(dep);
    }
  }
  if (processed < tasks.length) return { error: 'cycle' };

  // Critical path ends at the latest-finishing node; walk bestPred back.
  let end: string | undefined;
  let maxFinish = -1;
  for (const t of tasks) {
    const finish = earliestStart[t.id] + t.durationDays;
    if (finish > maxFinish) {
      maxFinish = finish;
      end = t.id;
    }
  }
  const criticalPathIds: string[] = [];
  for (let n = end; n !== undefined; n = bestPred[n]) criticalPathIds.unshift(n);
  return { earliestStart, criticalPathIds };
}

if (require.main === module) {
  const assert = require('node:assert');
  const e = (dependentId: string, dependsOnId: string): Edge => ({ dependentId, dependsOnId });

  // B depends on A; proposing "A depends on B" closes the loop
  assert.equal(wouldCreateCycle([e('B', 'A')], 'A', 'B'), true, 'direct cycle');
  // B->A, C->B; proposing "A depends on C" closes a transitive loop
  assert.equal(wouldCreateCycle([e('B', 'A'), e('C', 'B')], 'A', 'C'), true, 'transitive cycle');
  // B->A; "C depends on A" is fine
  assert.equal(wouldCreateCycle([e('B', 'A')], 'C', 'A'), false, 'no cycle');

  // A(2)->B(3)->D(1), A->C(4)->D: D starts at max(2+3, 2+4) = 6,
  // critical path runs through C, not B.
  const schedule = computeSchedule(
    [
      { id: 'A', durationDays: 2 },
      { id: 'B', durationDays: 3 },
      { id: 'C', durationDays: 4 },
      { id: 'D', durationDays: 1 },
    ],
    [e('B', 'A'), e('D', 'B'), e('C', 'A'), e('D', 'C')]
  );
  assert.ok(!('error' in schedule), 'no cycle expected');
  if (!('error' in schedule)) {
    assert.equal(schedule.earliestStart.D, 6, 'D earliest start');
    assert.deepEqual(schedule.criticalPathIds, ['A', 'C', 'D'], 'critical path');
  }

  // cycle in the graph -> typed error, not an infinite loop
  const cyclic = computeSchedule(
    [
      { id: 'A', durationDays: 1 },
      { id: 'B', durationDays: 1 },
    ],
    [e('A', 'B'), e('B', 'A')]
  );
  assert.deepEqual(cyclic, { error: 'cycle' }, 'cycle detected');

  console.log('all checks passed');
}

