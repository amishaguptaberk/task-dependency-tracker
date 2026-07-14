import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wouldCreateCycle } from '@/lib/scheduling';

interface Params {
  params: {
    id: string;
  };
}

export async function POST(request: Request, { params }: Params) {
  const dependentId = parseInt(params.id);
  if (isNaN(dependentId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const { dependsOnId } = await request.json();
    if (typeof dependsOnId !== 'number') {
      return NextResponse.json({ error: 'dependsOnId is required' }, { status: 400 });
    }

    const edges = await prisma.todoDependency.findMany();
    const stringEdges = edges.map((e) => ({
      dependentId: String(e.dependentId),
      dependsOnId: String(e.dependsOnId),
    }));
    if (wouldCreateCycle(stringEdges, String(dependentId), String(dependsOnId))) {
      return NextResponse.json({ error: 'circular dependency' }, { status: 400 });
    }

    const dependency = await prisma.todoDependency.create({
      data: { dependentId, dependsOnId },
    });
    return NextResponse.json(dependency, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Dependency already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error creating dependency' }, { status: 500 });
  }
}
