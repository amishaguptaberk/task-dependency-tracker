import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeSchedule } from '@/lib/scheduling';

export async function GET() {
  try {
    const todos = await prisma.todo.findMany();
    const edges = await prisma.todoDependency.findMany();
    // durationDays defaults to 1: no duration field was requested, deliberate.
    const result = computeSchedule(
      todos.map((t) => ({ id: String(t.id), durationDays: 1 })),
      edges.map((e) => ({
        dependentId: String(e.dependentId),
        dependsOnId: String(e.dependsOnId),
      }))
    );
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Error computing schedule' }, { status: 500 });
  }
}
