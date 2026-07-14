"use client"
import { Todo } from '@prisma/client';
import { useState, useEffect } from 'react';
import DependencyGraph from '@/components/DependencyGraph';

type TodoWithDeps = Todo & {
  dependencies: { dependsOn: { id: number; title: string; completed: boolean } }[];
};

export default function Home() {
  const [newTodo, setNewTodo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedDeps, setSelectedDeps] = useState<number[]>([]);
  const [todos, setTodos] = useState<TodoWithDeps[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  // id -> earliestStart (in days) from the real schedule, not array order
  const [earliestStart, setEarliestStart] = useState<Record<string, number>>({});
  const [criticalPath, setCriticalPath] = useState<string[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const res = await fetch('/api/todos');
      const data = await res.json();
      setTodos(data);
      // one schedule fetch per mutation; every action handler ends in fetchTodos
      setScheduleLoading(true);
      const schedRes = await fetch('/api/todos/schedule');
      const sched = await schedRes.json();
      setEarliestStart(sched.earliestStart ?? {});
      setCriticalPath(sched.criticalPathIds ?? []);
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    try {
      setError(null);
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo, dueDate: dueDate || undefined }),
      });
      const created = await res.json();
      for (const depId of selectedDeps) {
        const depRes = await fetch(`/api/todos/${created.id}/dependencies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dependsOnId: depId }),
        });
        if (!depRes.ok) {
          const data = await depRes.json();
          setError(`Couldn't add dependency: ${data.error}`);
        }
      }
      setNewTodo('');
      setDueDate('');
      setSelectedDeps([]);
      fetchTodos();
    } catch (error) {
      console.error('Failed to add todo:', error);
    }
  };

  const handleToggleComplete = async (todo: TodoWithDeps) => {
    try {
      setError(null);
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !todo.completed }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }
      fetchTodos();
    } catch (error) {
      console.error('Failed to update todo:', error);
    }
  };

  const handleDeleteTodo = async (id:any) => {
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
      });
      fetchTodos();
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-blue-50 flex flex-col items-center p-4">
      <div className="w-full max-w-6xl">
        <header className="mb-8 text-center">
          <p className="text-sm text-slate-500" suppressHydrationWarning>
            {dateStr}
          </p>
          <h1
            className="font-display text-3xl font-bold tracking-tight text-slate-800"
            suppressHydrationWarning
          >
            {greeting}, Amisha
          </h1>
        </header>
        <div className="max-w-md mx-auto">
        <div className="flex mb-6 rounded-full shadow-[0_12px_40px_-12px_rgba(79,70,229,0.25)]">
          <input
            type="text"
            className="flex-grow p-3 rounded-l-full focus:outline-none text-slate-700"
            placeholder="Add a new todo"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
          
          />
          <input
            type="date"
            className="p-3 text-slate-700 focus:outline-none"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <button
            onClick={handleAddTodo}
            className="bg-white text-indigo-600 p-3 rounded-r-full hover:bg-gray-100 transition duration-300"
          >
            Add
          </button>
        </div>
        {todos.length > 0 && (
          <div className="mb-6">
            <p className="text-slate-500 text-sm mb-2">Depends on (optional)</p>
            <div className="flex flex-wrap gap-2">
              {todos.map((t) => {
                const selected = selectedDeps.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      setSelectedDeps((prev) =>
                        selected
                          ? prev.filter((id) => id !== t.id)
                          : [...prev, t.id]
                      )
                    }
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      selected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {t.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div
          aria-live="polite"
          className={`mb-4 rounded-lg bg-white text-red-700 px-4 py-2 text-sm shadow-[0_12px_40px_-12px_rgba(79,70,229,0.25)] transition-[opacity,transform] duration-200 ease-out motion-reduce:transform-none ${
            error
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 -translate-y-1 pointer-events-none'
          }`}
        >
          {error}
        </div>
        </div>
        {/* list (wider) and graph side by side on desktop, stacked on mobile */}
        <div className="mt-8 grid gap-8 lg:grid-cols-5 items-start">
        <ul className="lg:col-span-3 bg-white rounded-xl shadow-[0_12px_40px_-12px_rgba(79,70,229,0.25)] divide-y divide-slate-100 overflow-hidden">
          {/* actionable first, blocked middle, completed last; schedule order within groups */}
          {[...todos]
            .sort((a, b) => {
              const rank = (t: TodoWithDeps) =>
                t.completed
                  ? 2
                  : (t.dependencies ?? []).some((d) => !d.dependsOn.completed)
                  ? 1
                  : 0;
              // overdue first, but only within the actionable tier;
              // an overdue blocked task still isn't actionable
              const overdue = (t: TodoWithDeps) =>
                t.dueDate && new Date(t.dueDate) < new Date() ? 0 : 1;
              return (
                rank(a) - rank(b) ||
                (rank(a) === 0 ? overdue(a) - overdue(b) : 0) ||
                (earliestStart[String(a.id)] ?? 0) -
                  (earliestStart[String(b.id)] ?? 0)
              );
            })
            .map((todo) => {
            const blockers = (todo.dependencies ?? [])
              .filter((d) => !d.dependsOn.completed)
              .map((d) => d.dependsOn.title);
            const blocked = blockers.length > 0 && !todo.completed;
            return (
            <li
              key={todo.id}
              className="group flex items-center gap-3 px-4 py-2.5"
            >
              <button
                onClick={() => handleToggleComplete(todo)}
                disabled={blocked}
                title={blocked ? `Blocked by: ${blockers.join(', ')}` : undefined}
                aria-label={todo.completed ? `Mark ${todo.title} incomplete` : `Complete ${todo.title}`}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  todo.completed
                    ? 'bg-green-600 border-green-600'
                    : blocked
                    ? 'border-slate-200'
                    : 'border-slate-300 hover:border-green-600'
                }`}
              >
                {todo.completed && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              {todo.imageUrl && (
                <div className="w-8 h-8 flex-shrink-0">
                  {!loadedImages.has(todo.id) && (
                    <div className="w-8 h-8 rounded bg-slate-200 animate-pulse" />
                  )}
                  <img
                    src={todo.imageUrl}
                    alt={todo.title}
                    onLoad={() =>
                      setLoadedImages((prev) => new Set(prev).add(todo.id))
                    }
                    className={`w-8 h-8 rounded object-cover ${
                      loadedImages.has(todo.id) ? '' : 'hidden'
                    }`}
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span
                  className={`font-display font-semibold text-sm text-slate-800 block truncate ${
                    todo.completed ? 'line-through text-slate-400' : ''
                  }`}
                >
                  {todo.title}
                </span>
                <div className="flex flex-wrap items-center gap-x-2 text-xs">
                  {todo.dueDate && (
                    <span
                      className={
                        new Date(todo.dueDate) < new Date() && !todo.completed
                          ? 'text-red-600'
                          : todo.completed
                          ? 'text-slate-400'
                          : 'text-slate-500'
                      }
                    >
                      Due {new Date(todo.dueDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}
                    </span>
                  )}
                  {blocked && (
                    <span className="text-red-600">
                      <span aria-hidden>⏳</span> Blocked by {blockers.join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDeleteTodo(todo.id)}
                aria-label={`Delete ${todo.title}`}
                className="text-red-500 hover:text-red-700 transition-opacity opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </li>
            );
          })}
        </ul>
        <div className="lg:col-span-2">
          <DependencyGraph
            todos={todos}
            criticalPath={criticalPath}
            loading={scheduleLoading}
          />
        </div>
        </div>
      </div>
    </div>
  );
}
