import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    const { completed } = await request.json();
    if (typeof completed !== 'boolean') {
      return NextResponse.json({ error: 'completed must be a boolean' }, { status: 400 });
    }
    // The UI disables the button, but the server is the trust boundary.
    if (completed) {
      const open = await prisma.todoDependency.findMany({
        where: { dependentId: id, dependsOn: { completed: false } },
        include: { dependsOn: { select: { title: true } } },
      });
      if (open.length > 0) {
        const names = open.map((d) => d.dependsOn.title).join(', ');
        return NextResponse.json(
          { error: `Can't complete, still blocked by: ${names}` },
          { status: 400 }
        );
      }
    }
    const todo = await prisma.todo.update({
      where: { id },
      data: { completed },
    });
    return NextResponse.json(todo);
  } catch (error) {
    return NextResponse.json({ error: 'Error updating todo' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    await prisma.todo.delete({
      where: { id },
    });
    return NextResponse.json({ message: 'Todo deleted' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting todo' }, { status: 500 });
  }
}
